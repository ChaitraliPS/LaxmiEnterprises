import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";

export class Sequence extends Model {
  toJSON() {
    const values = { ...this.get() };
    return {
      ...values,
      lastNumber: Number(values.lastNumber || 0),
    };
  }
}

Sequence.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    fiscalYear: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    lastNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    sequelize,
    modelName: "Sequence",
    tableName: "sequences",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["fiscalYear", "type"],
        name: "idx_sequences_fy_type",
      },
    ],
  }
);

