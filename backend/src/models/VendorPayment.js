import { DataTypes, Model } from "sequelize";
import { sequelize } from "../config/db.js";

export class VendorPayment extends Model {
  toJSON() {
    const values = { ...this.get() };
    return {
      ...values,
      amount: Number(values.amount || 0),
    };
  }
}

VendorPayment.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    paymentNumber: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: true,
    },
    billId: {
      type: DataTypes.STRING(60),
      allowNull: false,
      comment: "Reference to Purchase.purchaseId",
    },
    vendorId: {
      type: DataTypes.STRING(60),
      allowNull: true,
      defaultValue: "",
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    paymentDate: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    paymentMode: {
      type: DataTypes.STRING(40),
      allowNull: false,
      comment: "Required real value (NEFT, RTGS, Cheque, UPI, Cash) - no defaults",
    },
    status: {
      type: DataTypes.STRING(30),
      defaultValue: "Completed",
    },
    reference: {
      type: DataTypes.STRING(100),
      defaultValue: "",
      comment: "Bank UTR or Cheque Number",
    },
    notes: {
      type: DataTypes.TEXT,
      defaultValue: "",
    },
  },
  {
    sequelize,
    modelName: "VendorPayment",
    tableName: "vendor_payments",
    timestamps: true,
    indexes: [
      {
        fields: ["billId"],
        name: "idx_vendor_payments_bill_id",
      },
      {
        fields: ["vendorId"],
        name: "idx_vendor_payments_vendor_id",
      },
      {
        fields: ["paymentDate"],
        name: "idx_vendor_payments_date",
      },
    ],
  }
);

