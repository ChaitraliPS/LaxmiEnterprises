import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";

export class SchemaMigration extends Model {}

SchemaMigration.init(
  {
    name: {
      type: DataTypes.STRING(255),
      primaryKey: true,
      allowNull: false,
    },
    appliedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    modelName: "SchemaMigration",
    tableName: "schema_migrations",
    timestamps: false,
  }
);

