import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";
import { deriveTransactionStatus, getToday } from "../constants/erpConstants.js";

export class Invoice extends Model {
  toJSON() {
    const values = { ...this.get() };
    const extra = values.extraData || {};
    const grandTotal = Number(values.grandTotal ?? values.total ?? 0);
    const taxableTotal = Number(values.taxableTotal ?? values.subtotal ?? values.amount ?? 0);
    const paidAmount = Number(values.paidAmount || 0);
    const balanceDue = values.isCancelled ? 0 : Number(values.balanceDue ?? Math.max(0, grandTotal - paidAmount));
    const gstTotal = Number(values.gstTotal ?? (Number(values.cgstTotal || 0) + Number(values.sgstTotal || 0) + Number(values.igstTotal || 0)));
    const dateVal = values.invoiceDate || values.date || (values.createdAt ? values.createdAt.toISOString().slice(0, 10) : "");
    const dueDateVal = values.dueDate || dateVal;

    // Dynamically derive transactional status
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
      id: values.invoiceNumber || values.id,
      invoiceNo: values.invoiceNumber,
      date: dateVal,
      invoiceDate: dateVal,
      dueDate: dueDateVal,
      creditDays: Number(values.creditDays || 0),
      total: grandTotal,
      grandTotal,
      amount: taxableTotal,
      subtotal: taxableTotal,
      taxableTotal,
      tax: gstTotal,
      gstTotal,
      totalCost: Number(values.totalCost || 0),
      paidAmount,
      balanceDue,
      status: derivedStatus,
      paymentStatus: derivedStatus,
      isCancelled: Boolean(values.isCancelled),
    };
  }
}

Invoice.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    invoiceNumber: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: true,
    },
    clientId: {
      type: DataTypes.STRING(60),
      allowNull: false,
      comment: "Reference to Client.clientId",
    },
    clientName: {
      type: DataTypes.STRING(200),
      defaultValue: "",
    },
    clientType: {
      type: DataTypes.STRING(60),
      defaultValue: "Feed Shop",
    },
    clientGstin: {
      type: DataTypes.STRING(30),
      defaultValue: "",
    },
    clientContact: {
      type: DataTypes.STRING(30),
      defaultValue: "",
    },
    clientAddress: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    date: {
      type: DataTypes.STRING(30),
      defaultValue: "",
    },
    invoiceDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      comment: "Official transactional invoice date (YYYY-MM-DD)",
    },
    creditDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: "Credit period terms copied from client profile",
    },
    dueDate: {
      type: DataTypes.STRING(30),
      defaultValue: "",
    },
    paidDate: {
      type: DataTypes.DATE,
      allowNull: true,
      comment: "Date when invoice was settled",
    },
    items: {
      type: DataTypes.JSON,
      defaultValue: [],
      comment: "Cached array of line items with snapshot attributes",
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    taxableTotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Sum of line item taxable amounts",
    },
    totalCost: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
      comment: "Sum of (line.costPriceSnapshot * line.quantity)",
    },
    cgstTotal: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    sgstTotal: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    igstTotal: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    gstTotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Total GST tax amount (CGST+SGST+IGST)",
    },
    discountTotal: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    grandTotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Total payable: taxableTotal + gstTotal",
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
      comment: "Derived from sum of verified payments in payments table",
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
    modelName: "Invoice",
    tableName: "invoices",
    timestamps: true,
    indexes: [
      {
        fields: ["invoiceDate"],
        name: "idx_invoices_invoice_date",
      },
      {
        fields: ["clientId"],
        name: "idx_invoices_client_id",
      },
      {
        fields: ["isCancelled"],
        name: "idx_invoices_is_cancelled",
      },
    ],
  }
);
