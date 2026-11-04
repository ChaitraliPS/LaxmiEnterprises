import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";
import { deriveTransactionStatus, getToday, VENDOR_TYPES } from "../constants/erpConstants.js";

export class Purchase extends Model {
  toJSON() {
    const values = { ...this.get() };
    const extra = values.extraData || {};
    const grandTotal = Number(values.grandTotal ?? values.total ?? values.totalAmount ?? 0);
    const taxableTotal = Number(values.taxableTotal ?? values.subtotal ?? values.amount ?? 0);
    const paidAmount = Number(values.paidAmount ?? 0);
    const balanceDue = values.isCancelled ? 0 : Number(values.balanceDue ?? Math.max(0, grandTotal - paidAmount));
    const gstTotal = Number(values.gstTotal ?? (Number(values.cgst || 0) + Number(values.sgst || 0) + Number(values.igst || 0)));
    const dateVal = values.purchaseDate || values.date || (values.createdAt ? values.createdAt.toISOString().slice(0, 10) : "");
    const dueDateVal = values.dueDate || dateVal;

    const derivedStatus = deriveTransactionStatus({
      grandTotal,
      paidAmount,
      dueDate: dueDateVal,
      isCancelled: Boolean(values.isCancelled),
      asOfDate: getToday(),
    });

    return {
      ...extra,
      ...values,
      id: values.purchaseId || values.id,
      purchaseId: values.purchaseId || values.id,
      date: dateVal,
      purchaseDate: dateVal,
      dueDate: dueDateVal,
      creditDays: Number(values.creditDays || 0),
      totalAmount: grandTotal,
      total: grandTotal,
      grandTotal,
      taxableAmount: taxableTotal,
      taxableTotal,
      amount: taxableTotal,
      subtotal: taxableTotal,
      gstTotal,
      paidAmount,
      balanceDue,
      paymentStatus: derivedStatus,
      status: derivedStatus,
      isCancelled: Boolean(values.isCancelled),
      vendorPayments: values.vendorPayments || values.payments || [],
      payments: values.vendorPayments || values.payments || [],
    };
  }
}

Purchase.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    purchaseId: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: true,
    },
    vendorId: {
      type: DataTypes.STRING(60),
      allowNull: false,
      defaultValue: "",
      comment: "Reference to Vendor.vendorId",
    },
    vendorName: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    vendorGstin: {
      type: DataTypes.STRING(30),
      defaultValue: "",
    },
    vendorContact: {
      type: DataTypes.STRING(30),
      defaultValue: "",
    },
    vendorInvoiceNo: {
      type: DataTypes.STRING(60),
      defaultValue: "",
    },
    date: {
      type: DataTypes.STRING(30),
      defaultValue: "",
    },
    purchaseDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Official transactional procurement date (YYYY-MM-DD)",
    },
    creditDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    dueDate: {
      type: DataTypes.STRING(30),
      defaultValue: "",
    },
    category: {
      type: DataTypes.STRING(120),
      defaultValue: VENDOR_TYPES.FEED_MANUFACTURER,
      comment: "Vendor type enum: Feed Manufacturer, Dairy Processor, Raw Materials Supplier",
    },
    items: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: "Cached array of purchase lines",
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    taxableTotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Sum of line item taxable costs",
    },
    cgst: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    sgst: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    igst: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    gstTotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    grandTotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Server-calculated sum of lines (taxable + GST)",
    },
    paymentStatus: {
      type: DataTypes.STRING(30),
      defaultValue: "Unpaid",
      comment: "Derived dynamically: Unpaid, Partial, Paid, Overdue, Cancelled",
    },
    status: {
      type: DataTypes.STRING(30),
      defaultValue: "Unpaid",
    },
    paidAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Derived from sum of vendor payments in vendor_payments table",
    },
    balanceDue: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    paymentMode: {
      type: DataTypes.STRING(40),
      allowNull: true,
      defaultValue: null,
    },
    isCancelled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: "Soft delete flag for transactional reversal",
    },
    notes: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    extraData: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
  },
  {
    sequelize,
    modelName: "Purchase",
    tableName: "purchases",
    timestamps: true,
    indexes: [
      {
        fields: ["purchaseDate"],
        name: "idx_purchases_purchase_date",
      },
      {
        fields: ["vendorId"],
        name: "idx_purchases_vendor_id",
      },
      {
        fields: ["isCancelled"],
        name: "idx_purchases_is_cancelled",
      },
    ],
  }
);
