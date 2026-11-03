import { sequelize } from "../config/db.js";
import { User } from "./User.js";
import { Client } from "./Client.js";
import { Vendor } from "./Vendor.js";
import { Product } from "./Product.js";
import { Inventory } from "./Inventory.js";
import { Purchase } from "./Purchase.js";
import { Invoice } from "./Invoice.js";
import { ExpoLead } from "./ExpoLead.js";
import { Company } from "./Company.js";
import { Target } from "./Target.js";
import { StockMovement } from "./StockMovement.js";
import { Payment } from "./Payment.js";
import { InvoiceLine } from "./InvoiceLine.js";
import { PurchaseLine } from "./PurchaseLine.js";
import { VendorPayment } from "./VendorPayment.js";
import { Sequence } from "./Sequence.js";
import { SchemaMigration } from "./SchemaMigration.js";
import { Expense } from "./Expense.js";

// Client <-> Invoice
Client.hasMany(Invoice, {
  foreignKey: "clientId",
  sourceKey: "clientId",
  as: "invoices",
  constraints: false,
});
Invoice.belongsTo(Client, {
  foreignKey: "clientId",
  targetKey: "clientId",
  as: "client",
  constraints: false,
});

// Invoice <-> InvoiceLine
Invoice.hasMany(InvoiceLine, {
  foreignKey: "invoiceId",
  sourceKey: "invoiceNumber",
  as: "lines",
  constraints: false,
  onDelete: "CASCADE",
});
InvoiceLine.belongsTo(Invoice, {
  foreignKey: "invoiceId",
  targetKey: "invoiceNumber",
  as: "invoice",
  constraints: false,
});

// Product <-> InvoiceLine
Product.hasMany(InvoiceLine, {
  foreignKey: "productId",
  sourceKey: "productId",
  as: "invoiceLines",
  constraints: false,
});
InvoiceLine.belongsTo(Product, {
  foreignKey: "productId",
  targetKey: "productId",
  as: "product",
  constraints: false,
});

// Vendor <-> Purchase
Vendor.hasMany(Purchase, {
  foreignKey: "vendorId",
  sourceKey: "vendorId",
  as: "purchases",
  constraints: false,
});
Purchase.belongsTo(Vendor, {
  foreignKey: "vendorId",
  targetKey: "vendorId",
  as: "vendor",
  constraints: false,
});

// Purchase <-> PurchaseLine
Purchase.hasMany(PurchaseLine, {
  foreignKey: "purchaseId",
  sourceKey: "purchaseId",
  as: "lines",
  constraints: false,
  onDelete: "CASCADE",
});
PurchaseLine.belongsTo(Purchase, {
  foreignKey: "purchaseId",
  targetKey: "purchaseId",
  as: "purchase",
  constraints: false,
});

// Product <-> PurchaseLine
Product.hasMany(PurchaseLine, {
  foreignKey: "productId",
  sourceKey: "productId",
  as: "purchaseLines",
  constraints: false,
});
PurchaseLine.belongsTo(Product, {
  foreignKey: "productId",
  targetKey: "productId",
  as: "product",
  constraints: false,
});

// Purchase <-> VendorPayment
Purchase.hasMany(VendorPayment, {
  foreignKey: "billId",
  sourceKey: "purchaseId",
  as: "vendorPayments",
  constraints: false,
  onDelete: "CASCADE",
});
VendorPayment.belongsTo(Purchase, {
  foreignKey: "billId",
  targetKey: "purchaseId",
  as: "purchase",
  constraints: false,
});

// Product <-> Inventory
Product.hasOne(Inventory, {
  foreignKey: "productId",
  sourceKey: "productId",
  as: "inventory",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
  hooks: true,
});
Inventory.belongsTo(Product, {
  foreignKey: "productId",
  targetKey: "productId",
  as: "product",
  onDelete: "CASCADE",
  onUpdate: "CASCADE",
});

// Product <-> StockMovement
Product.hasMany(StockMovement, {
  foreignKey: "productId",
  sourceKey: "productId",
  as: "stockMovements",
  constraints: false,
});
StockMovement.belongsTo(Product, {
  foreignKey: "productId",
  targetKey: "productId",
  as: "product",
  constraints: false,
});

// Invoice <-> Payment
Invoice.hasMany(Payment, {
  foreignKey: "invoiceId",
  sourceKey: "invoiceNumber",
  as: "payments",
  constraints: false,
});
Payment.belongsTo(Invoice, {
  foreignKey: "invoiceId",
  targetKey: "invoiceNumber",
  as: "invoice",
  constraints: false,
});

// Client <-> Payment
Client.hasMany(Payment, {
  foreignKey: "clientId",
  sourceKey: "clientId",
  as: "payments",
  constraints: false,
});
Payment.belongsTo(Client, {
  foreignKey: "clientId",
  targetKey: "clientId",
  as: "client",
  constraints: false,
});

export {
  sequelize,
  User,
  Client,
  Vendor,
  Product,
  Inventory,
  Purchase,
  Invoice,
  ExpoLead,
  Company,
  Target,
  StockMovement,
  Payment,
  InvoiceLine,
  PurchaseLine,
  VendorPayment,
  Sequence,
  SchemaMigration,
  Expense,
};
