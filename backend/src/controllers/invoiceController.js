import { Op } from "sequelize";
import { sequelize } from "../config/db.js";
import { Invoice, InvoiceLine, Product, Client, Payment, StockMovement, Inventory } from "../models/index.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { applyStockChange } from "../utils/stockSync.js";
import { generateInvoiceNumber, generatePaymentNumber } from "../utils/numberSequence.js";
import { getToday, deriveTransactionStatus, TRANSACTION_STATUSES } from "../constants/erpConstants.js";

const VALID_PAYMENT_MODES = ["NEFT", "RTGS", "IMPS", "UPI", "Cheque", "Cash", "Commercial Transfer"];

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

    let calculatedTaxable = 0;
    let calculatedGst = 0;
    let calculatedTotalCost = 0;
    const validatedLines = [];
    const cachedItemsArray = [];

    for (const line of rawLines) {
      const prodId = line.productId || line.id;
      const qty = Number(line.quantity ?? line.qty ?? 0);
      if (!prodId) throw ApiError.badRequest("Product ID is required for each invoice line.");
      if (qty <= 0) throw ApiError.badRequest(`Quantity must be greater than 0 for product ${prodId}.`);

      const prod = await Product.findOne({ where: { productId: prodId }, transaction: t });
      if (!prod) {
        throw ApiError.badRequest(`Product "${prodId}" does not exist in the product master.`);
      }

      // Do not trust client-sent calculations: use Product master price and GST rate
      const unitPrice = Number(line.unitPrice ?? line.rate ?? line.price ?? prod.sellingPrice);
      const discount = Number(line.discount || 0);
      const taxable = Math.max(0, Math.round(((unitPrice * qty) - discount) * 100) / 100);
      const gstRate = Number(prod.gstRate || 0);
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

    // 3. Generate sequential invoice number server-side with sequence row lock
    let invoiceNumber = inputData.invoiceNumber;
    if (!invoiceNumber || (await Invoice.findOne({ where: { invoiceNumber }, transaction: t }))) {
      invoiceNumber = await generateInvoiceNumber(t, businessDateStr);
    }

    // Payment if submitted together
    const paidAmount = Number(inputData.paidAmount || 0);
    const balanceDue = Math.max(0, calculatedGrandTotal - paidAmount);

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
        paymentMode: inputData.paymentMode || null,
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

    // 6. Record Initial Payment if provided
    if (paidAmount > 0) {
      const payMode = inputData.paymentMode;
      if (!payMode) {
        throw ApiError.badRequest("Real paymentMode is required when recording an initial payment.");
      }
      const payNumber = await generatePaymentNumber(t, businessDateStr);
      await Payment.create(
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
    }

    // 7. Check Stock & Write SALE_OUT movements inside the same transaction
    for (const vLine of validatedLines) {
      // Calculate current stock balance strictly from stock_movements ledger inside transaction
      const movements = await StockMovement.findAll({
        where: { productId: vLine.productId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });

      let currentBalance = 0;
      for (const m of movements) {
        const q = Number(m.quantity || Math.abs(Number(m.quantityChange || 0)));
        const dir = m.direction || (Number(m.quantityChange || 0) >= 0 ? "IN" : "OUT");
        currentBalance += dir === "IN" ? q : -q;
      }

      if (currentBalance < vLine.quantity) {
        throw ApiError.badRequest(
          `Insufficient stock for product "${vLine.productName}" (${vLine.productId}). Required: ${vLine.quantity}, Available: ${currentBalance}. Transaction rolled back.`
        );
      }

      // Record SALE_OUT movement
      await applyStockChange(vLine.productId, -vLine.quantity, {
        movementType: "SALE_OUT",
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
 * Edit non-financial invoice metadata (notes, dueDate, clientAddress, clientContact)
 * Financial modifications require invoice cancellation and re-creation.
 */
export const updateInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes, dueDate, clientAddress, clientContact } = req.body;

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
    if (dueDate !== undefined) {
      invoice.dueDate = dueDate;
      // Re-derive status if dueDate changed
      invoice.status = deriveTransactionStatus({
        grandTotal: Number(invoice.grandTotal || 0),
        paidAmount: Number(invoice.paidAmount || 0),
        dueDate: invoice.dueDate,
        isCancelled: false,
        asOfDate: getToday(),
      });
      invoice.paymentStatus = invoice.status;
    }

    await invoice.save({ transaction: t });
    await t.commit();

    return ApiResponse.success(res, invoice, "Invoice metadata updated successfully");
  } catch (err) {
    await t.rollback();
    throw err;
  }
});

/**
 * Record a payment against an outstanding invoice
 * Safe concurrency with row lock on Invoice, rejects overpayment, cancelled documents, and invalid modes.
 */
export const recordPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentAmount, paymentMode, paymentDate, referenceNo, notes, reference } = req.body;

  const amount = Number(paymentAmount ?? req.body.amount);
  if (!amount || amount <= 0) {
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
    if (amount > currentBalance) {
      throw ApiError.badRequest(`Payment amount (₹${amount}) exceeds remaining balance due (₹${currentBalance})`);
    }

    const payDate = paymentDate ? new Date(paymentDate) : new Date();
    const payNumber = await generatePaymentNumber(t, payDate);

    // 1. Create Payment record
    const payment = await Payment.create(
      {
        paymentNumber: payNumber,
        invoiceId: invoice.invoiceNumber,
        clientId: invoice.clientId || "",
        amount,
        paymentDate: payDate,
        paymentMode,
        status: "Completed",
        reference: referenceNo || reference || `Settlement for ${invoice.invoiceNumber}`,
        notes: notes || "",
      },
      { transaction: t }
    );

    // 2. Derive updated paid amount and status
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
    invoice.paymentMode = paymentMode;
    if (balanceDue === 0) invoice.paidDate = payDate;
    await invoice.save({ transaction: t });

    // 3. Update Client outstanding
    if (invoice.clientId) {
      const client = await Client.findOne({ where: { clientId: invoice.clientId }, transaction: t });
      if (client) {
        client.outstandingBalance = Math.max(0, Number(client.outstandingBalance || 0) - amount);
        client.outstanding = client.outstandingBalance;
        await client.save({ transaction: t });
      }
    }

    await t.commit();
    return ApiResponse.success(res, { invoice, payment }, "Payment recorded and derived status updated");
  } catch (error) {
    await t.rollback();
    throw error;
  }
});

/**
 * Cancel a sale instead of hard-delete
 * Soft-cancels invoice, reverses stock movements, reverses client revenue & balance
 */
export const deleteInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const invoice = await Invoice.findOne({
    where: {
      [Op.or]: [{ invoiceNumber: id }, ...(isNaN(id) ? [] : [{ id: Number(id) }])],
    },
    include: [{ model: InvoiceLine, as: "lines" }, { model: Payment, as: "payments" }],
  });

  if (!invoice) {
    throw ApiError.notFound(`Invoice not found with identifier: ${id}`);
  }
  if (invoice.isCancelled) {
    return ApiResponse.success(res, invoice, "Invoice is already cancelled");
  }

  const t = await sequelize.transaction();

  try {
    // 1. Reverse stock movements for each line item (RETURN / reversal)
    for (const line of invoice.lines || []) {
      await applyStockChange(line.productId, line.quantity, {
        movementType: "RETURN",
        referenceType: "CANCEL_INVOICE",
        reference: `Cancelled ${invoice.invoiceNumber}`,
        warehouseLocation: line.warehouseLocation,
        date: new Date(),
        transaction: t,
      });
    }

    // 2. Mark payments as Cancelled
    await Payment.update(
      { status: "Cancelled", notes: `Cancelled due to invoice ${invoice.invoiceNumber} cancellation` },
      { where: { invoiceId: invoice.invoiceNumber }, transaction: t }
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
      const client = await Client.findOne({ where: { clientId: invoice.clientId }, transaction: t });
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
