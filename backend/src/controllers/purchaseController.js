import { Op } from "sequelize";
import { sequelize } from "../config/db.js";
import { Purchase, PurchaseLine, Product, Vendor, VendorPayment, Inventory, StockMovement } from "../models/index.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { updateStock, applyStockChange } from "../utils/stockSync.js";
import { generatePurchaseNumber, generateVendorPaymentNumber } from "../utils/numberSequence.js";
import { getToday, deriveTransactionStatus, TRANSACTION_STATUSES, VENDOR_TYPES, PRODUCT_CATEGORIES } from "../constants/erpConstants.js";

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

    // 6. Record inward stock movements via updateStock in the same transaction
    for (const vLine of validatedLines) {
      await updateStock({
        productId: vLine.productId,
        type: "inward",
        quantity: vLine.quantity,
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
 * Edit Inward Procurement Bill
 * - Supports editing every field on the purchase form.
 * - Updates inventory stock using existing updateStock ONLY.
 * - Updates vendor balances and payables.
 * - Updates or syncs linked vendor payment entries.
 * - Updates product cost price if this purchase is the latest.
 * - Runs in ONE single database transaction with rollback on failure.
 */
export const updatePurchase = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const inputData = { ...req.body };

  const t = await sequelize.transaction();
  try {
    const purchase = await Purchase.findOne({
      where: {
        [Op.or]: [{ purchaseId: id }, ...(isNaN(id) ? [] : [{ id: Number(id) }])],
      },
      include: [
        { model: PurchaseLine, as: "lines" },
        { model: VendorPayment, as: "vendorPayments" },
      ],
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!purchase) {
      throw ApiError.notFound(`Purchase not found with identifier: ${id}`);
    }
    if (purchase.isCancelled) {
      throw ApiError.badRequest("Cannot edit a cancelled purchase bill. Historical records are locked.");
    }

    // 1. Capture old saved purchase data
    const oldVendorId = purchase.vendorId;
    const oldGrandTotal = Number(purchase.grandTotal || 0);
    const oldPaidAmount = Number(purchase.paidAmount || 0);
    const oldBalanceDue = Number(purchase.balanceDue ?? Math.max(0, oldGrandTotal - oldPaidAmount));
    const oldDate = purchase.purchaseDate || purchase.date;

    const oldLine = purchase.lines && purchase.lines.length > 0 ? purchase.lines[0] : null;
    const oldProductId = oldLine?.productId || (Array.isArray(purchase.items) && purchase.items[0]?.productId) || "";
    const oldQty = Number(oldLine?.quantity ?? (Array.isArray(purchase.items) && purchase.items[0]?.qty) ?? 0);
    const oldUnitCost = Number(oldLine?.unitCost ?? (Array.isArray(purchase.items) && purchase.items[0]?.rate) ?? 0);
    const oldUnit = oldLine?.unitOfMeasure || (Array.isArray(purchase.items) && purchase.items[0]?.unit) || "Bags";
    const oldGstRate = Number(oldLine?.gstRate !== undefined ? oldLine.gstRate : (purchase.gstTotal && purchase.subtotal ? Math.round((Number(purchase.gstTotal) / Number(purchase.subtotal)) * 100) : 0));

    // 2. Resolve new fields
    const hasFinancialInputs =
      inputData.inwardQty !== undefined ||
      inputData.quantity !== undefined ||
      inputData.unitRate !== undefined ||
      inputData.rate !== undefined ||
      inputData.unitCost !== undefined ||
      inputData.gstRate !== undefined ||
      inputData.paidAmount !== undefined ||
      (inputData.productId !== undefined && inputData.productId !== oldProductId) ||
      (inputData.vendorId !== undefined && inputData.vendorId !== oldVendorId);

    // If purchase has no line items, or if this is a metadata-only update on a bill without lines:
    if (!oldProductId || (!hasFinancialInputs && oldQty === 0)) {
      if (inputData.notes !== undefined) purchase.notes = inputData.notes;
      if (inputData.remarks !== undefined) purchase.notes = inputData.remarks;
      if (inputData.vendorInvoiceNo !== undefined) purchase.vendorInvoiceNo = inputData.vendorInvoiceNo;
      if (inputData.billNumber !== undefined) purchase.vendorInvoiceNo = inputData.billNumber;
      if (inputData.dueDate !== undefined) {
        purchase.dueDate = inputData.dueDate;
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
    }

    const newVendorId = inputData.vendorId !== undefined ? inputData.vendorId : oldVendorId;
    const newCategory = inputData.category !== undefined ? inputData.category : purchase.category;
    const newProductId = inputData.productId !== undefined ? inputData.productId : oldProductId;

    if (!newProductId) {
      throw ApiError.badRequest("Catalogue product is required for purchase update.");
    }
    if (!newVendorId) {
      throw ApiError.badRequest("Vendor is required for purchase update.");
    }

    const rawQty = inputData.inwardQty !== undefined ? inputData.inwardQty : (inputData.quantity !== undefined ? inputData.quantity : oldQty);
    const newQty = Number(rawQty);
    if (isNaN(newQty) || newQty <= 0) {
      throw ApiError.badRequest(`Inward quantity must be a positive number. Received: ${rawQty}`);
    }

    const rawRate = inputData.unitRate !== undefined ? inputData.unitRate : (inputData.rate !== undefined ? inputData.rate : (inputData.unitCost !== undefined ? inputData.unitCost : oldUnitCost));
    const newRate = Number(rawRate);
    if (isNaN(newRate) || newRate < 0) {
      throw ApiError.badRequest(`Unit purchase rate must be a non-negative number. Received: ${rawRate}`);
    }

    const newUnit = inputData.unit || inputData.unitOfMeasure || oldUnit;
    const newGstRate = Number(inputData.gstRate !== undefined ? inputData.gstRate : oldGstRate);
    if (isNaN(newGstRate) || newGstRate < 0) {
      throw ApiError.badRequest(`GST rate must be a non-negative number. Received: ${inputData.gstRate}`);
    }

    let businessDateStr = inputData.purchaseDate || inputData.date || oldDate;
    if (!businessDateStr || !/^\d{4}-\d{2}-\d{2}/.test(String(businessDateStr))) {
      businessDateStr = getToday();
    } else {
      businessDateStr = String(businessDateStr).slice(0, 10);
    }
    const effectiveDate = businessDateStr;
    const newDueDate = inputData.dueDate || purchase.dueDate || effectiveDate;
    const newPaymentMode = inputData.paymentMode || inputData.paymentMethod || purchase.paymentMode || "RTGS / Bank Transfer";
    const newNotes = inputData.remarks !== undefined ? inputData.remarks : (inputData.notes !== undefined ? inputData.notes : (purchase.notes || ""));
    const newBillNumber = inputData.vendorInvoiceNo !== undefined ? inputData.vendorInvoiceNo : (inputData.billNumber !== undefined ? inputData.billNumber : (purchase.vendorInvoiceNo || ""));

    // 3. Validate catalogue product and category compatibility
    const newProd = await Product.findOne({
      where: { productId: newProductId },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!newProd) {
      throw ApiError.badRequest(`Product "${newProductId}" does not exist in the product master.`);
    }

    const isDairySector = newCategory === "Dairy" || newCategory === VENDOR_TYPES.DAIRY_PROCESSOR;
    const isProdDairy = newProd.category === "Dairy" || newProd.category === PRODUCT_CATEGORIES.DAIRY;
    if (isDairySector !== isProdDairy) {
      throw ApiError.badRequest(
        `Selected product "${newProd.name}" (${newProd.category}) does not match procurement sector "${newCategory}". Please select a valid product.`
      );
    }

    // 4. Validate unit of measurement consistency
    const expectedUnit = newProd.unitOfMeasure || newProd.unit || "Bags";
    if (newUnit.toLowerCase().trim() !== expectedUnit.toLowerCase().trim()) {
      throw ApiError.badRequest(
        `Unit of measurement "${newUnit}" does not match catalogue product unit "${expectedUnit}". Silently converting units is not allowed.`
      );
    }

    // 5. Recalculate financial totals on server
    const newTaxable = Math.round(newQty * newRate * 100) / 100;
    const newGstAmount = Math.round(newTaxable * (newGstRate / 100) * 100) / 100;
    const newGrandTotal = Math.round((newTaxable + newGstAmount) * 100) / 100;

    let newPaidAmount = 0;
    if (inputData.paidAmount !== undefined && inputData.paidAmount !== null && inputData.paidAmount !== "") {
      newPaidAmount = Number(inputData.paidAmount);
    } else {
      if (inputData.paymentStatus === "Paid" || inputData.status === "Paid") {
        newPaidAmount = newGrandTotal;
      } else if (inputData.paymentStatus === "Pending" || inputData.status === "Pending") {
        newPaidAmount = 0;
      } else {
        newPaidAmount = oldPaidAmount;
      }
    }

    if (isNaN(newPaidAmount) || newPaidAmount < 0) {
      throw ApiError.badRequest(`Paid amount must be a non-negative number. Received: ${inputData.paidAmount}`);
    }
    newPaidAmount = Math.round(newPaidAmount * 100) / 100;

    if (newPaidAmount > newGrandTotal + 0.005) {
      throw ApiError.badRequest(
        `Grand total (₹${newGrandTotal}) cannot be less than the amount already paid (₹${newPaidAmount}).`
      );
    }

    const newBalanceDue = Math.round(Math.max(0, newGrandTotal - newPaidAmount) * 100) / 100;

    const derivedStatus = deriveTransactionStatus({
      grandTotal: newGrandTotal,
      paidAmount: newPaidAmount,
      dueDate: newDueDate,
      isCancelled: false,
      asOfDate: getToday(),
    });

    // 6. Stock adjustments using ONLY existing updateStock
    const productChanged = oldProductId && oldProductId !== newProductId;
    if (productChanged) {
      // Outward old quantity from old product
      if (oldQty > 0) {
        const oldInv = await Inventory.findOne({
          where: { productId: oldProductId },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        const oldCurStock = Number(oldInv?.currentStock || 0);
        if (oldQty > oldCurStock) {
          throw ApiError.badRequest(
            `Cannot reduce by ${oldQty}, only ${oldCurStock} available in stock for old product "${oldProductId}"`
          );
        }
        await updateStock({
          productId: oldProductId,
          type: "outward",
          quantity: oldQty,
          referenceType: "PURCHASE_EDIT",
          reference: purchase.purchaseId,
          notes: `Purchase edit: outward old product ${oldProductId} (Bill ${purchase.purchaseId})`,
          warehouseLocation: oldLine?.warehouseLocation || "Main Warehouse",
          date: new Date(effectiveDate),
          transaction: t,
        });
      }

      // Inward new quantity to new product
      await updateStock({
        productId: newProductId,
        type: "inward",
        quantity: newQty,
        referenceType: "PURCHASE_EDIT",
        reference: purchase.purchaseId,
        notes: `Purchase edit: inward new product ${newProductId} (Bill ${purchase.purchaseId})`,
        warehouseLocation: newProd.warehouseLocation || newNotes || "Main Warehouse",
        date: new Date(effectiveDate),
        transaction: t,
      });
    } else {
      // Same product: calculate quantity difference
      const diff = Math.round((newQty - oldQty) * 100) / 100;
      if (diff > 0) {
        await updateStock({
          productId: newProductId,
          type: "inward",
          quantity: diff,
          referenceType: "PURCHASE_EDIT",
          reference: purchase.purchaseId,
          notes: `Purchase edit: inward increase of ${diff} (Bill ${purchase.purchaseId})`,
          warehouseLocation: newProd.warehouseLocation || newNotes || "Main Warehouse",
          date: new Date(effectiveDate),
          transaction: t,
        });
      } else if (diff < 0) {
        const reduction = Math.abs(diff);
        const invRow = await Inventory.findOne({
          where: { productId: newProductId },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        const availableStock = Number(invRow?.currentStock || 0);
        if (reduction > availableStock) {
          throw ApiError.badRequest(
            `Cannot reduce by ${reduction}, only ${availableStock} available in stock`
          );
        }
        await updateStock({
          productId: newProductId,
          type: "outward",
          quantity: reduction,
          referenceType: "PURCHASE_EDIT",
          reference: purchase.purchaseId,
          notes: `Purchase edit: outward reduction of ${reduction} (Bill ${purchase.purchaseId})`,
          warehouseLocation: newProd.warehouseLocation || newNotes || "Main Warehouse",
          date: new Date(effectiveDate),
          transaction: t,
        });
      }
      // If diff === 0: do not touch inventory
    }

    // 7. Update Product Cost Price ONLY if this purchase is the latest purchase of that product
    const newerPurchase = await PurchaseLine.findOne({
      where: {
        productId: newProductId,
        purchaseId: { [Op.ne]: purchase.purchaseId },
      },
      include: [
        {
          model: Purchase,
          as: "purchase",
          where: {
            isCancelled: false,
            [Op.or]: [
              { purchaseDate: { [Op.gt]: effectiveDate } },
              {
                purchaseDate: effectiveDate,
                createdAt: { [Op.gt]: purchase.createdAt },
              },
            ],
          },
        },
      ],
      transaction: t,
    });

    if (!newerPurchase) {
      newProd.costPrice = newRate;
      newProd.purchasePrice = newRate;
      await newProd.save({ transaction: t });
    }

    // 8. Update Vendor totals and payables
    let newVendorRecord = null;
    if (newVendorId !== oldVendorId) {
      // Deduct from old vendor
      if (oldVendorId) {
        const oldVendor = await Vendor.findOne({
          where: { vendorId: oldVendorId },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });
        if (oldVendor) {
          oldVendor.totalOrders = Math.max(0, Number(oldVendor.totalOrders || 0) - 1);
          oldVendor.totalPurchases = Math.max(0, Number(oldVendor.totalPurchases || 0) - oldGrandTotal);
          oldVendor.outstandingPayable = Math.max(0, Number(oldVendor.outstandingPayable || 0) - oldBalanceDue);
          await oldVendor.save({ transaction: t });
        }
      }

      // Add to new vendor
      newVendorRecord = await Vendor.findOne({
        where: { vendorId: newVendorId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (!newVendorRecord) {
        throw ApiError.badRequest(`Vendor not found with identifier: ${newVendorId}`);
      }
      newVendorRecord.totalOrders = Number(newVendorRecord.totalOrders || 0) + 1;
      newVendorRecord.totalPurchases = Number(newVendorRecord.totalPurchases || 0) + newGrandTotal;
      newVendorRecord.outstandingPayable = Number(newVendorRecord.outstandingPayable || 0) + newBalanceDue;
      await newVendorRecord.save({ transaction: t });

      // Move linked VendorPayments to new vendor
      await VendorPayment.update(
        { vendorId: newVendorId },
        { where: { billId: purchase.purchaseId }, transaction: t }
      );
    } else {
      // Same vendor: adjust delta
      newVendorRecord = await Vendor.findOne({
        where: { vendorId: oldVendorId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (newVendorRecord) {
        const grandTotalDelta = newGrandTotal - oldGrandTotal;
        const balanceDueDelta = newBalanceDue - oldBalanceDue;
        newVendorRecord.totalPurchases = Math.max(0, Number(newVendorRecord.totalPurchases || 0) + grandTotalDelta);
        newVendorRecord.outstandingPayable = Math.max(0, Number(newVendorRecord.outstandingPayable || 0) + balanceDueDelta);
        await newVendorRecord.save({ transaction: t });
      }
    }

    // 9. Synchronize linked VendorPayment entry
    const existingPayments = await VendorPayment.findAll({
      where: { billId: purchase.purchaseId },
      order: [["id", "ASC"]],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (paidDiff !== 0) {
      if (newPaidAmount > 0) {
        if (existingPayments.length === 1) {
          const primaryPayment = existingPayments[0];
          primaryPayment.amount = newPaidAmount;
          primaryPayment.paymentMode = newPaymentMode;
          primaryPayment.paymentDate = new Date(effectiveDate);
          primaryPayment.vendorId = newVendorId;
          primaryPayment.status = "Completed";
          primaryPayment.notes = inputData.paymentNotes || primaryPayment.notes || `Updated payment for ${purchase.purchaseId}`;
          await primaryPayment.save({ transaction: t });
        } else if (existingPayments.length > 1) {
          // Multiple payments recorded: adjust difference on the latest payment
          const latestPayment = existingPayments[existingPayments.length - 1];
          const newLatestAmount = Number(latestPayment.amount || 0) + paidDiff;
          if (newLatestAmount > 0) {
            latestPayment.amount = newLatestAmount;
            latestPayment.paymentMode = newPaymentMode;
            latestPayment.vendorId = newVendorId;
            await latestPayment.save({ transaction: t });
          } else {
            // Recalculate across payments if reduction exceeds latest payment
            let remainingToReduce = -paidDiff;
            for (let i = existingPayments.length - 1; i >= 0 && remainingToReduce > 0; i--) {
              const p = existingPayments[i];
              const pAmt = Number(p.amount || 0);
              if (pAmt <= remainingToReduce) {
                remainingToReduce -= pAmt;
                await p.destroy({ transaction: t });
              } else {
                p.amount = pAmt - remainingToReduce;
                remainingToReduce = 0;
                await p.save({ transaction: t });
              }
            }
          }
        } else {
          const payNumber = await generateVendorPaymentNumber(t, effectiveDate);
          await VendorPayment.create(
            {
              paymentNumber: payNumber,
              billId: purchase.purchaseId,
              vendorId: newVendorId,
              amount: newPaidAmount,
              paymentDate: new Date(effectiveDate),
              paymentMode: newPaymentMode,
              status: "Completed",
              reference: `Payment for ${purchase.purchaseId}`,
              notes: inputData.paymentNotes || `Payment for ${purchase.purchaseId}`,
            },
            { transaction: t }
          );
        }
      } else {
        // Amount paid is 0: remove existing payments to avoid phantom payment record
        if (existingPayments.length > 0) {
          await VendorPayment.destroy({
            where: { billId: purchase.purchaseId },
            transaction: t,
          });
        }
      }
    } else if (existingPayments.length > 0 && newVendorId !== oldVendorId) {
      await VendorPayment.update(
        { vendorId: newVendorId },
        { where: { billId: purchase.purchaseId }, transaction: t }
      );
    }

    // 10. Update Bill Date and warehouse notes on existing StockMovement logs for this bill
    await StockMovement.update(
      {
        movementDate: new Date(effectiveDate),
        date: new Date(effectiveDate),
        warehouseLocation: newNotes || "Main Warehouse",
      },
      {
        where: {
          [Op.or]: [{ referenceId: purchase.purchaseId }, { reference: purchase.purchaseId }],
        },
        transaction: t,
      }
    );

    // 11. Update PurchaseLine row
    if (oldLine) {
      oldLine.productId = newProductId;
      oldLine.productName = newProd.name;
      oldLine.quantity = newQty;
      oldLine.unitOfMeasure = newUnit;
      oldLine.unitCost = newRate;
      oldLine.taxableAmount = newTaxable;
      oldLine.gstRate = newGstRate;
      oldLine.gstAmount = newGstAmount;
      oldLine.lineTotal = newGrandTotal;
      oldLine.warehouseLocation = newProd.warehouseLocation || newNotes || "Main Warehouse";
      await oldLine.save({ transaction: t });
    } else {
      await PurchaseLine.create(
        {
          purchaseId: purchase.purchaseId,
          productId: newProductId,
          productName: newProd.name,
          quantity: newQty,
          unitOfMeasure: newUnit,
          unitCost: newRate,
          taxableAmount: newTaxable,
          gstRate: newGstRate,
          gstAmount: newGstAmount,
          lineTotal: newGrandTotal,
          warehouseLocation: newProd.warehouseLocation || newNotes || "Main Warehouse",
        },
        { transaction: t }
      );
    }

    // 12. Update Purchase Header & Audit Trail
    const cachedItems = [
      {
        productId: newProductId,
        description: newProd.name,
        qty: newQty,
        unit: newUnit,
        rate: newRate,
        taxable: newTaxable,
        gstRate: newGstRate,
        total: newGrandTotal,
      },
    ];

    purchase.vendorId = newVendorId;
    purchase.vendorName = newVendorRecord ? newVendorRecord.name : (inputData.vendorName || purchase.vendorName);
    purchase.vendorGstin = newVendorRecord ? (newVendorRecord.gstin || "") : (inputData.vendorGstin || purchase.vendorGstin || "");
    purchase.vendorContact = newVendorRecord ? (newVendorRecord.phone || "") : (inputData.vendorContact || purchase.vendorContact || "");
    purchase.vendorInvoiceNo = newBillNumber;
    purchase.date = effectiveDate;
    purchase.purchaseDate = effectiveDate;
    purchase.dueDate = newDueDate;
    purchase.category = newCategory;
    purchase.items = cachedItems;
    purchase.subtotal = newTaxable;
    purchase.taxableAmount = newTaxable;
    purchase.taxableTotal = newTaxable;
    purchase.gstTotal = newGstAmount;
    purchase.grandTotal = newGrandTotal;
    purchase.totalAmount = newGrandTotal;
    purchase.paidAmount = newPaidAmount;
    purchase.balanceDue = newBalanceDue;
    purchase.paymentStatus = derivedStatus;
    purchase.status = derivedStatus;
    purchase.paymentMode = newPaymentMode;
    purchase.notes = newNotes;

    const extra = { ...(purchase.extraData || {}) };
    const auditTrail = Array.isArray(extra.auditTrail) ? [...extra.auditTrail] : [];
    auditTrail.push({
      action: "PURCHASE_EDIT",
      timestamp: new Date().toISOString(),
      user: req.user?.name || req.user?.email || "Admin",
      changes: {
        quantity: { old: oldQty, new: newQty },
        rate: { old: oldUnitCost, new: newRate },
        grandTotal: { old: oldGrandTotal, new: newGrandTotal },
        paidAmount: { old: oldPaidAmount, new: newPaidAmount },
        vendorId: { old: oldVendorId, new: newVendorId },
        productId: { old: oldProductId, new: newProductId },
        purchaseDate: { old: oldDate, new: effectiveDate },
      },
    });
    extra.auditTrail = auditTrail;
    purchase.extraData = extra;

    await purchase.save({ transaction: t });
    await t.commit();

    const updated = await Purchase.findOne({
      where: { purchaseId: purchase.purchaseId },
      include: [
        { model: PurchaseLine, as: "lines" },
        { model: VendorPayment, as: "vendorPayments" },
        { model: Vendor, as: "vendor" },
      ],
    });

    return ApiResponse.success(res, updated, `Purchase bill ${purchase.purchaseId} updated successfully`);
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
      const vendor = await Vendor.findOne({ where: { vendorId: purchase.vendorId }, transaction: t, lock: t.LOCK.UPDATE });
      if (vendor) {
        vendor.outstandingPayable = Math.max(0, Number(vendor.outstandingPayable || 0) - amount);
        await vendor.save({ transaction: t });
      }
    }

    const updatedPurchase = await Purchase.findOne({
      where: { purchaseId: purchase.purchaseId },
      include: [
        { model: PurchaseLine, as: "lines" },
        { model: VendorPayment, as: "vendorPayments" },
      ],
      transaction: t,
    });

    await t.commit();
    return ApiResponse.success(res, { purchase: updatedPurchase, payment }, "Vendor payment recorded successfully");
  } catch (error) {
    await t.rollback();
    throw error;
  }
});

/**
 * Update an existing vendor payment and adjust purchase bill totals and vendor payable
 */
export const updateVendorPayment = asyncHandler(async (req, res) => {
  const { id, paymentId } = req.params;
  const { paymentAmount, paymentMode, paymentDate, referenceNo, notes, reference } = req.body;
  const rawAmount = paymentAmount !== undefined ? paymentAmount : req.body.amount;
  const newAmount = rawAmount !== undefined && rawAmount !== null && rawAmount !== "" ? Number(rawAmount) : null;

  if (newAmount !== null && (isNaN(newAmount) || newAmount <= 0)) {
    throw ApiError.badRequest("Payment amount must be greater than 0");
  }

  const t = await sequelize.transaction();
  try {
    const purchase = await Purchase.findOne({
      where: {
        [Op.or]: [{ purchaseId: id }, ...(isNaN(id) ? [] : [{ id: Number(id) }])],
      },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!purchase) throw ApiError.notFound(`Purchase not found with identifier: ${id}`);
    if (purchase.isCancelled) throw ApiError.badRequest("Cannot edit payment on a cancelled purchase bill");

    const payment = await VendorPayment.findOne({
      where: {
        billId: purchase.purchaseId,
        [Op.or]: [{ id: paymentId }, { paymentNumber: paymentId }],
      },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });
    if (!payment) throw ApiError.notFound(`Vendor payment ${paymentId} not found for purchase ${id}`);

    const oldAmount = Number(payment.amount || 0);
    const updatedAmount = newAmount !== null ? newAmount : oldAmount;
    const diff = updatedAmount - oldAmount;

    // Check overpayment if amount increased
    const otherPayments = await VendorPayment.findAll({
      where: {
        billId: purchase.purchaseId,
        status: "Completed",
        id: { [Op.ne]: payment.id },
      },
      transaction: t,
    });
    const otherPaid = otherPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const grandTotal = Number(purchase.grandTotal || 0);
    if (otherPaid + updatedAmount > grandTotal + 0.005) {
      throw ApiError.badRequest(`Updated payment amount (₹${updatedAmount}) exceeds purchase grand total (₹${grandTotal})`);
    }

    const payMode = paymentMode || payment.paymentMode;
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

    // 2. Recalculate Purchase totals
    const totalPaid = otherPaid + updatedAmount;
    const balanceDue = Math.max(0, grandTotal - totalPaid);
    const derivedStatus = deriveTransactionStatus({
      grandTotal,
      paidAmount: totalPaid,
      dueDate: purchase.dueDate,
      isCancelled: purchase.isCancelled,
      asOfDate: getToday(),
    });

    purchase.paidAmount = totalPaid;
    purchase.balanceDue = balanceDue;
    purchase.status = derivedStatus;
    purchase.paymentStatus = derivedStatus;
    purchase.paymentMode = payMode;
    if (balanceDue === 0) purchase.paidDate = payDate;
    else if (balanceDue > 0) purchase.paidDate = null;
    await purchase.save({ transaction: t });

    // 3. Update Vendor Outstanding Payable if diff !== 0
    if (diff !== 0 && purchase.vendorId) {
      const vendor = await Vendor.findOne({
        where: { vendorId: purchase.vendorId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (vendor) {
        vendor.outstandingPayable = Math.max(0, Number(vendor.outstandingPayable || 0) - diff);
        await vendor.save({ transaction: t });
      }
    }

    const updatedPurchase = await Purchase.findOne({
      where: { purchaseId: purchase.purchaseId },
      include: [
        { model: PurchaseLine, as: "lines" },
        { model: VendorPayment, as: "vendorPayments" },
      ],
      transaction: t,
    });

    await t.commit();
    return ApiResponse.success(res, { purchase: updatedPurchase, payment }, "Vendor payment updated successfully");
  } catch (error) {
    await t.rollback();
    throw error;
  }
});

/**
 * Delete a vendor payment and restore remaining balance on purchase and vendor payable
 */
export const deleteVendorPayment = asyncHandler(async (req, res) => {
  const { id, paymentId } = req.params;
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

    const payment = await VendorPayment.findOne({
      where: {
        billId: purchase.purchaseId,
        [Op.or]: [{ id: paymentId }, { paymentNumber: paymentId }],
      },
      lock: t.LOCK.UPDATE,
      transaction: t,
    });

    if (!payment) {
      throw ApiError.notFound(`Vendor payment ${paymentId} not found for purchase ${id}`);
    }

    const removedAmount = Number(payment.amount || 0);

    // 1. Delete Payment
    await payment.destroy({ transaction: t });

    // 2. Recalculate remaining payments
    const remainingPayments = await VendorPayment.findAll({
      where: {
        billId: purchase.purchaseId,
        status: "Completed",
      },
      transaction: t,
    });

    const totalPaid = remainingPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const grandTotal = Number(purchase.grandTotal || 0);
    const balanceDue = Math.max(0, grandTotal - totalPaid);
    const derivedStatus = deriveTransactionStatus({
      grandTotal,
      paidAmount: totalPaid,
      dueDate: purchase.dueDate,
      isCancelled: purchase.isCancelled,
      asOfDate: getToday(),
    });

    purchase.paidAmount = totalPaid;
    purchase.balanceDue = balanceDue;
    purchase.status = derivedStatus;
    purchase.paymentStatus = derivedStatus;
    if (balanceDue > 0) purchase.paidDate = null;
    await purchase.save({ transaction: t });

    // 3. Revert Vendor Outstanding Payable
    if (purchase.vendorId) {
      const vendor = await Vendor.findOne({
        where: { vendorId: purchase.vendorId },
        transaction: t,
        lock: t.LOCK.UPDATE,
      });
      if (vendor) {
        vendor.outstandingPayable = Math.max(
          0,
          Number(vendor.outstandingPayable || 0) + removedAmount
        );
        await vendor.save({ transaction: t });
      }
    }

    const updatedPurchase = await Purchase.findOne({
      where: { purchaseId: purchase.purchaseId },
      include: [
        { model: PurchaseLine, as: "lines" },
        { model: VendorPayment, as: "vendorPayments" },
      ],
      transaction: t,
    });

    await t.commit();
    return ApiResponse.success(
      res,
      { purchase: updatedPurchase, remainingPayments },
      "Vendor payment deleted successfully and vendor balance restored"
    );
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

    // 1. Reverse stock movements (outward / reversal via updateStock)
    for (const line of purchase.lines || []) {
      await updateStock({
        productId: line.productId,
        type: "outward",
        quantity: line.quantity,
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
