import React, { useState, useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";

// Modular UI Components
import Layout from "./components/Layout";
import Dashboard from "./components/Dashboard";
import ClientsPage from "./components/ClientsPage";
import VendorsPage from "./components/VendorsPage";
import InvoicesPage from "./components/InvoicesPage";
import PurchasesPage from "./components/PurchasesPage";
import ExpoPage from "./components/ExpoPage";
import RevenuePage from "./components/RevenuePage";
import ProductsPage from "./components/ProductsPage";
import InventoryPage from "./components/InventoryPage";
import DataHubPage from "./components/DataHubPage";
import AdminWorkspace from "./components/AdminWorkspace";
import LoginPage from "./components/LoginPage";

// Services
import { getCurrentUser, logoutUser, verifyCurrentSession } from "./services/authService";
import { erpApi } from "./services/api";

export default function App() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("le_theme");
    return saved === "dark" || saved === "midnight" ? "dark" : "light";
  });

  // Client Directory state with persistence & MySQL sync
  const [clients, setClients] = useState(() => {
    const saved = localStorage.getItem("le_clients");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  const saveClients = (newClients) => {
    setClients(newClients);
    localStorage.setItem("le_clients", JSON.stringify(newClients));
    erpApi.syncClients(newClients).catch((e) => console.warn("Failed to sync clients to DB:", e.message));
  };

  // Vendor Directory state with persistence & MySQL sync (no hardcoded dummy data)
  const [vendors, setVendors] = useState(() => {
    const saved = localStorage.getItem("le_vendors");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  const saveVendors = (newVendors) => {
    setVendors(newVendors);
    localStorage.setItem("le_vendors", JSON.stringify(newVendors));
    erpApi.syncVendors(newVendors).catch((e) => console.warn("Failed to sync vendors to DB:", e.message));
  };

  // Invoices state with persistence & MySQL sync
  const [invoices, setInvoices] = useState(() => {
    const saved = localStorage.getItem("le_invoices");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  const saveInvoices = (newInvoices) => {
    setInvoices(newInvoices);
    localStorage.setItem("le_invoices", JSON.stringify(newInvoices));
    erpApi.syncInvoices(newInvoices).catch((e) => console.warn("Failed to sync invoices to DB:", e.message));
  };

  // Purchases state with persistence & MySQL sync
  const [purchases, setPurchases] = useState(() => {
    const saved = localStorage.getItem("le_purchases");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  const savePurchases = (newPurchases) => {
    setPurchases(newPurchases);
    localStorage.setItem("le_purchases", JSON.stringify(newPurchases));
    erpApi.syncPurchases(newPurchases).catch((e) => console.warn("Failed to sync purchases to DB:", e.message));
  };

  // Expo Leads state with persistence & MySQL sync
  const [expoLeads, setExpoLeads] = useState(() => {
    const saved = localStorage.getItem("le_expo_leads");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  const saveExpoLeads = (newLeads) => {
    setExpoLeads(newLeads);
    localStorage.setItem("le_expo_leads", JSON.stringify(newLeads));
    erpApi.syncExpoLeads(newLeads).catch((e) => console.warn("Failed to sync expo leads to DB:", e.message));
  };

  // Products state with persistence & MySQL sync
  const [products, setProducts] = useState(() => {
    const saved = localStorage.getItem("le_products");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  // Server se products + inventory dobara load (single source of truth = MySQL)
  const refreshStockData = async () => {
    try {
      const res = await erpApi.getAllData();
      const data = res.data;
      if (Array.isArray(data?.products)) {
        setProducts(data.products);
        localStorage.setItem("le_products", JSON.stringify(data.products));
      }
      if (Array.isArray(data?.inventory)) {
        setInventory(data.inventory);
        localStorage.setItem("le_inventory", JSON.stringify(data.inventory));
      }
    } catch (e) {
      console.warn("Failed to refresh stock data:", e.message);
    }
  };

  const saveProducts = (newProducts) => {
    setProducts(newProducts);
    localStorage.setItem("le_products", JSON.stringify(newProducts));

    // Automatically reflect and synchronize products with inventory immediately in state
    setInventory((prevInv) => {
      const prodMap = new Map((newProducts || []).map((p) => [String(p.id || p.productId), p]));
      const existingProductIds = new Set();

      const updatedExisting = (prevInv || [])
        .filter((inv) => prodMap.has(String(inv.productId || inv.id || inv.sku)))
        .map((inv) => {
          const pId = String(inv.productId || inv.id || inv.sku);
          existingProductIds.add(pId);
          const p = prodMap.get(pId);
          const rawStock = Number(p.stock ?? p.currentStock ?? 0);
          return {
            ...inv,
            product: p.name,
            productName: p.name,
            sku: p.sku || inv.sku || pId,
            category: p.category || inv.category,
            unit: p.unit || inv.unit,
            stock: rawStock,
            currentStock: rawStock,
            minStockAlert: Number(p.minStock ?? inv.minStockAlert ?? 10),
            status: rawStock <= 0 ? "Out of Stock" : rawStock <= Number(p.minStock ?? inv.minStockAlert ?? 10) ? "Low Stock" : "In Stock",
          };
        });

      const newEntries = [];
      (newProducts || []).forEach((p) => {
        const pId = String(p.id || p.productId);
        if (!existingProductIds.has(pId)) {
          const rawStock = Number(p.stock ?? p.currentStock ?? 0);
          const rawIn = Number(p.inwardStock ?? p.openingStock ?? rawStock);
          const rawOut = Number(p.outwardStock ?? 0);
          const minAlert = Number(p.minStock ?? 10);
          newEntries.push({
            id: pId,
            productId: pId,
            product: p.name,
            productName: p.name,
            sku: p.sku || pId,
            category: p.category || "General",
            unit: p.unit || "Bags",
            in: rawIn,
            out: rawOut,
            stock: rawStock,
            currentStock: rawStock,
            minStockAlert: minAlert,
            warehouseLocation: p.warehouseLocation || "Main Warehouse - Bay 01",
            location: p.warehouseLocation || "Main Warehouse - Bay 01",
            status: rawStock <= 0 ? "Out of Stock" : rawStock <= minAlert ? "Low Stock" : "In Stock",
            lastUpdated: new Date().toISOString(),
          });
        }
      });

      const merged = [...newEntries, ...updatedExisting];
      localStorage.setItem("le_inventory", JSON.stringify(merged));
      return merged;
    });

    erpApi
      .syncProducts(newProducts)
      .then(refreshStockData)
      .catch((e) => console.warn("Failed to sync products to DB:", e.message));
  };

  // Inventory state with persistence & MySQL sync
  const [inventory, setInventory] = useState(() => {
    const saved = localStorage.getItem("le_inventory");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

  const saveInventory = (newInventory) => {
    setInventory(newInventory);
    localStorage.setItem("le_inventory", JSON.stringify(newInventory));
    erpApi
      .syncInventory(newInventory)
      .then(refreshStockData)
      .catch((e) => console.warn("Failed to sync inventory to DB:", e.message));
  };

  // Admin Profile state (synced with authenticated user from MySQL)
  const [adminProfile, setAdminProfile] = useState(() => {
    const user = getCurrentUser();
    if (user) {
      return {
        name: user.name || "Administrator",
        role: user.role || "Administrator",
        email: user.email || "",
        phone: user.phone || "",
      };
    }
    return {
      name: "Administrator",
      role: "Super Administrator",
      email: "",
      phone: "",
    };
  });

  // Company Profile state with persistence
  const [company, setCompany] = useState(() => {
    const saved = localStorage.getItem("le_company");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      name: "Laxmi Enterprises",
      tagline: "Industrial Supplies, Hardware & Trading",
      gstin: "27AAACL1234F1Z5",
      pan: "AAACL1234F",
      email: "contact@laxmienterprises.com",
      phone: "+91 98765 43210",
      address: "Shop No. 12, Commercial Complex, Near Industrial Estate, Pune - 411038, Maharashtra, India",
      currency: "INR (₹)",
      financialYear: "FY 2026-27"
    };
  });

  // System Preferences state with persistence
  const [systemPrefs, setSystemPrefs] = useState(() => {
    const saved = localStorage.getItem("le_system_prefs");
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return {
      minStockThreshold: 20,
      autoBackup: true,
      orderPrefix: "LE-ORD-",
      invoicePrefix: "LE-INV-",
      paymentTerms: "Net 30 Days",
      currency: "INR (₹)",
      dispatchWarehouse: "Central Warehouse - Bay A"
    };
  });
  
  const [toastMessage, setToastMessage] = useState(null);
  const [currentUser, setCurrentUser] = useState(() => getCurrentUser());

  // Purge legacy mock keys and verify live JWT session on load
  useEffect(() => {
    localStorage.removeItem("le_user_credentials");
    localStorage.removeItem("le_team_members");
    localStorage.removeItem("le_admin_profile");

    verifyCurrentSession().then((user) => {
      if (user) {
        setCurrentUser(user);
        setAdminProfile(prev => ({
          ...prev,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone || prev.phone
        }));
      }
    });

    // Auto-normalize Categories of existing products
    try {
      const storedProds = JSON.parse(localStorage.getItem("le_products") || "[]");
      let prodList = Array.isArray(storedProds) ? [...storedProds] : [];
      let prodsUpdated = false;

      // Map any legacy categories (Hardware, Electrical, etc.) to valid agribusiness sectors
      prodList = prodList.map(p => {
        let cat = p.category;
        if (!["Animal Feed", "Dairy Milk", "Farmer Direct"].includes(cat)) {
          cat = cat === "Dairy" ? "Dairy Milk" : cat === "Farmers" ? "Farmer Direct" : "Animal Feed";
          prodsUpdated = true;
          return { ...p, category: cat };
        }
        return p;
      });

      if (prodsUpdated) {
        setProducts(prodList);
        localStorage.setItem("le_products", JSON.stringify(prodList));
        erpApi.syncProducts(prodList).catch(() => {});
      }

      // Auto-normalize Categories of existing vendors
      const storedVendors = JSON.parse(localStorage.getItem("le_vendors") || "[]");
      let vendorList = Array.isArray(storedVendors) ? [...storedVendors] : [];
      let vendorsUpdated = false;
      vendorList = vendorList.map(v => {
        const c = String(v.category || "").trim().toLowerCase();
        let target = "Animal Feed Shop";
        if (c.includes("dairy") || c.includes("milk")) target = "Dairy";
        else if (c.includes("farm")) target = "Farmers";
        else target = "Animal Feed Shop";

        if (v.category !== target) {
          vendorsUpdated = true;
          return { ...v, category: target };
        }
        return v;
      });
      if (vendorsUpdated) {
        setVendors(vendorList);
        localStorage.setItem("le_vendors", JSON.stringify(vendorList));
        erpApi.syncVendors(vendorList).catch(() => {});
      }

      // Auto-normalize purchases so that partial payments correctly track paidAmount and balanceDue
      const storedPurchases = JSON.parse(localStorage.getItem("le_purchases") || "[]");
      let purchaseList = Array.isArray(storedPurchases) ? [...storedPurchases] : [];
      let purchasesUpdated = false;
      purchaseList = purchaseList.map(p => {
        const taxable = Number(p.taxableAmount ?? p.amount ?? p.subtotal ?? 0);
        const gst = Number(p.gstAmount ?? p.tax ?? p.cgst ?? 0);
        const total = Number(p.totalAmount ?? p.total ?? p.grandTotal ?? (taxable + gst) ?? 0);
        const status = p.paymentStatus || p.status || "Pending";
        let paid = Number(p.paidAmount ?? 0);
        let changed = false;

        if (status === "Partial" && (paid <= 0 || paid >= total) && total > 0) {
          paid = Math.round(total / 2);
          changed = true;
        } else if (status === "Paid" && paid !== total && total > 0) {
          paid = total;
          changed = true;
        }

        const bal = Math.max(0, total - paid);
        if (p.totalAmount !== total || p.grandTotal !== total || p.paidAmount !== paid || p.balanceDue !== bal || changed) {
          purchasesUpdated = true;
          return {
            ...p,
            totalAmount: total,
            grandTotal: total,
            total: total,
            subtotal: taxable,
            taxableAmount: taxable,
            amount: taxable,
            paidAmount: paid,
            balanceDue: bal,
            paymentStatus: status,
            status: status
          };
        }
        return p;
      });
      if (purchasesUpdated) {
        setPurchases(purchaseList);
        localStorage.setItem("le_purchases", JSON.stringify(purchaseList));
        erpApi.syncPurchases(purchaseList).catch(() => {});
      }

      // Auto-normalize existing invoices with legacy "Hardware" category to "Animal Feed"
      const storedInvoices = JSON.parse(localStorage.getItem("le_invoices") || "[]");
      let invList = Array.isArray(storedInvoices) ? [...storedInvoices] : [];
      let invsUpdated = false;
      invList = invList.map(inv => {
        if (!inv.category || inv.category.toLowerCase().includes("hardware") || inv.category.toLowerCase().includes("industrial")) {
          invsUpdated = true;
          return {
            ...inv,
            category: "Animal Feed"
          };
        }
        return inv;
      });
      if (invsUpdated) {
        setInvoices(invList);
        localStorage.setItem("le_invoices", JSON.stringify(invList));
        erpApi.syncInvoices(invList).catch(() => {});
      }
    } catch (e) {
      console.warn("Auto sync error:", e);
    }
  }, []);

  const showGlobalToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3200);
  };

  const handleLogout = () => {
    logoutUser();
    setCurrentUser(null);
    showGlobalToast("Logged out successfully. Returned to Login screen.");
  };

  const handleLoginSuccess = (user) => {
    setCurrentUser(user);
    if (user.name) {
      setAdminProfile(prev => ({
        ...prev,
        name: user.name,
        role: user.role || prev.role,
        email: user.email || user.username || prev.email,
        phone: user.phone || prev.phone
      }));
    }
    showGlobalToast(`✓ Welcome, ${user.name || user.email}!`);
  };

  const handleExportMaster = () => {
    const masterData = {
      version: "2026.1",
      exportedAt: new Date().toISOString(),
      company,
      clients,
      products,
      inventory,
      invoices,
      purchases,
      expoLeads,
    };
    const blob = new Blob([JSON.stringify(masterData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Laxmi_Enterprises_Master_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showGlobalToast("✓ Exported Consolidated Master ERP Backup (.json)");
  };

  // Cross-Entity Relational Cascade Handlers:
  // 1. Invoice creation cascades to Products & Client Ledger (Backend syncs MySQL inventory)
  const handleCreateInvoiceCascade = (newInvoice) => {
    const updatedInvoices = [newInvoice, ...invoices];
    saveInvoices(updatedInvoices);

    // Products update karo; Inventory backend (syncProducts) khud sync karta hai
    if (Array.isArray(newInvoice.items) && newInvoice.items.length > 0) {
      const updatedProducts = products.map((prod) => {
        const item = newInvoice.items.find((it) => String(it.productId) === String(prod.id));
        if (item) {
          const qty = Number(item.qty) || 0;
          const currentOut = Number(prod.outwardStock || 0);
          const currentStock = Number(prod.stock || prod.currentStock || 0);
          const newStock = Math.max(0, currentStock - qty);
          return {
            ...prod,
            outwardStock: currentOut + (currentStock - newStock),
            stock: newStock,
            currentStock: newStock,
          };
        }
        return prod;
      });
      saveProducts(updatedProducts);
    }

    if (newInvoice.clientId || newInvoice.clientName) {
      const invTotal = Number(newInvoice.total || newInvoice.grandTotal || 0);
      const balanceDue =
        newInvoice.balanceDue !== undefined
          ? Number(newInvoice.balanceDue)
          : newInvoice.status === "Paid"
          ? 0
          : invTotal;

      const updatedClients = clients.map((cl) => {
        if (cl.id === newInvoice.clientId || cl.name === newInvoice.clientName) {
          return {
            ...cl,
            orders: (Number(cl.orders) || 0) + 1,
            revenue: (Number(cl.revenue) || 0) + invTotal,
            outstanding: (Number(cl.outstanding) || 0) + balanceDue,
            outstandingBalance: (Number(cl.outstandingBalance ?? cl.outstanding) || 0) + balanceDue,
          };
        }
        return cl;
      });
      saveClients(updatedClients);
    }
  };

  // 2. Inward Purchase creation cascades to Product & Vendor Ledger (Backend syncs MySQL inventory)
  const handleCreatePurchaseCascade = (newPurchase) => {
    const updatedPurchases = [newPurchase, ...purchases];
    savePurchases(updatedPurchases);

    const prodId = newPurchase.productId;
    const qty = Number(newPurchase.inwardQty || newPurchase.quantity || 1);
    const purchaseRate = Number(newPurchase.unitRate || newPurchase.rate || 0);

    if (prodId) {
      const updatedProducts = products.map((prod) => {
        if (String(prod.id) === String(prodId)) {
          const rawStock = Number(prod.stock || prod.currentStock || 0);
          const rawIn = Number(prod.inwardStock || 0);
          const updatedProd = {
            ...prod,
            inwardStock: rawIn + qty,
            stock: rawStock + qty,
            currentStock: rawStock + qty,
          };
          if (purchaseRate > 0) {
            updatedProd.purchasePrice = purchaseRate;
            updatedProd.costPrice = purchaseRate;
          }
          return updatedProd;
        }
        return prod;
      });
      saveProducts(updatedProducts);
    }

    if (newPurchase.vendorId || newPurchase.vendorName) {
      const pTotal = Number(newPurchase.total || newPurchase.totalAmount || 0);
      const pBal = Number(
        newPurchase.balanceDue !== undefined
          ? newPurchase.balanceDue
          : newPurchase.paymentStatus === "Paid"
          ? 0
          : pTotal
      );

      const updatedVendors = vendors.map((v) => {
        if (
          (newPurchase.vendorId && String(v.vendorId || v.id) === String(newPurchase.vendorId)) ||
          (newPurchase.vendorName && v.name.toLowerCase() === newPurchase.vendorName.toLowerCase())
        ) {
          return {
            ...v,
            totalOrders: (Number(v.totalOrders) || 0) + 1,
            totalPurchases: (Number(v.totalPurchases) || 0) + pTotal,
            outstandingPayable: (Number(v.outstandingPayable) || 0) + pBal,
          };
        }
        return v;
      });
      saveVendors(updatedVendors);
    }
  };

  // 3. Convert Expo Lead to Registered Client Account
  const handleConvertLeadToClient = (lead) => {
    const leadContact = lead.contact || lead.phone || lead.mobile || "";
    const leadName = lead.visitorName || lead.name || "Converted Lead";

    const exists = clients.some(
      (c) => (leadContact && c.contact === leadContact) || c.name.toLowerCase() === leadName.toLowerCase()
    );
    if (exists) {
      showGlobalToast(`⚠️ Account with this contact or name already exists in Client Directory.`);
      return;
    }

    const count = clients.length + 1;
    const newClientId = `CL-${String(count).padStart(3, "0")}`;
    const newClient = {
      id: newClientId,
      clientId: newClientId,
      name: leadName,
      clientType: lead.category === "Dairy" ? "Dairy" : lead.category === "Shopkeeper" ? "Animal Feed Shop" : "Farmers",
      contact: leadContact,
      email: lead.email || "",
      village: lead.village || "",
      taluka: lead.taluka || "",
      district: lead.district || "Pune",
      city: lead.district || "Pune",
      status: "Active",
      tier: "Gold",
      orders: 0,
      revenue: 0,
      outstanding: 0,
      outstandingBalance: 0,
      paymentTerms: "Net 30",
      productTypes: lead.notes || lead.remark || "",
      animalDetails: lead.cattleCount ? `${lead.cattleCount} Dairy Cattle` : "",
      numberOfAnimals: lead.cattleCount ? String(lead.cattleCount) : "",
    };

    saveClients([newClient, ...clients]);

    // Mark lead as Converted
    const updatedLeads = expoLeads.map((l) =>
      l.id === lead.id || l.leadId === lead.leadId ? { ...l, status: "Converted" } : l
    );
    saveExpoLeads(updatedLeads);

    showGlobalToast(`✓ Successfully converted ${newClient.name} into registered Client (${newClientId})!`);
  };

  useEffect(() => {
    const activeTheme = theme === "dark" || theme === "midnight" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", activeTheme);
    localStorage.setItem("le_theme", activeTheme);
  }, [theme]);

  // Load all live ERP records from MySQL database on initial load
  useEffect(() => {
    erpApi
      .getAllData()
      .then((res) => {
        const data = res.data;
        if (data) {
          if (Array.isArray(data.clients)) {
            setClients(data.clients);
            localStorage.setItem("le_clients", JSON.stringify(data.clients));
          }
          if (Array.isArray(data.vendors)) {
            setVendors(data.vendors);
            localStorage.setItem("le_vendors", JSON.stringify(data.vendors));
          }
          if (Array.isArray(data.invoices)) {
            setInvoices(data.invoices);
            localStorage.setItem("le_invoices", JSON.stringify(data.invoices));
          }
          if (Array.isArray(data.purchases)) {
            setPurchases(data.purchases);
            localStorage.setItem("le_purchases", JSON.stringify(data.purchases));
          }
          if (Array.isArray(data.products)) {
            setProducts(data.products);
            localStorage.setItem("le_products", JSON.stringify(data.products));
          }
          if (Array.isArray(data.inventory)) {
            setInventory(data.inventory);
            localStorage.setItem("le_inventory", JSON.stringify(data.inventory));
          }
          if (Array.isArray(data.expoLeads)) {
            setExpoLeads(data.expoLeads);
            localStorage.setItem("le_expo_leads", JSON.stringify(data.expoLeads));
          }
          if (data.company && data.company.name) {
            setCompany(data.company);
            localStorage.setItem("le_company", JSON.stringify(data.company));
          }
        }
      })
      .catch((err) => {
        console.warn("Backend MySQL notice:", err.message);
      });
  }, []);

  // If unauthenticated, show the Login Page directly
  if (!currentUser) {
    return (
      <>
        {toastMessage && (
          <div className="toast-notification" style={{ zIndex: 9999 }}>
            <CheckCircle2 size={18} style={{ color: "var(--success)" }} />
            <span>{toastMessage}</span>
          </div>
        )}
        <LoginPage
          onLoginSuccess={handleLoginSuccess}
          currentTheme={theme}
          onSelectTheme={setTheme}
          showToast={showGlobalToast}
        />
      </>
    );
  }

  return (
    <>
      {toastMessage && (
        <div className="toast-notification" style={{ zIndex: 9999 }}>
          <CheckCircle2 size={18} style={{ color: "var(--success)" }} />
          <span>{toastMessage}</span>
        </div>
      )}

      <Layout 
        currentTheme={theme} 
        onSelectTheme={setTheme}
        adminProfile={adminProfile}
        currentUser={currentUser}
        onLogout={handleLogout}
      >
        <Routes>
          <Route 
            path="/" 
            element={
              <Dashboard 
                clients={clients} 
                products={products} 
                inventory={inventory} 
                invoices={invoices}
                onExportMaster={handleExportMaster}
                adminProfile={adminProfile}
              />
            } 
          />
          <Route 
            path="/login" 
            element={
              <LoginPage 
                onLoginSuccess={handleLoginSuccess}
                currentTheme={theme}
                onSelectTheme={setTheme}
                showToast={showGlobalToast}
              />
            } 
          />
          <Route 
            path="/clients" 
            element={
              <ClientsPage 
                clients={clients} 
                onSaveClients={saveClients} 
                invoices={invoices} 
                onSaveInvoices={saveInvoices}
                onCreateInvoice={handleCreateInvoiceCascade}
                products={products}
                company={company} 
                showToast={showGlobalToast} 
              />
            } 
          />
          <Route 
            path="/vendors" 
            element={
              <VendorsPage 
                vendors={vendors} 
                onSaveVendors={saveVendors}
              />
            } 
          />
          <Route 
            path="/purchases" 
            element={
              <PurchasesPage 
                purchases={purchases} 
                onSavePurchases={savePurchases} 
                onCreatePurchase={handleCreatePurchaseCascade}
                vendors={vendors}
                clients={clients} 
                products={products}
                company={company} 
                showToast={showGlobalToast} 
              />
            } 
          />
          <Route 
            path="/expo" 
            element={
              <ExpoPage 
                expoLeads={expoLeads} 
                onSaveExpoLeads={saveExpoLeads} 
                onConvertToClient={handleConvertLeadToClient}
                company={company} 
                showToast={showGlobalToast} 
              />
            } 
          />
          <Route 
            path="/invoices" 
            element={
              <InvoicesPage 
                invoices={invoices} 
                onSaveInvoices={saveInvoices} 
                onCreateInvoice={handleCreateInvoiceCascade}
                clients={clients} 
                products={products}
                company={company} 
                showToast={showGlobalToast} 
              />
            } 
          />
          <Route 
            path="/revenue" 
            element={
              <RevenuePage 
                clients={clients} 
                invoices={invoices}
                onSaveInvoices={saveInvoices}
                onCreateInvoice={handleCreateInvoiceCascade}
                products={products}
                company={company}
              />
            } 
          />
          <Route 
            path="/products" 
            element={
              <ProductsPage 
                products={products} 
                onSaveProducts={saveProducts}
                inventory={inventory}
              />
            } 
          />
          <Route 
            path="/inventory" 
            element={
              <InventoryPage 
                inventory={inventory} 
                onSaveInventory={saveInventory}
                products={products}
                onSaveProducts={saveProducts}
                onRefresh={refreshStockData}
              />
            } 
          />
          <Route 
            path="/data-hub" 
            element={
              <DataHubPage 
                clients={clients} 
                setClients={saveClients} 
                products={products} 
                setProducts={saveProducts} 
                inventory={inventory} 
                setInventory={saveInventory}
                company={company}
                invoices={invoices}
                purchases={purchases}
                setPurchases={savePurchases}
                expoLeads={expoLeads}
                setExpoLeads={saveExpoLeads}
                showToast={showGlobalToast}
              />
            } 
          />
          <Route 
            path="/workspace" 
            element={
              <AdminWorkspace 
                adminProfile={adminProfile}
                setAdminProfile={setAdminProfile}
                company={company}
                setCompany={setCompany}
                systemPrefs={systemPrefs}
                setSystemPrefs={setSystemPrefs}
              />
            } 
          />
        </Routes>
      </Layout>
    </>
  );
}