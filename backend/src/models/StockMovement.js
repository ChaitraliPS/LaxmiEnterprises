import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";

export class StockMovement extends Model {
  toJSON() {
    const values = { ...this.get() };
    const qty = Number(values.quantity || Math.abs(Number(values.quantityChange || 0)));
    const dir = values.direction || (Number(values.quantityChange || 0) >= 0 ? "IN" : "OUT");
    return {
      ...values,
      quantity: qty,
      direction: dir,
      quantityChange: dir === "IN" ? qty : -qty,
      stockBefore: Number(values.stockBefore || 0),
      stockAfter: Number(values.stockAfter || 0),
    };
  }
}

StockMovement.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    productId: {
      type: DataTypes.STRING(60),
      allowNull: false,
      comment: "Reference to Product.productId",
    },
    movementType: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: "INWARD",
      comment: "INWARD, OUTWARD, PURCHASE_IN, SALE_OUT, ADJUSTMENT_IN, ADJUSTMENT_OUT, RETURN",
    },
    quantity: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Always positive quantity transferred",
      validate: {
        min: 0,
      },
    },
    direction: {
      type: DataTypes.ENUM("IN", "OUT"),
      allowNull: false,
      defaultValue: "IN",
      comment: "IN adds to stock balance, OUT subtracts",
    },
    stockBefore: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0.0,
      comment: "Stored inventory currentStock immediately before this movement (history log only)",
    },
    stockAfter: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0.0,
      comment: "Stored inventory currentStock immediately after this movement (history log only)",
    },
    referenceType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "MANUAL",
      comment: "INVOICE, PURCHASE, ADJUSTMENT, OPENING",
    },
    referenceId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: "",
      comment: "Invoice number, purchase order ID, or adjustment reference",
    },
    movementDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      comment: "UTC transaction timestamp",
    },
    warehouseLocation: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "Godown Bay A-1",
      comment: "Warehouse or bay location stored per movement",
    },
    createdBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: "System",
    },
    // Backwards-compatible fields
    quantityChange: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0.0,
      comment: "+ for inward/purchase, - for outward/sale",
    },
    type: {
      type: DataTypes.STRING(30),
      allowNull: true,
      defaultValue: "OPENING",
    },
    reference: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: "",
    },
    date: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: DataTypes.NOW,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "",
    },
  },
  {
    sequelize,
    modelName: "StockMovement",
    tableName: "stock_movements",
    timestamps: true,
    indexes: [
      {
        fields: ["productId"],
        name: "idx_stock_movements_product_id",
      },
      {
        fields: ["movementDate"],
        name: "idx_stock_movements_date",
      },
      {
        fields: ["movementType"],
        name: "idx_stock_movements_type",
      },
      {
        fields: ["direction"],
        name: "idx_stock_movements_direction",
      },
      {
        fields: ["productId", "movementDate"],
        name: "idx_stock_movements_prod_date",
      },
    ],
  }
);
