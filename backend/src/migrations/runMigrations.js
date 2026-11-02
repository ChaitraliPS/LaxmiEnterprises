import { sequelize } from "../config/db.js";
import {
  Target,
  StockMovement,
  Payment,
  InvoiceLine,
  PurchaseLine,
  VendorPayment,
  Sequence,
  SchemaMigration,
} from "../models/index.js";

/**
 * Part (a): Safe Schema DDL Migration
 * Creates tables, adds missing columns, and ensures indexes exist.
 * Safe to run on every server startup without modifying any record data.
 */
export async function runSchemaMigrations() {
  console.log("🚀 Verifying / Applying Database Schema (DDL)...");
  const queryInterface = sequelize.getQueryInterface();

  // 1. Safe Column Additions for existing tables (only add if column does not exist)
  // 1.1 Stock Movements table
  const smDesc = await queryInterface.describeTable("stock_movements").catch(() => ({}));
  if (!smDesc.movementType) {
    await queryInterface.addColumn("stock_movements", "movementType", {
      type: sequelize.Sequelize.STRING(40),
      allowNull: true,
      defaultValue: "OPENING",
    });
  }
  if (!smDesc.quantity) {
    await queryInterface.addColumn("stock_movements", "quantity", {
      type: sequelize.Sequelize.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0.0,
    });
  }
  if (!smDesc.direction) {
    await queryInterface.addColumn("stock_movements", "direction", {
      type: sequelize.Sequelize.ENUM("IN", "OUT"),
      allowNull: true,
      defaultValue: "IN",
    });
  }
  if (!smDesc.referenceType) {
    await queryInterface.addColumn("stock_movements", "referenceType", {
      type: sequelize.Sequelize.STRING(50),
      allowNull: true,
      defaultValue: "MANUAL",
    });
  }
  if (!smDesc.referenceId) {
    await queryInterface.addColumn("stock_movements", "referenceId", {
      type: sequelize.Sequelize.STRING(100),
      allowNull: true,
      defaultValue: "",
    });
  }
  if (!smDesc.movementDate) {
    await queryInterface.addColumn("stock_movements", "movementDate", {
      type: sequelize.Sequelize.DATE,
      allowNull: true,
      defaultValue: sequelize.Sequelize.NOW,
    });
  }
  if (!smDesc.warehouseLocation) {
    await queryInterface.addColumn("stock_movements", "warehouseLocation", {
      type: sequelize.Sequelize.STRING(100),
      allowNull: true,
      defaultValue: null,
    });
  }
  if (!smDesc.createdBy) {
    await queryInterface.addColumn("stock_movements", "createdBy", {
      type: sequelize.Sequelize.STRING(100),
      allowNull: true,
      defaultValue: "System",
    });
  }

  // 1.2 Products table
  const prodDesc = await queryInterface.describeTable("products").catch(() => ({}));
  if (!prodDesc.costPrice) {
    await queryInterface.addColumn("products", "costPrice", {
      type: sequelize.Sequelize.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: null,
      comment: "Baseline unit cost price",
    });
  }
  if (!prodDesc.unitOfMeasure) {
    await queryInterface.addColumn("products", "unitOfMeasure", {
      type: sequelize.Sequelize.STRING(50),
      allowNull: true,
      defaultValue: null,
      comment: "Standard unit: Bags, Liters, Kg",
    });
  }
  if (!prodDesc.reorderLevel) {
    await queryInterface.addColumn("products", "reorderLevel", {
      type: sequelize.Sequelize.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: null,
      comment: "Reorder threshold. Null = Not set",
    });
  }
  if (!prodDesc.warehouseLocation) {
    await queryInterface.addColumn("products", "warehouseLocation", {
      type: sequelize.Sequelize.STRING(100),
      allowNull: true,
      defaultValue: null,
    });
  }

  // 1.3 Invoices table
  const invoiceDesc = await queryInterface.describeTable("invoices").catch(() => ({}));
  if (!invoiceDesc.invoiceDate) {
    await queryInterface.addColumn("invoices", "invoiceDate", {
      type: sequelize.Sequelize.DATEONLY,
      allowNull: true,
      comment: "Official transactional invoice date (YYYY-MM-DD)",
    });
  }
  if (!invoiceDesc.creditDays) {
    await queryInterface.addColumn("invoices", "creditDays", {
      type: sequelize.Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: "Payment terms credit days",
    });
  }
  if (!invoiceDesc.taxableTotal) {
    await queryInterface.addColumn("invoices", "taxableTotal", {
      type: sequelize.Sequelize.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: null,
    });
  }
  if (!invoiceDesc.gstTotal) {
    await queryInterface.addColumn("invoices", "gstTotal", {
      type: sequelize.Sequelize.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: null,
    });
  }
  if (!invoiceDesc.isCancelled) {
    await queryInterface.addColumn("invoices", "isCancelled", {
      type: sequelize.Sequelize.BOOLEAN,
      defaultValue: false,
    });
  }
  if (!invoiceDesc.status) {
    await queryInterface.addColumn("invoices", "status", {
      type: sequelize.Sequelize.STRING(30),
      defaultValue: "Unpaid",
    });
  }

  // 1.4 Purchases table
  const purchaseDesc = await queryInterface.describeTable("purchases").catch(() => ({}));
  if (!purchaseDesc.purchaseDate) {
    await queryInterface.addColumn("purchases", "purchaseDate", {
      type: sequelize.Sequelize.DATEONLY,
      allowNull: true,
      comment: "Official transactional procurement date (YYYY-MM-DD)",
    });
  }
  if (!purchaseDesc.creditDays) {
    await queryInterface.addColumn("purchases", "creditDays", {
      type: sequelize.Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
    });
  }
  if (!purchaseDesc.dueDate) {
    await queryInterface.addColumn("purchases", "dueDate", {
      type: sequelize.Sequelize.STRING(30),
      allowNull: true,
      defaultValue: null,
    });
  }
  if (!purchaseDesc.taxableTotal) {
    await queryInterface.addColumn("purchases", "taxableTotal", {
      type: sequelize.Sequelize.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: null,
    });
  }
  if (!purchaseDesc.gstTotal) {
    await queryInterface.addColumn("purchases", "gstTotal", {
      type: sequelize.Sequelize.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: null,
    });
  }
  if (!purchaseDesc.balanceDue) {
    await queryInterface.addColumn("purchases", "balanceDue", {
      type: sequelize.Sequelize.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: null,
    });
  }
  if (!purchaseDesc.status) {
    await queryInterface.addColumn("purchases", "status", {
      type: sequelize.Sequelize.STRING(30),
      defaultValue: "Unpaid",
    });
  }
  if (!purchaseDesc.isCancelled) {
    await queryInterface.addColumn("purchases", "isCancelled", {
      type: sequelize.Sequelize.BOOLEAN,
      defaultValue: false,
    });
  }

  // 1.5 Invoice Lines table
  const ilDesc = await queryInterface.describeTable("invoice_lines").catch(() => ({}));
  if (ilDesc && !ilDesc.costPriceSnapshot) {
    await queryInterface.addColumn("invoice_lines", "costPriceSnapshot", {
      type: sequelize.Sequelize.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: null,
      comment: "Snapshot of product costPrice at the exact moment of sale",
    }).catch(() => {});
  }
  if (ilDesc && !ilDesc.costPrice) {
    await queryInterface.addColumn("invoice_lines", "costPrice", {
      type: sequelize.Sequelize.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: null,
    }).catch(() => {});
  }

  // 2. Ensure all mission-critical tables exist
  await Target.sync();
  await StockMovement.sync();
  await Payment.sync();
  await InvoiceLine.sync();
  await PurchaseLine.sync();
  await VendorPayment.sync();
  await Sequence.sync();
  await SchemaMigration.sync();

  console.log("✓ Schema verification and DDL sync completed successfully.");
}

/**
 * Main Enterprise Database Migration Runner
 * Executes Schema (DDL) migrations safely (zero data modification / zero record insertion or deletion).
 */
export async function runMigrations() {
  console.log("🚀 Starting Enterprise Database Schema Verification...");

  // Safe Schema DDL (column and table existence checks only)
  await runSchemaMigrations();

  console.log("✅ All schemas are up to date with 100% data preservation.");
}

/**
 * Startup Health Check
 * Validates that all mission-critical tables and columns exist in the database.
 */
export async function verifySchemaHealth() {
  const qi = sequelize.getQueryInterface();
  const errors = [];

  const rawTables = await qi.showAllTables();
  const tables = rawTables.map((t) => (typeof t === "object" ? Object.values(t)[0] : t).toLowerCase());
  const requiredTables = [
    "invoices",
    "invoice_lines",
    "purchases",
    "purchase_lines",
    "payments",
    "vendor_payments",
    "stock_movements",
    "products",
    "sequences",
    "clients",
    "vendors",
    "targets",
    "schema_migrations",
  ];
  for (const t of requiredTables) {
    if (!tables.includes(t.toLowerCase())) {
      errors.push(`Missing required table: ${t}`);
    }
  }

  const invCols = await qi.describeTable("invoices").catch(() => ({}));
  if (!invCols.balanceDue) errors.push("Missing required column: invoices.balanceDue");
  if (!invCols.invoiceDate) errors.push("Missing required column: invoices.invoiceDate");
  if (!invCols.isCancelled) errors.push("Missing required column: invoices.isCancelled");

  const ilCols = await qi.describeTable("invoice_lines").catch(() => ({}));
  if (!ilCols.costPriceSnapshot && !ilCols.costPrice) {
    errors.push("Missing required column: invoice_lines.costPriceSnapshot / costPrice");
  }

  const purCols = await qi.describeTable("purchases").catch(() => ({}));
  if (!purCols.balanceDue) errors.push("Missing required column: purchases.balanceDue");

  if (errors.length > 0) {
    console.error("❌ Schema Health Verification Failed:", errors);
    throw new Error(`Schema health verification failed: ${errors.join("; ")}`);
  }
  console.log("✅ Schema Health Verification: All expected tables and columns confirmed present.");
  return true;
}

// Auto-run if executed directly via CLI
if (process.argv[1] && process.argv[1].replace(/\\/g, "/").endsWith("runMigrations.js")) {
  runMigrations()
    .then(() => verifySchemaHealth())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Migration failed:", err);
      process.exit(1);
    });
}
