import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";
import { PRODUCT_CATEGORIES } from "../constants/erpConstants.js";

export class Product extends Model {
  toJSON() {
    const values = { ...this.get() };
    const extra = values.extraData || {};
    const sp = Number(values.sellingPrice || values.price || 0);
    const cp = Number(values.costPrice || values.purchasePrice || 0);
    const reorder = values.reorderLevel !== null && values.reorderLevel !== undefined ? Number(values.reorderLevel) : null;
    return {
      ...extra,
      ...values,
      id: values.productId || values.id,
      sellingPrice: sp,
      price: sp,
      purchasePrice: cp,
      costPrice: cp,
      unit: values.unitOfMeasure || values.unit || "Bags",
      unitOfMeasure: values.unitOfMeasure || values.unit || "Bags",
      reorderLevel: reorder,
      category: values.category === "Dairy" ? PRODUCT_CATEGORIES.DAIRY : PRODUCT_CATEGORIES.ANIMAL_FEED,
    };
  }
}

Product.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    productId: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    category: {
      type: DataTypes.STRING(120),
      allowNull: false,
      defaultValue: PRODUCT_CATEGORIES.ANIMAL_FEED,
      validate: {
        isIn: [[PRODUCT_CATEGORIES.ANIMAL_FEED, PRODUCT_CATEGORIES.DAIRY]],
      },
      comment: "Single source of category everywhere: Animal Feed or Dairy",
    },
    sku: {
      type: DataTypes.STRING(60),
      defaultValue: "",
    },
    hsnCode: {
      type: DataTypes.STRING(30),
      defaultValue: "",
    },
    unit: {
      type: DataTypes.STRING(30),
      defaultValue: "Bags",
    },
    unitOfMeasure: {
      type: DataTypes.STRING(50),
      defaultValue: "Bags",
      comment: "Standard unit: Bags, Liters, Kg",
    },
    reorderLevel: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      comment: "Minimum reorder threshold. If null, status is Not set",
    },
    warehouseLocation: {
      type: DataTypes.STRING(100),
      defaultValue: "Godown Bay A-1",
      comment: "Default bay or silo location for the product",
    },
    purchasePrice: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0.0,
    },
    costPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Baseline unit cost price of product",
    },
    sellingPrice: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    gstRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 5.0,
      comment: "GST rate % (e.g. 5.00 for Feed, 0.00 for Raw Milk)",
    },
    description: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    extraData: {
      type: DataTypes.JSON,
      defaultValue: {},
    },
  },
  {
    sequelize,
    modelName: "Product",
    tableName: "products",
    timestamps: true,
  }
);
