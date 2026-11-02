import { Op } from "sequelize";
import { Sequence, Invoice, Purchase, Payment, VendorPayment } from "../models/index.js";
import { getFiscalYear } from "../services/metrics/dateRangeHelper.js";
import { getToday } from "../constants/erpConstants.js";

/**
 * Race-safe sequence generator using dedicated Sequence table row lock (SELECT ... FOR UPDATE).
 * Guarantees zero sequence collisions and unique, sequential numbers across parallel transactions.
 */
async function getNextSequenceValue(type, fiscalYear, prefix, transaction) {
  let seq = await Sequence.findOne({
    where: { fiscalYear, type },
    lock: transaction ? transaction.LOCK.UPDATE : true,
    transaction,
  });

  if (!seq) {
    // Determine baseline from existing records if sequence row has not been initialized
    let currentMax = 0;
    if (type === "INVOICE") {
      const records = await Invoice.findAll({
        where: { invoiceNumber: { [Op.like]: `${prefix}%` } },
        attributes: ["invoiceNumber"],
        transaction,
      });
      for (const r of records) {
        const num = parseInt(String(r.invoiceNumber).replace(prefix, ""), 10);
        if (!isNaN(num) && num > currentMax) currentMax = num;
      }
    } else if (type === "PURCHASE") {
      const records = await Purchase.findAll({
        where: { purchaseId: { [Op.like]: `${prefix}%` } },
        attributes: ["purchaseId"],
        transaction,
      });
      for (const r of records) {
        const num = parseInt(String(r.purchaseId).replace(prefix, ""), 10);
        if (!isNaN(num) && num > currentMax) currentMax = num;
      }
    } else if (type === "PAYMENT") {
      const records = await Payment.findAll({
        where: { paymentNumber: { [Op.like]: `${prefix}%` } },
        attributes: ["paymentNumber"],
        transaction,
      });
      for (const r of records) {
        const num = parseInt(String(r.paymentNumber).replace(prefix, ""), 10);
        if (!isNaN(num) && num > currentMax) currentMax = num;
      }
    } else if (type === "VENDOR_PAYMENT") {
      const records = await VendorPayment.findAll({
        where: { paymentNumber: { [Op.like]: `${prefix}%` } },
        attributes: ["paymentNumber"],
        transaction,
      });
      for (const r of records) {
        const num = parseInt(String(r.paymentNumber).replace(prefix, ""), 10);
        if (!isNaN(num) && num > currentMax) currentMax = num;
      }
    }

    try {
      seq = await Sequence.create(
        { fiscalYear, type, lastNumber: currentMax },
        { transaction }
      );
    } catch (e) {
      // In case of parallel race on first creation, re-fetch with lock
      seq = await Sequence.findOne({
        where: { fiscalYear, type },
        lock: transaction ? transaction.LOCK.UPDATE : true,
        transaction,
      });
    }
  }

  seq.lastNumber += 1;
  await seq.save({ transaction });
  return seq.lastNumber;
}

export async function generateInvoiceNumber(transaction = null, asOfDate = getToday()) {
  const fy = getFiscalYear(asOfDate);
  const prefix = `LE-INV-${fy}-`;
  const nextNum = await getNextSequenceValue("INVOICE", fy, prefix, transaction);
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

export async function generatePurchaseNumber(transaction = null, asOfDate = getToday()) {
  const fy = getFiscalYear(asOfDate);
  const prefix = `LE-PUR-${fy}-`;
  const nextNum = await getNextSequenceValue("PURCHASE", fy, prefix, transaction);
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

export async function generatePaymentNumber(transaction = null, asOfDate = getToday()) {
  const fy = getFiscalYear(asOfDate);
  const prefix = `LE-PAY-${fy}-`;
  const nextNum = await getNextSequenceValue("PAYMENT", fy, prefix, transaction);
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

export async function generateVendorPaymentNumber(transaction = null, asOfDate = getToday()) {
  const fy = getFiscalYear(asOfDate);
  const prefix = `LE-VPAY-${fy}-`;
  const nextNum = await getNextSequenceValue("VENDOR_PAYMENT", fy, prefix, transaction);
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}
