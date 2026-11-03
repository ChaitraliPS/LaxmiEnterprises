import { Op } from "sequelize";
import { sequelize } from "../config/db.js";
import { Purchase, PurchaseLine, Product, Vendor, VendorPayment, Inventory, StockMovement } from "../models/index.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { applyStockChange } from "../utils/stockSync.js";
import { generatePurchaseNumber, generateVendorPaymentNumber } from "../utils/numberSequence.js";
import { getToday, deriveTransactionStatus, TRANSACTION_STATUSES, VENDOR_TYPES } from "../constants/erpConstants.js";

const VALID_VENDOR_PAYMENT_MODES = ["NEFT", "RTGS", "IMPS", "UPI", "Cheque", "Cash", "RTGS / Bank Transfer", "Bank Transfer"];

/**
 * Returns all inward purchases, optionally filtered by status
 */
export const getPurchases = asyncHandler(async (req, res) => {
  const { status } = req.query;
  const whereClause = {};

  if (status && status !== "All") {
    if (status === "Cancelled") {
      whereClause.isCancelled = true;
    } else {
      whereClause.isCancelled = false;
      whereClause.status = status;
    }
  }

  const purchases = await Purchase.findAll({
    where: whereClause,
    include: [
      { model: VendorPayment, as: "vendorPayments" },
      { model: PurchaseLine, as: "lines" },
      { model: Vendor, as: "vendor", attributes: ["vendorId", "name", "category", "paymentTerms"] },
    ],
    order: [["purchaseDate", "DESC"], ["createdAt", "DESC"]],
  });

  return ApiResponse.success(res, purchases, "Purchases retrieved successfully");
});

/**
 * Returns single purchase bill by identifier
 */
export const getPurchaseById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const purchase = await Purchase.findOne({
    where: {
      [Op.or]: [{ purchaseId: id }, ...(isNaN(id) ? [] : [{ id: Number(id) }])],
    },
    include: [
      { model: VendorPayment, as: "vendorPayments" },
      { model: PurchaseLine, as: "lines", include: [{ model: Product, as: "product" }] },
      { model: Vendor, as: "vendor" },
    ],
  });

  if (!purchase) {
    throw ApiError.notFound(`Purchase not found with identifier: ${id}`);
  }

  return ApiResponse.success(res, purchase, "Purchase retrieved successfully");
});

/**
 * Create a new Inward Procurement Bill
 * - Server calculates grandTotal from lines; client cannot submit a total.
 * - Updates product cost price using Weighted Average Cost (WAC) from stock on hand and new purchase.
 * - Writes purchase + lines + PURCHASE_IN movements in one atomic DB transaction.
 */
export const createPurchase = asyncHandler(async (req, res) => {
  const inputData = { ...req.body };

  // Parse business date
  let businessDateStr = inputData.purchaseDate || inputData.date;
  if (!businessDateStr || !/^\d{4}-\d{2}-\d{2}/.test(String(businessDateStr))) {
    businessDateStr = getToday();
  } else {
    businessDateStr = String(businessDateStr).slice(0, 10);
  }

  if (!inputData.vendorId) {
    throw ApiError.badRequest("vendorId is required to create a purchase bill. Silent defaults are disabled.");
  }

  let rawLines = inputData.lines || inputData.items;
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    if (inputData.productId) {
      rawLines = [
        {
          productId: inputData.productId,
          productName: inputData.productName || inputData.name || "",
          quantity: Number(inputData.inwardQty ?? inputData.quantity ?? 1),
          unitCost: Number(inputData.unitRate ?? inputData.rate ?? inputData.costPrice ?? 0),
          gstRate: Number(inputData.gstRate ?? inputData.taxRate ?? 0),
        },
      ];
    }
  }

  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    throw ApiError.badRequest("Purchase bill must contain at least one line item linked to the product master.");
  }

  const t = await sequelize.transaction();

  try {
    // 1. Fetch vendor master details
    const vendor = await Vendor.findOne({ where: { vendorId: inputData.vendorId }, transaction: t });
    if (!vendor) {
      throw ApiError.badRequest(`Vendor not found with identifier: ${inputData.vendorId}`);
    }

    const vendorName = vendor.name;
    const vendorCategory = vendor.category || VENDOR_TYPES.FEED_MANUFACTURER;
    const vendorGstin = vendor.gstin || inputData.vendorGstin || "";
    const vendorContact = vendor.phone || inputData.vendorContact || "";

    // 2. Validate line items and calculate server-side totals
    // Merge duplicate lines for the same productId server-side
    const mergedLinesMap = new Map();
    for (const rawLine of rawLines) {
      const prodId = rawLine.productId || rawLine.id;
      if (!prodId) throw ApiError.badRequest("Each purchase line must have a valid productId.");
      const qty = Number(rawLine.quantity ?? rawLine.inwardQty ?? rawLine.qty ?? 0);
      const unitCost = Number(rawLine.unitCost ?? rawLine.rate ?? rawLine.costPrice);

      if (mergedLinesMap.has(prodId)) {
        const existing = mergedLinesMap.get(prodId);
        existing.quantity += qty;
      } else {
        mergedLinesMap.set(prodId, { ...rawLine, productId: prodId, quantity: qty, unitCost });
      }
    }
    const normalizedLines = Array.from(mergedLinesMap.values());

    let calculatedTaxable = 0;
    let calculatedGst = 0;
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

      const rawUnitCost = line.unitCost !== undefined && !isNaN(line.unitCost) ? line.unitCost : prod.costPrice;
      const unitCost = Number(rawUnitCost);
      if (isNaN(unitCost) || !isFinite(unitCost) || unitCost < 0) {
        throw ApiError.badRequest(`Unit cost must be a valid non-negative number for product "${prod.name}" (${prodId}). Received: ${rawUnitCost}`);
      }

      const taxable = Math.round(unitCost * qty * 100) / 100;
      const gstRate = Number(prod.gstRate !== undefined ? prod.gstRate : (line.gstRate || 0));
      const gstAmt = Math.round(taxable * (gstRate / 100) * 100) / 100;
      const lineTotal = Math.round((taxable + gstAmt) * 100) / 100;

      calculatedTaxable += taxable;
      calculatedGst += gstAmt;

      validatedLines.push({
        productId: prodId,
        productName: prod.name,
        quantity: qty,
        unitOfMeasure: prod.unitOfMeasure || prod.unit || "Bags",
        unitCost,
        taxableAmount: taxable,
        gstRate,
        gstAmount: gstAmt,
        lineTotal,
        warehouseLocation: prod.warehouseLocation,
      });

      cachedItemsArray.push({
        productId: prodId,
        description: prod.name,
        qty,
        unit: prod.unitOfMeasure || prod.unit || "Bags",
        rate: unitCost,
        taxable,
        gstRate,
        total: lineTotal,
      });

      /**
       * Task 6: Weighted Average Cost (WAC) Update Formula:
       * New Cost Price = [(Current Stock * Current Cost Price) + (Purchased Qty * Purchase Unit Cost)] / (Current Stock + Purchased Qty)
       * 
       * If Current Stock <= 0 (e.g. zero inventory), the new cost price equals the purchase unit cost.
       */
      const invRow = await Inventory.findOne({ where: { productId: prodId }, transaction: t });
      const currentStockOnHand = Math.max(0, Number(invRow?.currentStock || prod.stock || 0));
      const currentCostPrice = Number(prod.costPrice || prod.purchasePrice || 0);

      let weightedCostPrice = unitCost;
      if (currentStockOnHand > 0 && (currentStockOnHand + qty) > 0) {
        weightedCostPrice = ((currentStockOnHand * currentCostPrice) + (qty * unitCost)) / (currentStockOnHand + qty);
      }
      weightedCostPrice = Math.round(weightedCostPrice * 100) / 100;

      prod.costPrice = weightedCostPrice;
      prod.purchasePrice = weightedCostPrice;
      await prod.save({ transaction: t });
    }

    // Server calculates grandTotal (client cannot submit an arbitrary total)
    const serverCalculatedGrandTotal = Math.round((calculatedTaxable + calculatedGst) * 100) / 100;

    // Server generates sequential purchaseId (client-sent identifiers are ignored)
    const purchaseId = await generatePurchaseNumber(t, businessDateStr);

    // Validate payment if submitted together
    let paidAmount = 0;
    if (inputData.paidAmount !== undefined && inputData.paidAmount !== null && inputData.paidAmount !== "") {
      paidAmount = Number(inputData.paidAmount);
      if (isNaN(paidAmount) || !isFinite(paidAmount) || paidAmount < 0) {
        throw ApiError.badRequest(`Paid amount must be a valid non-negative number. Received: ${inputData.paidAmount}`);
      }
      if (paidAmount > serverCalculatedGrandTotal + 0.005) {
        throw ApiError.badRequest(
          `Initial vendor payment amount (₹${paidAmount}) exceeds purchase grand total (₹${serverCalculatedGrandTotal}). Overpayment is not allowed.`
        );
      }
    }
    paidAmount = Math.round(paidAmount * 100) / 100;
    const balanceDue = Math.round(Math.max(0, serverCalculatedGrandTotal - paidAmount) * 100) / 100;

    if (paidAmount > 0) {
      const payMode = inputData.paymentMode || inputData.paymentMethod;
      if (!payMode || !VALID_VENDOR_PAYMENT_MODES.some((m) => m.toLowerCase() === String(payMode).trim().toLowerCase())) {
        throw ApiError.badRequest(
          `Valid paymentMode is required when recording an initial vendor payment (${VALID_VENDOR_PAYMENT_MODES.join(", ")}). Received: ${payMode || "none"}`
        );
      }
    }

    const status = deriveTransactionStatus({
      grandTotal: serverCalculatedGrandTotal,
      paidAmount,
      dueDate: inputData.dueDate || businessDateStr,
      isCancelled: false,
      asOfDate: getToday(),
    });

    // 3. Create Purchase Header
    const purchase = await Purchase.create(
      {
        purchaseId,
        vendorId: inputData.vendorId,
        vendorName,
        vendorGstin,
        vendorContact,
        vendorInvoiceNo: inputData.vendorInvoiceNo || "",
        date: businessDateStr,
        purchaseDate: businessDateStr,
        dueDate: inputData.dueDate || businessDateStr,
        category: vendorCategory,
        items: cachedItemsArray,
        subtotal: calculatedTaxable,
        taxableAmount: calculatedTaxable,
        taxableTotal: calculatedTaxable,
        gstTotal: calculatedGst,
        grandTotal: serverCalculatedGrandTotal,
        totalAmount: serverCalculatedGrandTotal,
        paidAmount,
        balanceDue,
        paymentStatus: status,
        status,
        paymentMode: inputData.paymentMode || inputData.paymentMethod || null,
        notes: inputData.notes || inputData.remarks || "",
        isCancelled: false,
      },
      { transaction: t }
    );

    // 4. Create Purchase Lines
    for (const vLine of validatedLines) {
      await PurchaseLine.create(
        {
          purchaseId,
          productId: vLine.productId,
          productName: vLine.productName,
          quantity: vLine.quantity,
          unitOfMeasure: vLine.unitOfMeasure,
          unitCost: vLine.unitCost,
          taxableAmount: vLine.taxableAmount,
          gstRate: vLine.gstRate,
          gstAmount: vLine.gstAmount,
          lineTotal: vLine.lineTotal,
        },
        { transaction: t }
      );
    }

    // 5. Record Initial Payment if provided
    if (paidAmount > 0) {
      const payMode = inputData.paymentMode || inputData.paymentMethod;
      if (!payMode) {
        throw ApiError.badRequest("Real paymentMode is required when recording an initial vendor payment.");
      }
      const payNumber = await generateVendorPaymentNumber(t, businessDateStr);
      await VendorPayment.create(
        {
          paymentNumber: payNumber,
          billId: purchaseId,
          vendorId: inputData.vendorId,
          amount: paidAmount,
          paymentDate: new Date(businessDateStr),
          paymentMode: payMode,
          status: "Completed",
          reference: `Initial Payment for ${purchaseId}`,
          notes: inputData.paymentNotes || "",
        },
        { transaction: t }
      );
    }

    // 6. Record PURCHASE_IN movements in the same transaction
    for (const vLine of validatedLines) {
      await applyStockChange(vLine.productId, vLine.quantity, {
        movementType: "PURCHASE_IN",
        referenceType: "PURCHASE_BILL",
        reference: purchaseId,
        warehouseLocation: vLine.warehouseLocation || "Main Warehouse - Bay 01",
        date: new Date(businessDateStr),
        transaction: t,
      });
    }

    // 7. Update Vendor Balances
    vendor.totalOrders = Number(vendor.totalOrders || 0) + 1;
    vendor.totalPurchases = Number(vendor.totalPurchases || 0) + serverCalculatedGrandTotal;
    vendor.outstandingPayable = Number(vendor.outstandingPayable || 0) + balanceDue;
    await vendor.save({ transaction: t });

    await t.commit();

    const created = await Purchase.findOne({
      where: { purchaseId },
      include: [{ model: PurchaseLine, as: "lines" }, { model: VendorPayment, as: "vendorPayments" }],
    });

    return ApiResponse.created(res, created, `Purchase bill ${purchaseId} created and stock inward recorded.`);
  } catch (error) {
    await t.rollback();
    throw error;
  }
});

/**
 * Edit non-financial purchase metadata (notes, dueDate, vendorInvoiceNo)
 * Financial modifications require bill cancellation and re-creation.
 */
export const updatePurchase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { notes, remarks, dueDate, vendorInvoiceNo } = req.body;

  const t = await sequelize.transaction();
  try {
    const purchase = await Purchase.findOne({
      where: {
        [Op.or]: [{ purchaseId: id }, ...(isNaN(id) ? [] : [{ id: Number(id) }])],
      },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!purchase) {
      throw ApiError.notFound(`Purchase not found with identifier: ${id}`);
    }
    if (purchase.isCancelled) {
      throw ApiError.badRequest("Cannot edit a cancelled purchase bill. Historical records are locked.");
    }

    if (notes !== undefined) purchase.notes = notes;
    if (remarks !== undefined) purchase.notes = remarks;
    if (vendorInvoiceNo !== undefined) purchase.vendorInvoiceNo = vendorInvoiceNo;
    if (dueDate !== undefined) {
      purchase.dueDate = dueDate;
      purchase.status = deriveTransactionStatus({
        grandTotal: Number(purchase.grandTotal || 0),
        paidAmount: Number(purchase.paidAmount || 0),
        dueDate: purchase.dueDate,
        isCancelled: false,
        asOfDate: getToday(),
      });
      purchase.paymentStatus = purchase.status;
    }

    await purchase.save({ transaction: t });
    await t.commit();

    return ApiResponse.success(res, purchase, "Purchase metadata updated successfully");
  } catch (err) {
    await t.rollback();
    throw err;
  }
});

/**
 * Record payment to vendor against purchase bill
 * Safe concurrency with row lock on Purchase, rejects overpayment, cancelled documents, and invalid modes.
 */
export const recordVendorPayment = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { paymentAmount, paymentMode, paymentDate, referenceNo, notes, reference } = req.body;

  const amount = Number(paymentAmount ?? req.body.amount);
  if (!amount || amount <= 0) {
    throw ApiError.badRequest("Payment amount must be greater than 0");
  }

  if (!paymentMode || !VALID_VENDOR_PAYMENT_MODES.some((m) => m.toLowerCase() === String(paymentMode).trim().toLowerCase())) {
    throw ApiError.badRequest(`Valid paymentMode is required (${VALID_VENDOR_PAYMENT_MODES.join(", ")})`);
  }

  const t = await sequelize.transaction();

  try {
    // Acquire row lock to ensure concurrency safety
    const purchase = await Purchase.findOne({
      where: {
        [Op.or]: [{ purchaseId: id }, ...(isNaN(id) ? [] : [{ id: Number(id) }])],
      },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!purchase) {
      throw ApiError.notFound(`Purchase not found with identifier: ${id}`);
    }
    if (purchase.isCancelled) {
      throw ApiError.badRequest("Cannot record payment against a cancelled purchase bill");
    }

    const currentBalance = Number(purchase.balanceDue ?? Math.max(0, Number(purchase.grandTotal || 0) - Number(purchase.paidAmount || 0)));
    if (amount > currentBalance + 0.005) {
      throw ApiError.badRequest(`Payment amount (₹${amount}) exceeds remaining balance due (₹${currentBalance})`);
    }

    const payDate = paymentDate ? new Date(paymentDate) : new Date();
    const payNumber = await generateVendorPaymentNumber(t, payDate);

    // 1. Create VendorPayment record
    const payment = await VendorPayment.create(
      {
        paymentNumber: payNumber,
        billId: purchase.purchaseId,
        vendorId: purchase.vendorId || "",
        amount,
        paymentDate: payDate,
        paymentMode,
        status: "Completed",
        reference: referenceNo || reference || `Settlement for ${purchase.purchaseId}`,
        notes: notes || "",
      },
      { transaction: t }
    );

    // 2. Derive updated paid amount and status
    const allPayments = await VendorPayment.findAll({
      where: { billId: purchase.purchaseId, status: "Completed" },
      transaction: t,
    });
    const totalPaid = allPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const grandTotal = Number(purchase.grandTotal || 0);
    const balanceDue = Math.max(0, grandTotal - totalPaid);

    const derivedStatus = deriveTransactionStatus({
      grandTotal,
      paidAmount: totalPaid,
      dueDate: purchase.dueDate,
      isCancelled: false,
      asOfDate: getToday(),
    });

    purchase.paidAmount = totalPaid;
    purchase.balanceDue = balanceDue;
    purchase.status = derivedStatus;
    purchase.paymentStatus = derivedStatus;
    purchase.paymentMode = paymentMode;
    await purchase.save({ transaction: t });

    // 3. Update Vendor Outstanding Payable
    if (purchase.vendorId) {
      const vendor = await Vendor.findOne({ where: { vendorId: purchase.vendorId }, transaction: t });
      if (vendor) {
        vendor.outstandingPayable = Math.max(0, Number(vendor.outstandingPayable || 0) - amount);
        await vendor.save({ transaction: t });
      }
    }

    await t.commit();
    return ApiResponse.success(res, { purchase, payment }, "Vendor payment recorded successfully");
  } catch (error) {
    await t.rollback();
    throw error;
  }
});

/**
 * Cancel a purchase bill instead of hard-delete
 * Soft-cancels purchase, reverses inward stock movements, reverses vendor payable
 */
export const deletePurchase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const t = await sequelize.transaction();

  try {
    const purchase = await Purchase.findOne({
      where: {
        [Op.or]: [{ purchaseId: id }, ...(isNaN(id) ? [] : [{ id: Number(id) }])],
      },
      include: [{ model: PurchaseLine, as: "lines" }, { model: VendorPayment, as: "vendorPayments" }],
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!purchase) {
      await t.rollback();
      throw ApiError.notFound(`Purchase not found with identifier: ${id}`);
    }
    if (purchase.isCancelled) {
      await t.commit();
      return ApiResponse.success(res, purchase, "Purchase bill is already cancelled");
    }

    // 1. Reverse stock movements (ADJUSTMENT_OUT / reversal)
    for (const line of purchase.lines || []) {
      await applyStockChange(line.productId, -line.quantity, {
        movementType: "ADJUSTMENT_OUT",
        referenceType: "CANCEL_PURCHASE",
        reference: `Cancelled ${purchase.purchaseId}`,
        warehouseLocation: line.warehouseLocation,
        date: new Date(),
        transaction: t,
      });
    }

    // 2. Mark payments as Cancelled
    await VendorPayment.update(
      { status: "Cancelled", notes: `Cancelled due to purchase ${purchase.purchaseId} cancellation` },
      { where: { billId: purchase.purchaseId }, transaction: t }
    );

    // 3. Soft-cancel the purchase bill header
    const previousBalanceDue = Number(purchase.balanceDue || Math.max(0, Number(purchase.grandTotal || 0) - Number(purchase.paidAmount || 0)));
    purchase.isCancelled = true;
    purchase.status = TRANSACTION_STATUSES.CANCELLED;
    purchase.paymentStatus = TRANSACTION_STATUSES.CANCELLED;
    purchase.balanceDue = 0;
    await purchase.save({ transaction: t });

    // 4. Reverse Vendor totals
    if (purchase.vendorId) {
      const vendor = await Vendor.findOne({ where: { vendorId: purchase.vendorId }, transaction: t, lock: t.LOCK.UPDATE });
      if (vendor) {
        vendor.totalOrders = Math.max(0, Number(vendor.totalOrders || 0) - 1);
        vendor.totalPurchases = Math.max(0, Number(vendor.totalPurchases || 0) - Number(purchase.grandTotal || 0));
        vendor.outstandingPayable = Math.max(
          0,
          Number(vendor.outstandingPayable || 0) - previousBalanceDue
        );
        await vendor.save({ transaction: t });
      }
    }

    await t.commit();
    return ApiResponse.success(res, purchase, "Purchase bill successfully cancelled and stock reversed");
  } catch (error) {
    await t.rollback();
    throw error;
  }
});
