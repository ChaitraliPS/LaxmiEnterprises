import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";

export class Collection extends Model {
  toJSON() {
    const values = { ...this.get() };
    return {
      ...values,
      amount: Number(values.amount || 0),
    };
  }
}

Collection.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    collectionNumber: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: true,
    },
    paymentId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: "Reference to Payment.id",
    },
    invoiceNumber: {
      type: DataTypes.STRING(60),
      allowNull: false,
      comment: "Reference to Invoice.invoiceNumber",
    },
    clientId: {
      type: DataTypes.STRING(60),
      defaultValue: "",
    },
    clientName: {
      type: DataTypes.STRING(200),
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
      comment: "Cash, NEFT, RTGS, Cheque, UPI, etc.",
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
    modelName: "Collection",
    tableName: "collections",
    timestamps: true,
    indexes: [
      {
        fields: ["paymentId"],
        name: "idx_collections_payment_id",
      },
      {
        fields: ["invoiceNumber"],
        name: "idx_collections_invoice_number",
      },
      {
        fields: ["clientId"],
        name: "idx_collections_client_id",
      },
      {
        fields: ["paymentDate"],
        name: "idx_collections_date",
      },
    ],
  }
);

