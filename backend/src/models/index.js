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

// Establish relational graph between entities
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

// Automatic Cascade: When a product is deleted, automatically delete corresponding inventory
Product.afterDestroy(async (product, options) => {
  const pId = product.productId || product.id;
  if (pId) {
    await Inventory.destroy({
      where: { productId: pId },
      transaction: options?.transaction,
    });
  }
});

Product.afterBulkDestroy(async (options) => {
  if (options?.where?.productId) {
    await Inventory.destroy({
      where: { productId: options.where.productId },
      transaction: options?.transaction,
    });
  }
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
};
