import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";

export class PurchaseLine extends Model {
  toJSON() {
    const values = { ...this.get() };
    return {
      ...values,
      quantity: Number(values.quantity || 0),
      unitCost: Number(values.unitCost || 0),
      taxableAmount: Number(values.taxableAmount || 0),
      gstRate: Number(values.gstRate || 0),
      gstAmount: Number(values.gstAmount || 0),
      lineTotal: Number(values.lineTotal || 0),
    };
  }
}

PurchaseLine.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    purchaseId: {
      type: DataTypes.STRING(60),
      allowNull: false,
      comment: "Foreign key referencing purchases.purchaseId",
    },
    productId: {
      type: DataTypes.STRING(60),
      allowNull: false,
      comment: "Foreign key referencing products.productId (master data only)",
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
    unitCost: {
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
  },
  {
    sequelize,
    modelName: "PurchaseLine",
    tableName: "purchase_lines",
    timestamps: true,
    indexes: [
      {
        fields: ["purchaseId"],
        name: "idx_purchase_lines_purchase_id",
      },
      {
        fields: ["productId"],
        name: "idx_purchase_lines_product_id",
      },
    ],
  }
);

