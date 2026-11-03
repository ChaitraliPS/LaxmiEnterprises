import { Op } from "sequelize";
import { sequelize } from "../config/db.js";
import { Invoice, InvoiceLine, Product, Client, Payment, Collection, StockMovement, Inventory } from "../models/index.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { updateStock, applyStockChange } from "../utils/stockSync.js";
import { generateInvoiceNumber, generatePaymentNumber, generateCollectionNumber } from "../utils/numberSequence.js";
import { getToday, deriveTransactionStatus, TRANSACTION_STATUSES } from "../constants/erpConstants.js";

export const canonicalizePaymentMode = (mode) => {
  if (!mode) return "UPI";
  const str = String(mode).trim();
  const lower = str.toLowerCase();
  if (lower.includes("upi")) return "UPI";
  if (lower.includes("neft")) return "NEFT";
  if (lower.includes("rtgs")) return "RTGS";
  if (lower.includes("imps")) return "IMPS";
  if (lower.includes("cheque")) return "Cheque";
  if (lower.includes("cash")) return "Cash";
  if (lower.includes("commercial")) return "Commercial Transfer";
  if (lower.includes("transfer") || lower.includes("deposit")) return "Commercial Transfer";
  return str;
};

const VALID_PAYMENT_MODES = [
  "NEFT",
  "RTGS",
  "IMPS",
  "UPI",
  "Cheque",
  "Cash",
  "Commercial Transfer",
  "UPI Commercial / NEFT",
  "Bank Transfer (NEFT/RTGS)",
  "Bank Transfer",
  "Cash Counter",
  "Cheque (In Clearance)",
  "Direct Deposit",
];

/**
 * Returns all invoices, optionally filtered by status or date range
 */
export const getInvoices = asyncHandler(async (req, res) => {
  const { status, range } = req.query;
  const whereClause = {};

  if (status && status !== "All") {
    if (status === "Cancelled") {
      whereClause.isCancelled = true;
    } else {
      whereClause.isCancelled = false;
      whereClause.status = status;
    }
  }

  const invoices = await Invoice.findAll({
    where: whereClause,
    include: [
      { model: Payment, as: "payments" },
      { model: Collection, as: "collections" },
      { model: InvoiceLine, as: "lines" },
      { model: Client, as: "client", attributes: ["clientId", "name", "clientType", "paymentTerms"] },
    ],
    order: [["invoiceDate", "DESC"], ["createdAt", "DESC"]],
  });

  return ApiResponse.success(res, invoices, "Invoices retrieved successfully");
});

/**
 * Returns single invoice with lines and payment history
 */
export const getInvoiceById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const invoice = await Invoice.findOne({
    where: {
      [Op.or]: [{ invoiceNumber: id }, ...(isNaN(id) ? [] : [{ id: Number(id) }])],
    },
    include: [
      { model: Payment, as: "payments" },
      { model: Collection, as: "collections" },
      { model: InvoiceLine, as: "lines", include: [{ model: Product, as: "product" }] },
      { model: Client, as: "client" },
    ],
  });

  if (!invoice) {
    throw ApiError.notFound(`Invoice not found with identifier: ${id}`);
  }

  return ApiResponse.success(res, invoice, "Invoice retrieved successfully");
});

/**
 * Create a new GST sales tax invoice
 * - One DB transaction writing invoice + lines + SALE_OUT movements.
 * - Blocks sale if stock would go negative.
 * - Server generates sequential invoiceNumber per FY via dedicated Sequence row lock.
 * - Server calculates totals from line items and Product master GST rates (client line totals are ignored).
 */
export const createInvoice = asyncHandler(async (req, res) => {
  const inputData = { ...req.body };

  // Parse invoiceDate (business date)
  let businessDateStr = inputData.invoiceDate || inputData.date;
  if (!businessDateStr || !/^\d{4}-\d{2}-\d{2}/.test(String(businessDateStr))) {
    businessDateStr = getToday();
  } else {
    businessDateStr = String(businessDateStr).slice(0, 10);
  }

  const t = await sequelize.transaction();

  try {
    // 1. Validate Client
    let creditDays = 0;
    let clientName = inputData.clientName || "";
    let clientType = inputData.clientType || "Feed Shop";
    let clientId = inputData.clientId || "";

    if (!clientId && !clientName) {
      throw ApiError.badRequest("clientId is required to create a sales invoice. Silent defaults are disabled.");
    }

    if (clientId) {
      const client = await Client.findOne({
        where: {
          [Op.or]: [{ clientId }, ...(isNaN(clientId) ? [] : [{ id: Number(clientId) }])],
        },
        transaction: t,
      });
      if (client) {
        clientId = client.clientId;
        clientName = client.name;
        clientType = client.clientType;
        if (client.paymentTerms) {
          const match = String(client.paymentTerms).match(/\d+/);
          if (match) creditDays = parseInt(match[0], 10);
        }
      } else {
        throw ApiError.badRequest(`Client not found with identifier: ${clientId}`);
      }
    } else if (clientName) {
      const client = await Client.findOne({ where: { name: clientName }, transaction: t });
      if (client) {
        clientId = client.clientId;
        clientName = client.name;
        clientType = client.clientType;
      } else {
        throw ApiError.badRequest(`Client not found with name: ${clientName}`);
      }
    }

    if (creditDays === 0 && inputData.creditDays) {
      creditDays = parseInt(inputData.creditDays, 10) || 0;
    }

    const invDateObj = new Date(businessDateStr);
    const dueDateObj = new Date(invDateObj);
    dueDateObj.setDate(dueDateObj.getDate() + creditDays);
    const dueDateStr = dueDateObj.toISOString().slice(0, 10);

    // 2. Validate line items and check stock availability
    const rawLines = Array.isArray(inputData.lines) ? inputData.lines : (Array.isArray(inputData.items) ? inputData.items : []);
    if (rawLines.length === 0) {
      throw ApiError.badRequest("Invoice must contain at least one line item.");
    }

    // Merge duplicate lines for the same productId server-side
    const mergedLinesMap = new Map();
    for (const rawLine of rawLines) {
      const prodId = rawLine.productId || rawLine.id;
      if (!prodId) throw ApiError.badRequest("Product ID is required for each invoice line.");
      const qty = Number(rawLine.quantity ?? rawLine.qty ?? 0);
      const discount = Number(rawLine.discount || 0);

      if (mergedLinesMap.has(prodId)) {
        const existing = mergedLinesMap.get(prodId);
        existing.quantity += qty;
        existing.discount += discount;
      } else {
        mergedLinesMap.set(prodId, { ...rawLine, productId: prodId, quantity: qty, discount });
      }
    }
    const normalizedLines = Array.from(mergedLinesMap.values());

    let calculatedTaxable = 0;
    let calculatedGst = 0;
    let calculatedTotalCost = 0;
    const validatedLines = [];
    const cachedItemsArray = [];

    for (const line of normalizedLines) {
      const prodId = line.productId;
      const qty = Number(line.quantity);
      if (isNaN(qty) || !isFinite(qty) || qty <= 0) {
        throw ApiError.badRequest(`Quantity must be a valid positive number for product ${prodId}. Received: ${line.quantity}`);
      }

      const prod = await Product.findOne({ where: { productId: prodId }, transaction: t });
      if (!prod) {
        throw ApiError.badRequest(`Product "${prodId}" does not exist in the product master.`);
      }

      const rawPrice = line.unitPrice ?? line.rate ?? line.price ?? prod.sellingPrice;
      const unitPrice = Number(rawPrice);
      if (isNaN(unitPrice) || !isFinite(unitPrice) || unitPrice < 0) {
        throw ApiError.badRequest(`Unit price must be a valid non-negative number for product "${prod.name}" (${prodId}). Received: ${rawPrice}`);
      }

      const rawDiscount = line.discount || 0;
      const discount = Number(rawDiscount);
      if (isNaN(discount) || !isFinite(discount) || discount < 0) {
        throw ApiError.badRequest(`Discount cannot be negative for product "${prod.name}" (${prodId}). Received: ${rawDiscount}`);
      }
      const lineGross = Math.round(unitPrice * qty * 100) / 100;
      if (discount > lineGross + 0.005) {
        throw ApiError.badRequest(`Discount (₹${discount}) cannot exceed line total (₹${lineGross}) for product "${prod.name}" (${prodId}).`);
      }

      // Determine gstRate: honor line-item selection, fallback to product master
      const taxable = Math.max(0, Math.round((lineGross - discount) * 100) / 100);
      const rawLineGst = line.gstRate ?? line.gst;
      const gstRate = (rawLineGst !== undefined && rawLineGst !== null && !isNaN(Number(rawLineGst)))
        ? Math.max(0, Number(rawLineGst))
        : Math.max(0, Number(prod.gstRate || 0));
      const gstAmt = Math.round(taxable * (gstRate / 100) * 100) / 100;
      const lineTotal = Math.round((taxable + gstAmt) * 100) / 100;

      // Lock snapshot of cost price at the exact moment of sale
      const costPriceSnapshot = Number(prod.costPrice || prod.purchasePrice || 0);
      calculatedTotalCost += costPriceSnapshot * qty;
      calculatedTaxable += taxable;
      calculatedGst += gstAmt;

      validatedLines.push({
        productId: prodId,
        productName: prod.name,
        quantity: qty,
        unitOfMeasure: prod.unitOfMeasure || prod.unit || "Bags",
        unitPrice,
        taxableAmount: taxable,
        gstRate,
        gstAmount: gstAmt,
        lineTotal,
        costPriceSnapshot,
        warehouseLocation: prod.warehouseLocation,
      });

      cachedItemsArray.push({
        productId: prodId,
        description: prod.name,
        qty,
        unit: prod.unitOfMeasure || prod.unit || "Bags",
        rate: unitPrice,
        taxable,
        gstRate,
        total: lineTotal,
        costPrice: costPriceSnapshot,
      });
    }

    const calculatedGrandTotal = Math.round((calculatedTaxable + calculatedGst) * 100) / 100;

    // 3. Generate sequential invoice number server-side with sequence row lock (ignore client-sent numbers)
    const invoiceNumber = await generateInvoiceNumber(t, businessDateStr);

    // Validate payment if submitted together
    let paidAmount = 0;
    if (inputData.paidAmount !== undefined && inputData.paidAmount !== null && inputData.paidAmount !== "") {
      paidAmount = Number(inputData.paidAmount);
      if (isNaN(paidAmount) || !isFinite(paidAmount) || paidAmount < 0) {
        throw ApiError.badRequest(`Paid amount must be a valid non-negative number. Received: ${inputData.paidAmount}`);
      }
    }
    paidAmount = Math.round(paidAmount * 100) / 100;
    const balanceDue = Math.round(Math.max(0, calculatedGrandTotal - paidAmount) * 100) / 100;

    const rawMode = inputData.paymentMode || inputData.paymentMethod;
    if (paidAmount > 0) {
      if (!rawMode || !VALID_PAYMENT_MODES.some((m) => m.toLowerCase() === String(rawMode).trim().toLowerCase())) {
        throw ApiError.badRequest(
          `Valid paymentMode is required when recording an initial payment (${VALID_PAYMENT_MODES.join(", ")}). Received: ${rawMode || "none"}`
        );
      }
    }

    const canonicalMode = rawMode ? (canonicalizePaymentMode(rawMode) || rawMode) : null;

    const status = deriveTransactionStatus({
      grandTotal: calculatedGrandTotal,
      paidAmount,
      dueDate: dueDateStr,
      isCancelled: false,
      asOfDate: getToday(),
    });

    // 4. Create Invoice Header
    const invoice = await Invoice.create(
      {
        invoiceNumber,
        clientId,
        clientName,
        clientType,
        clientGstin: inputData.clientGstin || "",
        clientContact: inputData.clientContact || "",
        clientAddress: inputData.clientAddress || "",
        invoiceDate: businessDateStr,
        date: businessDateStr,
        creditDays,
        dueDate: dueDateStr,
        items: cachedItemsArray,
        subtotal: calculatedTaxable,
        taxableTotal: calculatedTaxable,
        totalCost: calculatedTotalCost,
        cgstTotal: calculatedGst / 2,
        sgstTotal: calculatedGst / 2,
        igstTotal: 0.0,
        gstTotal: calculatedGst,
        grandTotal: calculatedGrandTotal,
        paidAmount,
        balanceDue,
        status,
        paymentStatus: status,
        paymentMode: canonicalMode,
        isCancelled: false,
        notes: inputData.notes || "",
      },
      { transaction: t }
    );

    // 5. Create Invoice Lines
    for (const vLine of validatedLines) {
      await InvoiceLine.create(
        {
          invoiceId: invoiceNumber,
          productId: vLine.productId,
          productName: vLine.productName,
          quantity: vLine.quantity,
          unitOfMeasure: vLine.unitOfMeasure,
          unitPrice: vLine.unitPrice,
          taxableAmount: vLine.taxableAmount,
          gstRate: vLine.gstRate,
          gstAmount: vLine.gstAmount,
          lineTotal: vLine.lineTotal,
          costPriceSnapshot: vLine.costPriceSnapshot,
        },
        { transaction: t }
      );
    }

    // 6. Record Initial Payment and Collection if provided (in same transaction)
    if (paidAmount > 0) {
      const payMode = canonicalMode || "UPI";
      const payNumber = await generatePaymentNumber(t, businessDateStr);
      const initialPayment = await Payment.create(
        {
          paymentNumber: payNumber,
          invoiceId: invoiceNumber,
          clientId,
          amount: paidAmount,
          paymentDate: new Date(businessDateStr),
          paymentMode: payMode,
          status: "Completed",
          reference: `Initial Payment for ${invoiceNumber}`,
          notes: inputData.paymentNotes || "",
        },
        { transaction: t }
      );

      const colNumber = await generateCollectionNumber(t, businessDateStr);
      await Collection.create(
        {
          collectionNumber: colNumber,
          paymentId: initialPayment.id,
          invoiceNumber,
          clientId,
          clientName,
          amount: paidAmount,
          paymentDate: new Date(businessDateStr),
          paymentMode: payMode,
          status: "Completed",
          reference: `Initial Collection for ${invoiceNumber}`,
          notes: inputData.paymentNotes || "",
        },
        { transaction: t }
      );
    }

    // 7. Deduct Stock via updateStock outward function inside the same transaction
    for (const vLine of validatedLines) {
      await updateStock({
        productId: vLine.productId,
        type: "outward",
        quantity: vLine.quantity,
        referenceType: "SALE_INVOICE",
        reference: invoiceNumber,
        warehouseLocation: vLine.warehouseLocation || "Main Warehouse - Bay 01",
        date: new Date(businessDateStr),
        transaction: t,
      });
    }

    // 8. Update Client totals
    if (clientId) {
      const client = await Client.findOne({ where: { clientId }, transaction: t });
      if (client) {
        client.orders = Number(client.orders || 0) + 1;
        client.revenue = Number(client.revenue || 0) + calculatedGrandTotal;
        client.outstandingBalance = Number(client.outstandingBalance || 0) + balanceDue;
        client.outstanding = client.outstandingBalance;
        await client.save({ transaction: t });
      }
    }

    await t.commit();

    const created = await Invoice.findOne({
      where: { invoiceNumber },
      include: [{ model: InvoiceLine, as: "lines" }, { model: Payment, as: "payments" }],
    });

    return ApiResponse.created(res, created, `Invoice ${invoiceNumber} created and stock deducted.`);
  } catch (error) {
    await t.rollback();
    throw error;
  }
});

/**
 * Edit invoice metadata (notes, dueDate, clientAddress, clientContact)
 * If payment is supplied, records payment and collection in the same transaction.
 */
export const updateInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes, dueDate, clientAddress, clientContact, paymentAmount, paymentMode, paymentDate, referenceNo, reference } = req.body;
  const rawPayment = paymentAmount !== undefined ? paymentAmount : req.body.amount;
  const hasPayment = rawPayment !== undefined && rawPayment !== null && rawPayment !== "" && Number(rawPayment) > 0;

  const t = await sequelize.transaction();
  try {
    const invoice = await Invoice.findOne({
      where: {
        [Op.or]: [{ invoiceNumber: id }, ...(isNaN(id) ? [] : [{ id: Number(id) }])],
      },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!invoice) {
      throw ApiError.notFound(`Invoice not found with identifier: ${id}`);
    }
    if (invoice.isCancelled) {
      throw ApiError.badRequest("Cannot edit a cancelled invoice. Financial and historical records are locked.");
    }

    if (notes !== undefined) invoice.notes = notes;
    if (clientAddress !== undefined) invoice.clientAddress = clientAddress;
    if (clientContact !== undefined) invoice.clientContact = clientContact;
    if (dueDate !== undefined) invoice.dueDate = dueDate;

    let recordedPayment = null;
    let recordedCollection = null;

    if (hasPayment) {
      const amount = Number(rawPayment);
      if (isNaN(amount) || amount <= 0) {
        throw ApiError.badRequest("Payment amount must be greater than 0");
      }

      const pMode = paymentMode || invoice.paymentMode || "UPI";
      if (!VALID_PAYMENT_MODES.some((m) => m.toLowerCase() === String(pMode).trim().toLowerCase())) {
        throw ApiError.badRequest(`Valid paymentMode is required (${VALID_PAYMENT_MODES.join(", ")})`);
      }

      const currentBalance = Number(invoice.balanceDue ?? Math.max(0, Number(invoice.grandTotal || 0) - Number(invoice.paidAmount || 0)));
      if (amount > currentBalance + 0.005) {
        throw ApiError.badRequest(`Payment amount (₹${amount}) exceeds remaining balance due (₹${currentBalance})`);
      }

      const payDate = paymentDate ? new Date(paymentDate) : new Date();
      const payNumber = await generatePaymentNumber(t, payDate);
      const canonicalMode = canonicalizePaymentMode(pMode);

      recordedPayment = await Payment.create(
        {
          paymentNumber: payNumber,
          invoiceId: invoice.invoiceNumber,
          clientId: invoice.clientId || "",
          amount,
          paymentDate: payDate,
          paymentMode: canonicalMode,
          status: "Completed",
          reference: referenceNo || reference || `Settlement for ${invoice.invoiceNumber}`,
          notes: notes || "",
        },
        { transaction: t }
      );

      const colNumber = await generateCollectionNumber(t, payDate);
      recordedCollection = await Collection.create(
        {
          collectionNumber: colNumber,
          paymentId: recordedPayment.id,
          invoiceNumber: invoice.invoiceNumber,
          clientId: invoice.clientId || "",
          clientName: invoice.clientName || "",
          amount,
          paymentDate: payDate,
          paymentMode: canonicalMode,
          status: "Completed",
          reference: referenceNo || reference || `Settlement for ${invoice.invoiceNumber}`,
          notes: notes || "",
        },
        { transaction: t }
      );

      // Re-query payments
      const allPayments = await Payment.findAll({
        where: { invoiceId: invoice.invoiceNumber, status: "Completed" },
        transaction: t,
      });
      const totalPaid = allPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
      const grandTotal = Number(invoice.grandTotal || 0);
      const balanceDue = Math.max(0, grandTotal - totalPaid);

      invoice.paidAmount = totalPaid;
      invoice.balanceDue = balanceDue;
      invoice.paymentMode = canonicalMode;
      if (balanceDue === 0) invoice.paidDate = payDate;

      // Update client outstanding
      if (invoice.clientId) {
        const client = await Client.findOne({ where: { clientId: invoice.clientId }, transaction: t });
        if (client) {
          client.outstandingBalance = Math.max(0, Number(client.outstandingBalance || 0) - amount);
          client.outstanding = client.outstandingBalance;
          await client.save({ transaction: t });
        }
      }
    }

    // Re-derive status
    invoice.status = deriveTransactionStatus({
      grandTotal: Number(invoice.grandTotal || 0),
      paidAmount: Number(invoice.paidAmount || 0),
      dueDate: invoice.dueDate,
      isCancelled: false,
      asOfDate: getToday(),
    });
    invoice.paymentStatus = invoice.status;

    await invoice.save({ transaction: t });
    await t.commit();

    return ApiResponse.success(res, { invoice, payment: recordedPayment, collection: recordedCollection }, "Invoice updated successfully");
  } catch (err) {
    await t.rollback();
    throw err;
  }
});

/**
 * Record a payment against an outstanding invoice
 * Safe concurrency with row lock on Invoice, rejects overpayment, cancelled documents, and invalid modes.
 * Atomically inserts Payment, updates Invoice, inserts Collection, and updates Client in ONE transaction.
 */
export const recordPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentAmount, paymentMode, paymentDate, referenceNo, notes, reference } = req.body;

  const rawAmount = paymentAmount !== undefined ? paymentAmount : req.body.amount;
  if (rawAmount === undefined || rawAmount === null || rawAmount === "") {
    throw ApiError.badRequest("Payment amount is required and must be greater than 0");
  }

  const amount = Number(rawAmount);
  if (isNaN(amount) || amount <= 0) {
    throw ApiError.badRequest("Payment amount must be greater than 0");
  }

  if (!paymentMode || !VALID_PAYMENT_MODES.some((m) => m.toLowerCase() === String(paymentMode).trim().toLowerCase())) {
    throw ApiError.badRequest(`Valid paymentMode is required (${VALID_PAYMENT_MODES.join(", ")})`);
  }

  const t = await sequelize.transaction();

  try {
    // Acquire row lock to ensure concurrency safety
    const invoice = await Invoice.findOne({
      where: {
        [Op.or]: [{ invoiceNumber: id }, ...(isNaN(id) ? [] : [{ id: Number(id) }])],
      },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!invoice) {
      throw ApiError.notFound(`Invoice not found with identifier: ${id}`);
    }
    if (invoice.isCancelled) {
      throw ApiError.badRequest("Cannot record payment against a cancelled invoice");
    }

    const currentBalance = Number(invoice.balanceDue ?? Math.max(0, Number(invoice.grandTotal || 0) - Number(invoice.paidAmount || 0)));
    if (amount > currentBalance + 0.005) {
      throw ApiError.badRequest(`Payment amount (₹${amount}) exceeds remaining balance due (₹${currentBalance})`);
    }

    const payDate = paymentDate ? new Date(paymentDate) : new Date();
    const payNumber = await generatePaymentNumber(t, payDate);
    const colNumber = await generateCollectionNumber(t, payDate);

    // 1. Create Payment record
    const canonicalMode = canonicalizePaymentMode(paymentMode);
    const payment = await Payment.create(
      {
        paymentNumber: payNumber,
        invoiceId: invoice.invoiceNumber,
        clientId: invoice.clientId || "",
        amount,
        paymentDate: payDate,
        paymentMode: canonicalMode,
        status: "Completed",
        reference: referenceNo || reference || `Settlement for ${invoice.invoiceNumber}`,
        notes: notes || "",
      },
      { transaction: t }
    );

    // 2. Create Collection entry linked to payment in SAME transaction
    const collection = await Collection.create(
      {
        collectionNumber: colNumber,
        paymentId: payment.id,
        invoiceNumber: invoice.invoiceNumber,
        clientId: invoice.clientId || "",
        clientName: invoice.clientName || "",
        amount,
        paymentDate: payDate,
        paymentMode: canonicalMode,
        status: "Completed",
        reference: referenceNo || reference || `Settlement for ${invoice.invoiceNumber}`,
        notes: notes || "",
      },
      { transaction: t }
    );

    // 3. Derive updated paid amount and status
    const allPayments = await Payment.findAll({
      where: { invoiceId: invoice.invoiceNumber, status: "Completed" },
      transaction: t,
    });
    const totalPaid = allPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const grandTotal = Number(invoice.grandTotal || 0);
    const balanceDue = Math.max(0, grandTotal - totalPaid);

    const derivedStatus = deriveTransactionStatus({
      grandTotal,
      paidAmount: totalPaid,
      dueDate: invoice.dueDate,
      isCancelled: false,
      asOfDate: getToday(),
    });

    invoice.paidAmount = totalPaid;
    invoice.balanceDue = balanceDue;
    invoice.status = derivedStatus;
    invoice.paymentStatus = derivedStatus;
    invoice.paymentMode = canonicalMode;
    if (balanceDue === 0) invoice.paidDate = payDate;
    await invoice.save({ transaction: t });

    // 4. Update Client outstanding
    if (invoice.clientId) {
      const client = await Client.findOne({ where: { clientId: invoice.clientId }, transaction: t });
      if (client) {
        client.outstandingBalance = Math.max(0, Number(client.outstandingBalance || 0) - amount);
        client.outstanding = client.outstandingBalance;
        await client.save({ transaction: t });
      }
    }

    await t.commit();
    return ApiResponse.success(res, { invoice, payment, collection }, "Payment and Collection entry recorded successfully");
  } catch (error) {
    await t.rollback();
    throw error;
  }
});

/**
 * Update an existing payment and its linked Collection entry together in one transaction
 */
export const updatePayment = asyncHandler(async (req, res) => {
  const { id, paymentId } = req.params;
  const { paymentAmount, paymentMode, paymentDate, referenceNo, notes, reference } = req.body;
  const rawAmount = paymentAmount !== undefined ? paymentAmount : req.body.amount;
  const newAmount = rawAmount !== undefined && rawAmount !== null && rawAmount !== "" ? Number(rawAmount) : null;

  if (newAmount !== null && (isNaN(newAmount) || newAmount <= 0)) {
    throw ApiError.badRequest("Payment amount must be greater than 0");
  }

  const t = await sequelize.transaction();
  try {
    const invoice = await Invoice.findOne({
      where: {
        [Op.or]: [{ invoiceNumber: id }, ...(isNaN(id) ? [] : [{ id: Number(id) }])],
      },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!invoice) throw ApiError.notFound(`Invoice not found with identifier: ${id}`);
    if (invoice.isCancelled) throw ApiError.badRequest("Cannot edit payment on a cancelled invoice");

    const payment = await Payment.findOne({
      where: {
        id: paymentId,
        invoiceId: invoice.invoiceNumber,
      },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!payment) throw ApiError.notFound(`Payment ${paymentId} not found for invoice ${id}`);

    const collection = await Collection.findOne({
      where: { paymentId: payment.id },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    const oldAmount = Number(payment.amount || 0);
    const updatedAmount = newAmount !== null ? newAmount : oldAmount;
    const diff = updatedAmount - oldAmount;

    // Check overpayment if amount increased
    const otherPayments = await Payment.findAll({
      where: {
        invoiceId: invoice.invoiceNumber,
        status: "Completed",
        id: { [Op.ne]: payment.id },
      },
      transaction: t,
    });
    const otherPaid = otherPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const grandTotal = Number(invoice.grandTotal || 0);
    if (otherPaid + updatedAmount > grandTotal + 0.005) {
      throw ApiError.badRequest(`Updated payment amount (₹${updatedAmount}) exceeds invoice grand total`);
    }

    const payMode = paymentMode ? (canonicalizePaymentMode(paymentMode) || paymentMode) : payment.paymentMode;
    const payDate = paymentDate ? new Date(paymentDate) : payment.paymentDate;
    const payRef = referenceNo || reference || payment.reference;
    const payNotes = notes !== undefined ? notes : payment.notes;

    // 1. Update Payment
    payment.amount = updatedAmount;
    payment.paymentMode = payMode;
    payment.paymentDate = payDate;
    payment.reference = payRef;
    payment.notes = payNotes;
    await payment.save({ transaction: t });

    // 2. Update linked Collection
    if (collection) {
      collection.amount = updatedAmount;
      collection.paymentMode = payMode;
      collection.paymentDate = payDate;
      collection.reference = payRef;
      collection.notes = payNotes;
      await collection.save({ transaction: t });
    }

    // 3. Recalculate Invoice totals
    const totalPaid = otherPaid + updatedAmount;
    const balanceDue = Math.max(0, grandTotal - totalPaid);
    const derivedStatus = deriveTransactionStatus({
      grandTotal,
      paidAmount: totalPaid,
      dueDate: invoice.dueDate,
      isCancelled: false,
      asOfDate: getToday(),
    });

    invoice.paidAmount = totalPaid;
    invoice.balanceDue = balanceDue;
    invoice.status = derivedStatus;
    invoice.paymentStatus = derivedStatus;
    if (balanceDue === 0) invoice.paidDate = payDate;
    else invoice.paidDate = null;
    await invoice.save({ transaction: t });

    // 4. Update Client outstanding balance
    if (invoice.clientId && diff !== 0) {
      const client = await Client.findOne({ where: { clientId: invoice.clientId }, transaction: t });
      if (client) {
        client.outstandingBalance = Math.max(0, Number(client.outstandingBalance || 0) - diff);
        client.outstanding = client.outstandingBalance;
        await client.save({ transaction: t });
      }
    }

    await t.commit();
    return ApiResponse.success(res, { invoice, payment, collection }, "Payment and Collection updated successfully");
  } catch (err) {
    await t.rollback();
    throw err;
  }
});

/**
 * Delete a payment and its linked Collection entry together in one transaction
 */
export const deletePayment = asyncHandler(async (req, res) => {
  const { id, paymentId } = req.params;
  const t = await sequelize.transaction();
  try {
    const invoice = await Invoice.findOne({
      where: {
        [Op.or]: [{ invoiceNumber: id }, ...(isNaN(id) ? [] : [{ id: Number(id) }])],
      },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!invoice) throw ApiError.notFound(`Invoice not found with identifier: ${id}`);

    const payment = await Payment.findOne({
      where: {
        id: paymentId,
        invoiceId: invoice.invoiceNumber,
      },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!payment) throw ApiError.notFound(`Payment ${paymentId} not found for invoice ${id}`);

    const collection = await Collection.findOne({
      where: { paymentId: payment.id },
      transaction: t,
    });

    const removedAmount = Number(payment.amount || 0);

    // 1. Delete linked Collection
    if (collection) {
      await collection.destroy({ transaction: t });
    }

    // 2. Delete Payment
    await payment.destroy({ transaction: t });

    // 3. Recalculate Invoice totals
    const remainingPayments = await Payment.findAll({
      where: {
        invoiceId: invoice.invoiceNumber,
        status: "Completed",
      },
      transaction: t,
    });
    const totalPaid = remainingPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const grandTotal = Number(invoice.grandTotal || 0);
    const balanceDue = Math.max(0, grandTotal - totalPaid);
    const derivedStatus = deriveTransactionStatus({
      grandTotal,
      paidAmount: totalPaid,
      dueDate: invoice.dueDate,
      isCancelled: invoice.isCancelled,
      asOfDate: getToday(),
    });

    invoice.paidAmount = totalPaid;
    invoice.balanceDue = balanceDue;
    invoice.status = derivedStatus;
    invoice.paymentStatus = derivedStatus;
    if (balanceDue > 0) invoice.paidDate = null;
    await invoice.save({ transaction: t });

    // 4. Update Client outstanding balance
    if (invoice.clientId && removedAmount > 0) {
      const client = await Client.findOne({ where: { clientId: invoice.clientId }, transaction: t });
      if (client) {
        client.outstandingBalance = Number(client.outstandingBalance || 0) + removedAmount;
        client.outstanding = client.outstandingBalance;
        await client.save({ transaction: t });
      }
    }

    await t.commit();
    return ApiResponse.success(res, { invoice }, `Payment ${paymentId} and linked Collection entry deleted successfully`);
  } catch (err) {
    await t.rollback();
    throw err;
  }
});

/**
 * Cancel a sale instead of hard-delete
 * Soft-cancels invoice, reverses stock movements, reverses client revenue & balance
 */
export const deleteInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const t = await sequelize.transaction();

  try {
    const invoice = await Invoice.findOne({
      where: {
        [Op.or]: [{ invoiceNumber: id }, ...(isNaN(id) ? [] : [{ id: Number(id) }])],
      },
      include: [{ model: InvoiceLine, as: "lines" }, { model: Payment, as: "payments" }],
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!invoice) {
      await t.rollback();
      throw ApiError.notFound(`Invoice not found with identifier: ${id}`);
    }
    if (invoice.isCancelled) {
      await t.commit();
      return ApiResponse.success(res, invoice, "Invoice is already cancelled");
    }

    // 1. Reverse stock movements for each line item (RETURN / reversal via updateStock)
    for (const line of invoice.lines || []) {
      await updateStock({
        productId: line.productId,
        type: "inward",
        quantity: line.quantity,
        referenceType: "CANCEL_INVOICE",
        reference: `Cancelled ${invoice.invoiceNumber}`,
        warehouseLocation: line.warehouseLocation,
        date: new Date(),
        transaction: t,
      });
    }

    // 2. Mark payments and collections as Cancelled
    await Payment.update(
      { status: "Cancelled", notes: `Cancelled due to invoice ${invoice.invoiceNumber} cancellation` },
      { where: { invoiceId: invoice.invoiceNumber }, transaction: t }
    );
    await Collection.update(
      { status: "Cancelled", notes: `Cancelled due to invoice ${invoice.invoiceNumber} cancellation` },
      { where: { invoiceNumber: invoice.invoiceNumber }, transaction: t }
    );

    // 3. Soft-cancel the invoice header
    const previousBalanceDue = Number(invoice.balanceDue || Math.max(0, Number(invoice.grandTotal || 0) - Number(invoice.paidAmount || 0)));
    invoice.isCancelled = true;
    invoice.status = TRANSACTION_STATUSES.CANCELLED;
    invoice.paymentStatus = TRANSACTION_STATUSES.CANCELLED;
    invoice.balanceDue = 0;
    await invoice.save({ transaction: t });

    // 4. Reverse Client totals
    if (invoice.clientId) {
      const client = await Client.findOne({ where: { clientId: invoice.clientId }, transaction: t, lock: t.LOCK.UPDATE });
      if (client) {
        client.orders = Math.max(0, Number(client.orders || 0) - 1);
        client.revenue = Math.max(0, Number(client.revenue || 0) - Number(invoice.grandTotal || 0));
        client.outstandingBalance = Math.max(
          0,
          Number(client.outstandingBalance || 0) - previousBalanceDue
        );
        client.outstanding = client.outstandingBalance;
        await client.save({ transaction: t });
      }
    }

    await t.commit();
    return ApiResponse.success(res, invoice, "Invoice successfully cancelled and transactional effects reversed");
  } catch (error) {
    await t.rollback();
    throw error;
  }
});
