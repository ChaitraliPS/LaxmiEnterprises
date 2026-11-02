import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";

export class Inventory extends Model {
  toJSON() {
    const values = { ...this.get() };
    const extra = values.extraData || {};
    const stockVal = Number(values.currentStock ?? 0);
    const minAlert = Number(values.minStockAlert ?? 10);
    return {
      ...extra,
      ...values,
      id: values.productId || values.id,
      productId: values.productId || values.id,
      product: values.productName || "",
      productName: values.productName || "",
      sku: values.sku || values.productId || "",
      in: extra.in !== undefined ? Number(extra.in) : undefined,
      out: extra.out !== undefined ? Number(extra.out) : undefined,
      stock: stockVal,
      currentStock: stockVal,
      minStockAlert: minAlert,
      location: values.warehouseLocation || "Warehouse A",
      warehouseLocation: values.warehouseLocation || "Warehouse A",
      status: stockVal <= 0 ? "Out of Stock" : stockVal <= minAlert ? "Low Stock" : "In Stock",
    };
  }
}

Inventory.init(
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    productId: { type: DataTypes.STRING(60), allowNull: false, unique: true },
    productName: { type: DataTypes.STRING(200), allowNull: false },
    category: { type: DataTypes.STRING(120), defaultValue: "General" },
    unit: { type: DataTypes.STRING(30), defaultValue: "Bags" },
    currentStock: { type: DataTypes.DECIMAL(12, 2), defaultValue: 0.0 },
    minStockAlert: { type: DataTypes.DECIMAL(12, 2), defaultValue: 10.0 },
    warehouseLocation: { type: DataTypes.STRING(150), defaultValue: "Main Warehouse" },
    lastUpdated: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    extraData: { type: DataTypes.JSON, defaultValue: {} },
  },
  {
    sequelize,
    modelName: "Inventory",
    tableName: "inventory",
    timestamps: true,
  }
);
