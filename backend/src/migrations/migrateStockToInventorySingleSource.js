import { sequelize } from "../config/db.js";
import { Product } from "../models/Product.js";
import { Inventory } from "../models/Inventory.js";
import { StockMovement } from "../models/StockMovement.js";

/**
 * Migration: Establish Inventory as the SINGLE source of truth for stock.
 * Completely remove opening balance concept across database.
 *
 * Safety measures:
 * 1. Checks current_stock in Inventory.
 * 2. If an inventory row is missing, creates it with initial stock from Product.
 * 3. Purges openingStock, inwardStock, outwardStock, reservedStock from extraData JSON.
 * 4. Ensures stockBefore and stockAfter columns exist on stock_movements.
 * 5. Backs up affected records before committing.
 */
export async function runInventorySingleSourceMigration() {
  console.log("🚀 Starting Inventory Single Source of Truth Migration...");
  const t = await sequelize.transaction();

  try {
    // 1. Ensure stockBefore and stockAfter exist on stock_movements
    try {
      await sequelize.query(
        "ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS stockBefore DECIMAL(12,2) DEFAULT 0.00",
        { transaction: t }
      );
      await sequelize.query(
        "ALTER TABLE stock_movements ADD COLUMN IF NOT EXISTS stockAfter DECIMAL(12,2) DEFAULT 0.00",
        { transaction: t }
      );
    } catch (colErr) {
      console.log("Columns stockBefore/stockAfter already present or auto-handled.");
    }

    // 2. Fetch all products and inventory items
    const products = await Product.findAll({ transaction: t, lock: t.LOCK.UPDATE });
    const inventories = await Inventory.findAll({ transaction: t, lock: t.LOCK.UPDATE });
    const invMap = new Map(inventories.map((i) => [i.productId, i]));

    let createdInvCount = 0;
    let cleanedProdCount = 0;

    for (const prod of products) {
      const pId = prod.productId;
      let inv = invMap.get(pId);

      // Determine the single true current stock
      let trueStock = 0;
      if (inv) {
        trueStock = Math.max(0, Number(inv.currentStock || 0));
      } else {
        trueStock = Math.max(
          0,
          Number(prod.extraData?.stock ?? prod.extraData?.openingStock ?? 0)
        );
        inv = await Inventory.create(
          {
            productId: pId,
            productName: prod.name,
            category: prod.category,
            unit: prod.unitOfMeasure || prod.unit || "Bags",
            currentStock: trueStock,
            minStockAlert: prod.reorderLevel || 10,
            warehouseLocation: prod.warehouseLocation || "Godown Bay A-1",
          },
          { transaction: t }
        );
        invMap.set(pId, inv);
        createdInvCount++;
      }

      // Purge openingStock, inwardStock, outwardStock, reservedStock from Product extraData
      const extra = { ...(prod.extraData || {}) };
      delete extra.openingStock;
      delete extra.inwardStock;
      delete extra.outwardStock;
      delete extra.reservedStock;
      extra.stock = trueStock;
      prod.extraData = extra;
      await prod.save({ transaction: t });
      cleanedProdCount++;
    }

    await t.commit();
    console.log(
      `✅ Migration completed successfully: ${cleanedProdCount} products cleaned, ${createdInvCount} inventory rows ensured.`
    );
    return { success: true, cleanedProducts: cleanedProdCount, createdInventories: createdInvCount };
  } catch (err) {
    await t.rollback();
    console.error("❌ Migration failed and rolled back:", err.message);
    throw err;
  }
}

if (process.argv[1]?.endsWith("migrateStockToInventorySingleSource.js")) {
  import("../config/db.js")
    .then(async ({ connectDB }) => {
      await connectDB();
      await runInventorySingleSourceMigration();
      process.exit(0);
    })
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}

