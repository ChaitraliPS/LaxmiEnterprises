import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";

export class Target extends Model {
  toJSON() {
    const values = { ...this.get() };
    return {
      ...values,
      targetAmount: Number(values.targetAmount || 0),
    };
  }
}

Target.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fiscalYear: {
      type: DataTypes.STRING(20),
      allowNull: false,
      comment: "Fiscal Year e.g. 2026-27 or 2025-26",
    },
    quarter: {
      type: DataTypes.STRING(10),
      allowNull: false,
      comment: "Q1, Q2, Q3, or Q4",
    },
    targetAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      comment: "Sales revenue target in INR",
    },
    notes: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
  },
  {
    sequelize,
    modelName: "Target",
    tableName: "targets",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["fiscalYear", "quarter"],
        name: "target_fy_quarter_unique",
      },
    ],
  }
);

