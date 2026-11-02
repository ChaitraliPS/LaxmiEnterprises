import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";

export class Payment extends Model {
  toJSON() {
    const values = { ...this.get() };
    return {
      ...values,
      amount: Number(values.amount || 0),
    };
  }
}

Payment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    paymentNumber: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: true,
    },
    invoiceId: {
      type: DataTypes.STRING(60),
      allowNull: false,
      comment: "Reference to Invoice.invoiceNumber",
    },
    clientId: {
      type: DataTypes.STRING(60),
      defaultValue: "",
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      validate: {
        min: 0.01,
      },
    },
    paymentDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    paymentMode: {
      type: DataTypes.STRING(40),
      allowNull: false,
      comment: "Real value required: Cash, NEFT, RTGS, Cheque, UPI (no silent default)",
    },
    status: {
      type: DataTypes.STRING(30),
      defaultValue: "Completed",
      comment: "Completed, Cancelled",
    },
    reference: {
      type: DataTypes.STRING(100),
      defaultValue: "",
      comment: "Bank UTR, Transaction Ref, Cheque No",
    },
    notes: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
  },
  {
    sequelize,
    modelName: "Payment",
    tableName: "payments",
    timestamps: true,
    indexes: [
      {
        fields: ["invoiceId"],
        name: "idx_payments_invoice_id",
      },
      {
        fields: ["clientId"],
        name: "idx_payments_client_id",
      },
      {
        fields: ["paymentDate"],
        name: "idx_payments_date",
      },
    ],
  }
);
