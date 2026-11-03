import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";

export class Expense extends Model {
  toJSON() {
    const values = { ...this.get() };
    return {
      ...values,
      amount: Number(values.amount || 0),
    };
  }
}

Expense.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    expenseNumber: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
      comment: "Sequential ID e.g. LE-EXP-2026-27-0001",
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      comment: "Description or title of the expense",
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "Miscellaneous",
      comment: "Expense category e.g. Rent, Electricity, Salaries, Transport",
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      validate: {
        min: 0.01,
      },
      comment: "Expense monetary amount in INR",
    },
    expenseDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      comment: "Official transaction date (YYYY-MM-DD)",
    },
    paymentMode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "Cash",
      comment: "Cash, UPI, NEFT, RTGS, Cheque",
    },
    paidTo: {
      type: DataTypes.STRING(255),
      allowNull: true,
      defaultValue: null,
      comment: "Payee / Person / Vendor who received payment",
    },
    referenceNo: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: null,
      comment: "Bill number, voucher number, or bank transaction reference",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
      comment: "Additional notes or remarks",
    },
    createdBy: {
      type: DataTypes.STRING(100),
      allowNull: true,
      defaultValue: "Admin",
    },
  },
  {
    sequelize,
    modelName: "Expense",
    tableName: "expenses",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["expenseNumber"],
        name: "idx_expenses_expense_number",
      },
      {
        fields: ["expenseDate"],
        name: "idx_expenses_date",
      },
      {
        fields: ["category"],
        name: "idx_expenses_category",
      },
    ],
  }
);
