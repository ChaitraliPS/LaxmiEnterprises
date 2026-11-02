import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";

export class InvoiceLine extends Model {
  toJSON() {
    const values = { ...this.get() };
    return {
      ...values,
      quantity: Number(values.quantity || 0),
      unitPrice: Number(values.unitPrice || 0),
      taxableAmount: Number(values.taxableAmount || 0),
      gstRate: Number(values.gstRate || 0),
      gstAmount: Number(values.gstAmount || 0),
      lineTotal: Number(values.lineTotal || 0),
      costPriceSnapshot: Number(values.costPriceSnapshot || 0),
    };
  }
}

InvoiceLine.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    invoiceId: {
      type: DataTypes.STRING(60),
      allowNull: false,
      comment: "Foreign key referencing invoices.invoiceNumber",
    },
    productId: {
      type: DataTypes.STRING(60),
      allowNull: false,
      comment: "Foreign key referencing products.productId",
    },
    productName: {
      type: DataTypes.STRING(200),
      allowNull: true,
      defaultValue: "",
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 1.0,
    },
    unitOfMeasure: {
      type: DataTypes.STRING(30),
      defaultValue: "Bags",
    },
    unitPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    taxableAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    gstRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    gstAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    lineTotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    costPriceSnapshot: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Snapshot of product costPrice at the exact moment of sale",
    },
  },
  {
    sequelize,
    modelName: "InvoiceLine",
    tableName: "invoice_lines",
    timestamps: true,
    indexes: [
      {
        fields: ["invoiceId"],
        name: "idx_invoice_lines_invoice_id",
      },
      {
        fields: ["productId"],
        name: "idx_invoice_lines_product_id",
      },
    ],
  }
);

