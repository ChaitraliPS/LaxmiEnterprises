import { toInventoryView, applyStockChange } from "../utils/stockSync.js";
import { Op } from "sequelize";
import { Client, Vendor, Product, Inventory, Purchase, Invoice, ExpoLead, Company, Target, Expense } from "../models/index.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { getStockHealth, getStockBalance } from "../services/metrics/stockMetrics.js";
import { getReceivables } from "../services/metrics/salesMetrics.js";
import { getVendorPayables } from "../services/metrics/purchaseMetrics.js";
import { getToday, evaluateStockHealth, canonicalClientType, canonicalVendorType, canonicalProductCategory, calculateCurrentStock } from "../constants/erpConstants.js";

/**
 * Get all ERP data from MySQL database with server-derived metrics
 */
export const getAllData = asyncHandler(async (req, res) => {
  const [clients, vendors, products, inventory, purchases, invoices, expoLeads, company, targets, healthData, receivablesData, payablesData, expenses] = await Promise.all([
    Client.findAll({ order: [["createdAt", "DESC"]] }),
    Vendor.findAll({ order: [["createdAt", "DESC"]] }),
    Product.findAll({ include: [{ model: Inventory, as: "inventory" }], order: [["createdAt", "DESC"]] }),
    Inventory.findAll({ order: [["productName", "ASC"]] }),
    Purchase.findAll({ order: [["createdAt", "DESC"]] }),
    Invoice.findAll({ order: [["createdAt", "DESC"]] }),
    ExpoLead.findAll({ order: [["createdAt", "DESC"]] }),
    Company.findOne({ where: { id: 1 } }),
    Target.findAll({ order: [["fiscalYear", "DESC"], ["quarter", "ASC"]] }),
    getStockHealth(getToday()),
    getReceivables(getToday()),
    getVendorPayables(getToday()),
    Expense.findAll({ order: [["expenseDate", "DESC"], ["createdAt", "DESC"]] }),
  ]);

  const prodMap = new Map(products.map((p) => [p.productId, p]));
  const healthMap = new Map(healthData.products.map((p) => [p.productId, p]));
  const recMap = new Map(receivablesData.clientBreakdown.map((c) => [c.clientId, c]));
  const payMap = new Map(payablesData.vendorBreakdown.map((v) => [v.vendorId, v]));

  return ApiResponse.success(
    res,
    {
      clients: clients.map((c) => {
        const json = c.toJSON();
        const metrics = recMap.get(c.clientId);
        const revenue = metrics ? metrics.totalInvoiced : Number(c.revenue || 0);
        const orders = metrics ? metrics.invoiceCount : Number(c.orders || 0);
        const outstanding = metrics ? metrics.outstanding : Number(c.outstandingBalance || 0);
        return {
          ...json,
          clientType: canonicalClientType(c.clientType),
          revenue,
          totalBilled: revenue,
          orders,
          outstandingBalance: outstanding,
          outstanding,
        };
      }),
      vendors: vendors.map((v) => {
        const json = v.toJSON();
        const metrics = payMap.get(v.vendorId);
        const totalBilled = metrics ? metrics.totalBilled : Number(v.totalPurchases || 0);
        const balanceDue = metrics ? metrics.balanceDue : Number(v.outstandingPayable || 0);
        const billCount = metrics ? metrics.billCount : Number(v.totalOrders || 0);
        return {
          ...json,
          category: canonicalVendorType(v.category),
          totalPurchases: totalBilled,
          totalBilled,
          outstandingPayable: balanceDue,
          pendingDues: balanceDue,
          totalOrders: billCount,
        };
      }),
      products: products.map((p) => {
        const json = p.toJSON();
        const metrics = healthMap.get(p.productId);
        const openStock = metrics ? metrics.openingStock : Number(json.openingStock ?? json.extraData?.openingStock ?? 0);
        const inW = metrics ? metrics.totalInward : Number(json.inwardStock ?? json.extraData?.inwardStock ?? 0);
        const outW = metrics ? metrics.totalOut : Number(json.outwardStock ?? json.extraData?.outwardStock ?? 0);
        const balance = metrics ? metrics.currentBalance : calculateCurrentStock({ opening: openStock, inward: inW, outward: outW });
        const valAtCost = metrics ? metrics.valuationAtCost : balance * Number(p.costPrice || 0);
        return {
          ...json,
          stock: balance,
          currentStock: balance,
          openingStock: openStock,
          in: inW,
          inwardStock: inW,
          out: outW,
          outwardStock: outW,
          inventoryValue: valAtCost,
          valuationAtCost: valAtCost,
          unitOfMeasure: p.unitOfMeasure || p.unit || "Bags",
          reorderLevel: p.reorderLevel !== null && p.reorderLevel !== undefined ? Number(p.reorderLevel) : null,
          stockStatus: evaluateStockHealth(balance, p.reorderLevel),
        };
      }),
      inventory: [
        ...inventory.map((i) => {
          const p = prodMap.get(i.productId);
          const metrics = healthMap.get(i.productId);
          const base = toInventoryView(i, p);
          const openStock = metrics ? metrics.openingStock : Number(p?.extraData?.openingStock ?? 0);
          const inW = metrics ? metrics.totalInward : Number(p?.extraData?.inwardStock ?? 0);
          const outW = metrics ? metrics.totalOut : Number(p?.extraData?.outwardStock ?? 0);
          const balance = metrics ? metrics.currentBalance : calculateCurrentStock({ opening: openStock, inward: inW, outward: outW });
          return {
            ...base,
            openingStock: openStock,
            in: inW,
            out: outW,
            inwardStock: inW,
            outwardStock: outW,
            stock: balance,
            currentStock: balance,
            reorderLevel: p?.reorderLevel !== null && p?.reorderLevel !== undefined ? Number(p.reorderLevel) : null,
            status: evaluateStockHealth(balance, p?.reorderLevel),
          };
        }),
        // Purely in-memory presentation for products without a physical inventory table row (ZERO DB WRITES)
        ...products
          .filter((p) => !inventory.some((i) => i.productId === p.productId))
          .map((p) => {
            const metrics = healthMap.get(p.productId);
            const openStock = metrics ? metrics.openingStock : Number(p.extraData?.openingStock ?? 0);
            const inW = metrics ? metrics.totalInward : Number(p.extraData?.inwardStock ?? 0);
            const outW = metrics ? metrics.totalOut : Number(p.extraData?.outwardStock ?? 0);
            const balance = metrics ? metrics.currentBalance : calculateCurrentStock({ opening: openStock, inward: inW, outward: outW });
            return {
              productId: p.productId,
              productName: p.name,
              category: p.category,
              unit: p.unitOfMeasure || p.unit || "Bags",
              currentStock: balance,
              stock: balance,
              openingStock: openStock,
              in: inW,
              out: outW,
              inwardStock: inW,
              outwardStock: outW,
              minStockAlert: Number(p.reorderLevel || 10),
              reorderLevel: p.reorderLevel !== null && p.reorderLevel !== undefined ? Number(p.reorderLevel) : null,
              warehouseLocation: p.warehouseLocation || "Main Warehouse",
              status: evaluateStockHealth(balance, p.reorderLevel),
            };
          }),
      ],
      purchases: purchases.map((p) => p.toJSON()),
      invoices: invoices.map((inv) => inv.toJSON()),
      expoLeads: expoLeads.map((e) => e.toJSON()),
      company: company ? company.toJSON() : null,
      targets: targets.map((t) => t.toJSON()),
      expenses: expenses.map((e) => e.toJSON()),
    },
    "All ERP data retrieved from MySQL database"
  );
});

/**
 * Sync / Save Clients to MySQL (Strictly ignores client-side financial/order math)
 */
export const syncClients = asyncHandler(async (req, res) => {
  const list = Array.isArray(req.body) ? req.body : req.body.clients || [];

  for (const item of list) {
    const clientId = String(item.clientId || item.id || "");
    if (!clientId) continue;

    // Notice: orders, revenue, outstanding, outstandingBalance are derived on server and ignored here
    const data = {
      clientId,
      name: item.name || "Unnamed Client",
      clientType: canonicalClientType(item.clientType || "Farmers"),
      contactPerson: item.contactPerson || "",
      contact: item.contact || item.phone || "",
      email: item.email || "",
      dob: item.dob || "",
      village: item.village || "",
      taluka: item.taluka || "",
      district: item.district || "",
      city: item.city || "",
      address: item.address || "",
      pincode: item.pincode || "",
      gstin: item.gstin || "",
      pan: item.pan || "",
      creditLimit: Number(item.creditLimit || 0),
      status: item.status || "Active",
      tier: item.tier || "Gold",
      paymentTerms: item.paymentTerms || "Net 30",
      milkQuantity: item.milkQuantity || "",
      fatPercentage: item.fatPercentage || "",
      snfPercentage: item.snfPercentage || "",
      chillingCenter: item.chillingCenter || "",
      routeNumber: item.routeNumber || "",
      collectionTiming: item.collectionTiming || "",
      landAcres: item.landAcres || "",
      cropTypes: item.cropTypes || "",
      soilType: item.soilType || "",
      irrigationSource: item.irrigationSource || "",
      kisanCreditCard: item.kisanCreditCard || "",
      subsidyScheme: item.subsidyScheme || "",
      animalDetails: item.animalDetails || "",
      numberOfAnimals: item.numberOfAnimals || "",
      shopLicenseNumber: item.shopLicenseNumber || "",
      distributorName: item.distributorName || "",
      territoryCoverage: item.territoryCoverage || "",
      storageCapacity: item.storageCapacity || "",
      annualTurnover: item.annualTurnover || "",
      primaryFeedCategory: item.primaryFeedCategory || "",
      productTypes: item.productTypes || "",
      brands: item.brands || "",
      companies: item.companies || "",
    };

    const [record, created] = await Client.findOrCreate({
      where: { clientId },
      defaults: {
        ...data,
        orders: 0,
        revenue: 0,
        outstandingBalance: 0,
      },
    });

    if (!created) {
      await record.update(data);
    }
  }

  const [all, recData] = await Promise.all([
    Client.findAll({ order: [["createdAt", "DESC"]] }),
    getReceivables(getToday()),
  ]);
  const recMap = new Map(recData.clientBreakdown.map((c) => [c.clientId, c]));

  const payload = all.map((c) => {
    const json = c.toJSON();
    const metrics = recMap.get(c.clientId);
    return {
      ...json,
      revenue: metrics ? metrics.totalInvoiced : Number(c.revenue || 0),
      orders: metrics ? metrics.invoiceCount : Number(c.orders || 0),
      outstandingBalance: metrics ? metrics.outstanding : Number(c.outstandingBalance || 0),
      outstanding: metrics ? metrics.outstanding : Number(c.outstandingBalance || 0),
    };
  });

  return ApiResponse.success(res, payload, "Clients saved in MySQL");
});

/**
 * Sync / Save Vendors to MySQL (Strictly ignores vendor payable/order math)
 */
export const syncVendors = asyncHandler(async (req, res) => {
  const list = Array.isArray(req.body) ? req.body : req.body.vendors || [];

  for (const item of list) {
    const vendorId = String(item.vendorId || item.id || "");
    if (!vendorId) continue;

    // Notice: totalPurchases, totalOrders, outstandingPayable are derived on server and ignored here
    const data = {
      vendorId,
      name: item.name || "Unnamed Vendor",
      companyName: item.companyName || "",
      category: canonicalVendorType(item.category || "Feed Manufacturer"),
      contactPerson: item.contactPerson || "",
      phone: item.phone || item.contact || "",
      email: item.email || "",
      gstin: item.gstin || "",
      pan: item.pan || "",
      village: item.village || "",
      taluka: item.taluka || "",
      district: item.district || "",
      city: item.city || "",
      state: item.state || "Maharashtra",
      pincode: item.pincode || "",
      address: item.address || "",
      bankName: item.bankName || "",
      accountNumber: item.accountNumber || "",
      ifscCode: item.ifscCode || "",
      paymentTerms: item.paymentTerms || "Net 15 Days",
      status: item.status || "Active",
      notes: item.notes || "",
    };

    const [record, created] = await Vendor.findOrCreate({
      where: { vendorId },
      defaults: {
        ...data,
        totalPurchases: 0,
        totalOrders: 0,
        outstandingPayable: 0,
      },
    });

    if (!created) {
      await record.update(data);
    }
  }

  const [all, payData] = await Promise.all([
    Vendor.findAll({ order: [["createdAt", "DESC"]] }),
    getVendorPayables(getToday()),
  ]);
  const payMap = new Map(payData.vendorBreakdown.map((v) => [v.vendorId, v]));

  const payload = all.map((v) => {
    const json = v.toJSON();
    const metrics = payMap.get(v.vendorId);
    return {
      ...json,
      totalPurchases: metrics ? metrics.totalBilled : Number(v.totalPurchases || 0),
      totalBilled: metrics ? metrics.totalBilled : Number(v.totalPurchases || 0),
      outstandingPayable: metrics ? metrics.balanceDue : Number(v.outstandingPayable || 0),
      pendingDues: metrics ? metrics.balanceDue : Number(v.outstandingPayable || 0),
      totalOrders: metrics ? metrics.billCount : Number(v.totalOrders || 0),
    };
  });

  return ApiResponse.success(res, payload, "Vendors saved in MySQL");
});

/**
 * POST /sync/invoices is permanently disabled (HTTP 410 Gone)
 * Invoices must be created via POST /api/v1/invoices and updated via PUT /api/v1/invoices/:id
 */
export const syncInvoices = asyncHandler(async (req, res) => {
  return res.status(410).json({
    success: false,
    message: "POST /sync/invoices is permanently disabled. Use POST /api/v1/invoices for transactional creation and PUT /api/v1/invoices/:id for metadata updates.",
  });
});

/**
 * POST /sync/purchases is permanently disabled (HTTP 410 Gone)
 * Purchases must be created via POST /api/v1/purchases and updated via PUT /api/v1/purchases/:id
 */
export const syncPurchases = asyncHandler(async (req, res) => {
  return res.status(410).json({
    success: false,
    message: "POST /sync/purchases is permanently disabled. Use POST /api/v1/purchases for transactional creation and PUT /api/v1/purchases/:id for metadata updates.",
  });
});

/**
 * Sync / Save Products to MySQL (Synchronizes catalog and stock ledger integrity)
 */
export const syncProducts = asyncHandler(async (req, res) => {
  const list = Array.isArray(req.body) ? req.body : req.body.products || [];

  for (const item of list) {
    const productId = String(item.productId || item.id || "");
    if (!productId) continue;

    let openingStock = Math.max(0, Number(item.openingStock ?? 0));
    let inwardStock = Math.max(0, Number(item.inwardStock ?? 0));
    const outwardStock = Math.max(0, Number(item.outwardStock ?? 0));

    let requestedStock = calculateCurrentStock({ opening: openingStock, inward: inwardStock, outward: outwardStock });
    if (requestedStock === 0 && Number(item.stock ?? item.currentStock ?? 0) > 0) {
      requestedStock = Number(item.stock ?? item.currentStock ?? 0);
      if (openingStock === 0 && inwardStock === 0) {
        openingStock = requestedStock;
      }
    }

    const extraData = {
      ...(item.extraData || {}),
      stock: requestedStock,
      openingStock,
      inwardStock,
      outwardStock,
      minStock: item.minStock || item.reorderLevel || 10,
    };
    delete extraData.reservedStock;

    const productData = {
      productId,
      name: item.name || "Product",
      category: canonicalProductCategory(item.category || "Animal Feed"),
      sku: item.sku || productId,
      hsnCode: item.hsnCode || "",
      unit: item.unit || item.unitOfMeasure || "Bags",
      unitOfMeasure: item.unitOfMeasure || item.unit || "Bags",
      purchasePrice: Number(item.purchasePrice || item.costPrice || 0),
      costPrice: Number(item.costPrice || item.purchasePrice || 0),
      sellingPrice: Number(item.sellingPrice || item.price || 0),
      gstRate: Number(item.gstRate || 18),
      reorderLevel: item.reorderLevel !== null && item.reorderLevel !== undefined ? Number(item.reorderLevel) : null,
      warehouseLocation: item.warehouseLocation || "Main Warehouse - Bay 01",
      description: item.description || "",
      extraData,
    };

    const [record, created] = await Product.findOrCreate({
      where: { productId },
      defaults: productData,
    });

    if (!created) {
      await record.update(productData);
    }

    // Keep Inventory catalog metadata in sync
    let inv = await Inventory.findOne({ where: { productId } });
    if (!inv) {
      inv = await Inventory.create({
        productId,
        productName: record.name,
        category: record.category,
        unit: record.unit,
        currentStock: requestedStock,
        minStockAlert: Number(item.reorderLevel ?? item.minStockAlert ?? 10),
        warehouseLocation: item.warehouseLocation || "Main Warehouse - Bay 01",
      });
    } else {
      await inv.update({
        productName: record.name,
        category: record.category,
        unit: record.unit,
        currentStock: requestedStock,
        minStockAlert: Number(item.reorderLevel ?? inv.minStockAlert),
        warehouseLocation: item.warehouseLocation || inv.warehouseLocation,
      });
    }

    // Ensure OPENING movement exists in ledger if product has opening stock
    const existingOpening = await StockMovement.findOne({
      where: { productId, movementType: "OPENING" },
    });

    if (!existingOpening && openingStock > 0) {
      await StockMovement.create({
        productId,
        movementType: "OPENING",
        quantity: openingStock,
        direction: "IN",
        quantityChange: openingStock,
        balanceAfter: openingStock,
        referenceType: "OPENING",
        referenceId: "INITIAL-STOCK",
        warehouseLocation: item.warehouseLocation || "Main Warehouse - Bay 01",
        notes: `Opening stock baseline for ${record.name}`,
      });
    }

    if (created && inwardStock > 0) {
      await StockMovement.create({
        productId,
        movementType: "ADJUSTMENT_IN",
        quantity: inwardStock,
        direction: "IN",
        quantityChange: inwardStock,
        balanceAfter: openingStock + inwardStock,
        referenceType: "INWARD",
        referenceId: "INITIAL-INWARD",
        warehouseLocation: item.warehouseLocation || "Main Warehouse - Bay 01",
        notes: `Initial inward received for ${record.name}`,
      });
    } else if (!created && item.stock !== undefined) {
      const balanceInfo = await getStockBalance(productId);
      const delta = requestedStock - balanceInfo.balance;
      if (delta !== 0) {
        await applyStockChange(productId, delta, {
          movementType: delta > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
          referenceType: "ADJUSTMENT",
          reference: "PRODUCT_UPDATE",
          warehouseLocation: item.warehouseLocation || "Main Warehouse - Bay 01",
          notes: `Stock updated via product edit (${delta > 0 ? "+" : ""}${delta})`,
        });
      }
    }
  }

  const all = await Product.findAll({ order: [["createdAt", "DESC"]] });
  return ApiResponse.success(res, all.map((p) => p.toJSON()), "Products saved in MySQL (stock integrity protected)");
});

/**
 * Sync / Save Inventory to MySQL (Strictly ignores currentStock - stock is ledger-driven)
 */
export const syncInventory = asyncHandler(async (req, res) => {
  const list = Array.isArray(req.body) ? req.body : req.body.inventory || [];

  for (const item of list) {
    const productId = String(item.productId || item.id || "");
    if (!productId) continue;

    const prod = await Product.findOne({ where: { productId } });
    if (!prod) continue;

    const record = await Inventory.findOne({ where: { productId } });
    if (!record) {
      await Inventory.create({
        productId,
        productName: prod.name,
        category: prod.category,
        unit: prod.unit,
        currentStock: 0,
        minStockAlert: Number(item.minStockAlert || 10),
        warehouseLocation: item.warehouseLocation || "Main Warehouse",
      });
    } else {
      // Update only warehouse location and minStockAlert; do NOT overwrite currentStock!
      await record.update({
        minStockAlert: Number(item.minStockAlert ?? record.minStockAlert),
        warehouseLocation: item.warehouseLocation || record.warehouseLocation,
      });
    }
  }

  const all = await Inventory.findAll({ order: [["productName", "ASC"]] });
  return ApiResponse.success(res, all.map((i) => i.toJSON()), "Inventory metadata saved in MySQL");
});

export const syncExpoLeads = asyncHandler(async (req, res) => {
  const list = Array.isArray(req.body) ? req.body : req.body.expoLeads || [];

  for (const item of list) {
    const leadId = String(item.leadId || item.id || "");
    if (!leadId) continue;

    const [record] = await ExpoLead.findOrCreate({
      where: { leadId },
      defaults: {
        leadId,
        expoName: item.expoName || "AgroTech Kisan Mela",
        visitorName: item.visitorName || item.name || "Visitor",
        category: item.category || "Farmer",
        contact: item.contact || item.phone || "",
        email: item.email || "",
        village: item.village || "",
        taluka: item.taluka || "",
        district: item.district || "",
        cattleCount: Number(item.cattleCount || 0),
        status: item.status || "New",
        notes: item.notes || "",
      },
    });

    await record.update({
      visitorName: item.visitorName || item.name || record.visitorName,
      status: item.status || record.status,
      contact: item.contact || item.phone || record.contact,
    });
  }

  const all = await ExpoLead.findAll({ order: [["createdAt", "DESC"]] });
  return ApiResponse.success(res, all.map((e) => e.toJSON()), "Expo Leads saved in MySQL");
});

/**
 * Sync / Save Company Profile to MySQL
 */
export const syncCompany = asyncHandler(async (req, res) => {
  const comp = req.body;
  const [record] = await Company.findOrCreate({
    where: { id: 1 },
    defaults: {
      name: comp.name || "Laxmi Enterprises",
    },
  });

  await record.update({
    name: comp.name || record.name,
    tagline: comp.tagline || record.tagline,
    address: comp.address || record.address,
    gstin: comp.gstin || record.gstin,
    pan: comp.pan || record.pan,
    phone: comp.phone || record.phone,
    email: comp.email || record.email,
    currency: comp.currency || record.currency,
    financialYear: comp.financialYear || record.financialYear,
  });

  return ApiResponse.success(res, record.toJSON(), "Company Profile saved in MySQL");
});
