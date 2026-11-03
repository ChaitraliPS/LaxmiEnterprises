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
import ExpensesPage from "./components/ExpensesPage";
import ProductsPage from "./components/ProductsPage";
import InventoryPage from "./components/InventoryPage";
import DataHubPage from "./components/DataHubPage";
import AdminWorkspace from "./components/AdminWorkspace";
import LoginPage from "./components/LoginPage";

// Services
import { getCurrentUser, logoutUser, verifyCurrentSession } from "./services/authService";
import { erpApi } from "./services/api";
import { getToday, getFiscalYearFormatted } from "./constants/erpConstants";

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

  const saveClients = async (newClients) => {
    setClients(newClients);
    localStorage.setItem("le_clients", JSON.stringify(newClients));
    try {
      await erpApi.syncClients(newClients);
      await fetchMasterDataFromDB();
    } catch (e) {
      console.warn("Failed to sync clients to DB:", e.message);
    }
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

  const saveVendors = async (newVendors) => {
    setVendors(newVendors);
    localStorage.setItem("le_vendors", JSON.stringify(newVendors));
    try {
      await erpApi.syncVendors(newVendors);
      await fetchMasterDataFromDB();
    } catch (e) {
      console.warn("Failed to sync vendors to DB:", e.message);
    }
  };

  // Invoices and Purchases state loaded strictly from GET /sync/all
  const [invoices, setInvoices] = useState([]);
  const [purchases, setPurchases] = useState([]);

  // Operating Expenses state with persistence & MySQL sync
  const [expenses, setExpenses] = useState(() => {
    const saved = localStorage.getItem("le_expenses");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return [];
  });

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

  // Central MySQL Database Synchronization (Master Single Source of Truth)
  const fetchMasterDataFromDB = async () => {
    try {
      const res = await erpApi.getAllData();
      const data = res?.data;
      if (!data) return;

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
      }
      if (Array.isArray(data.purchases)) {
        setPurchases(data.purchases);
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
      if (Array.isArray(data.expenses)) {
        setExpenses(data.expenses);
        localStorage.setItem("le_expenses", JSON.stringify(data.expenses));
      }
      if (data.company && data.company.name) {
        setCompany(data.company);
        localStorage.setItem("le_company", JSON.stringify(data.company));
      }
    } catch (e) {
      console.warn("Failed to sync live data from MySQL:", e.message);
    }
  };
  const refreshStockData = fetchMasterDataFromDB;

  const saveProducts = (newProducts) => {
    setProducts(newProducts);
    localStorage.setItem("le_products", JSON.stringify(newProducts));

    // Automatically reflect and synchronize products with inventory immediately in state
    setInventory((prevInv) => {
      const prodMap = new Map((newProducts || []).map((p) => [String(p.id || p.productId), p]));
      const existingProductIds = new Set();

      const updatedExisting = (prevInv || [])
        .filter((inv) => {
          const invProdId = String(inv.productId || inv.id || inv.sku);
          const invProdName = (inv.product || inv.productName || "").trim().toLowerCase();
          const prodNames = new Set((newProducts || []).map((p) => (p.name || "").trim().toLowerCase()).filter(Boolean));
          return prodMap.has(invProdId) || (invProdName && prodNames.has(invProdName));
        })
        .map((inv) => {
          const pId = String(inv.productId || inv.id || inv.sku);
          existingProductIds.add(pId);
          const p = prodMap.get(pId);
          const rawStock = Number(p.stock ?? p.currentStock ?? 0);
          const rawOpen = Number(p.openingStock || 0);
          const rawIn = Number(p.inwardStock || 0);
          const rawOut = Number(p.outwardStock || 0);
          return {
            ...inv,
            product: p.name,
            productName: p.name,
            sku: p.sku || inv.sku || pId,
            category: p.category || inv.category,
            unit: p.unit || inv.unit,
            openingStock: rawOpen,
            in: rawIn,
            inwardStock: rawIn,
            out: rawOut,
            outwardStock: rawOut,
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
          const rawOpen = Number(p.openingStock || 0);
          const rawIn = Number(p.inwardStock || 0);
          const rawOut = Number(p.outwardStock || 0);
          const minAlert = Number(p.minStock ?? 10);
          newEntries.push({
            id: pId,
            productId: pId,
            product: p.name,
            productName: p.name,
            sku: p.sku || pId,
            category: p.category || "General",
            unit: p.unit || "Bags",
            openingStock: rawOpen,
            in: rawIn,
            inwardStock: rawIn,
            out: rawOut,
            outwardStock: rawOut,
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

  const handleDeleteProductCascade = (productToDelete) => {
    if (!productToDelete) return;
    const targetId = String(productToDelete.id || productToDelete.productId);
    const targetName = (productToDelete.name || "").trim().toLowerCase();

    // 1. Update products in state and localStorage
    const updatedProducts = (products || []).filter(
      (p) => String(p.id || p.productId) !== targetId
    );
    setProducts(updatedProducts);
    localStorage.setItem("le_products", JSON.stringify(updatedProducts));

    // 2. Cascade delete from inventory in state and localStorage
    setInventory((prevInv) => {
      const updatedInv = (prevInv || []).filter((inv) => {
        const invProdId = String(inv.productId || inv.id || inv.sku);
        const invProdName = (inv.product || inv.productName || "").trim().toLowerCase();
        if (invProdId === targetId) return false;
        if (targetName && invProdName === targetName) return false;
        return true;
      });
      localStorage.setItem("le_inventory", JSON.stringify(updatedInv));
      return updatedInv;
    });

    // 3. Delete from backend DB via API (MySQL foreign key cascade handles inventory)
    erpApi
      .deleteProduct(targetId)
      .then(() => {
        refreshStockData();
      })
      .catch((e) => {
        console.warn("Cascade delete API call fallback to syncProducts:", e.message);
        erpApi.syncProducts(updatedProducts).then(refreshStockData).catch(() => {});
      });
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
      financialYear: getFiscalYearFormatted(getToday())
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

  // Live JWT session verification & Master MySQL real-time synchronization
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

    // 1. Initial live database load on mount
    fetchMasterDataFromDB();

    // 2. Real-time sync: when window tab gains focus or user returns to tab
    const handleSyncOnFocus = () => {
      fetchMasterDataFromDB();
    };
    window.addEventListener("focus", handleSyncOnFocus);
    document.addEventListener("visibilitychange", handleSyncOnFocus);

    // 3. Background periodic sync polling every 10 seconds to keep live with remote DB
    const syncInterval = setInterval(fetchMasterDataFromDB, 10000);

    return () => {
      window.removeEventListener("focus", handleSyncOnFocus);
      document.removeEventListener("visibilitychange", handleSyncOnFocus);
      clearInterval(syncInterval);
    };
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
      expenses,
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
  const handleCreateInvoiceCascade = async (newInvoice) => {
    try {
      const res = await erpApi.createInvoice(newInvoice);
      const created = res?.data;
      showGlobalToast(`✓ Invoice ${created?.invoiceNumber || newInvoice.invoiceNumber || newInvoice.id} created & saved to database!`);
      await fetchMasterDataFromDB();
      return created;
    } catch (err) {
      const errMsg = err?.response?.data?.message || err.message || "Failed to create invoice";
      showGlobalToast(`⚠️ ${errMsg}`);
      throw err;
    }
  };

  // 2. Inward Purchase creation cascades to Product & Vendor Ledger (Backend syncs MySQL inventory)
  const handleCreatePurchaseCascade = async (newPurchase) => {
    try {
      const res = await erpApi.createPurchase(newPurchase);
      const created = res?.data;
      showGlobalToast(`✓ Purchase Bill ${created?.purchaseId || newPurchase.purchaseId || newPurchase.id} created & saved to database!`);
      await fetchMasterDataFromDB();
      return created;
    } catch (err) {
      const errMsg = err?.response?.data?.message || err.message || "Failed to create purchase bill";
      showGlobalToast(`⚠️ ${errMsg}`);
      throw err;
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
        onRefreshAll={fetchMasterDataFromDB}
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
                onRefresh={fetchMasterDataFromDB}
                clients={clients} 
                onSaveClients={saveClients} 
                invoices={invoices} 
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
                onRefresh={fetchMasterDataFromDB}
                vendors={vendors} 
                onSaveVendors={saveVendors}
              />
            } 
          />
          <Route 
            path="/purchases" 
            element={
              <PurchasesPage 
                onRefresh={fetchMasterDataFromDB}
                purchases={purchases} 
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
                onRefresh={fetchMasterDataFromDB}
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
                onRefresh={fetchMasterDataFromDB}
                invoices={invoices} 
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
                onCreateInvoice={handleCreateInvoiceCascade}
                products={products}
                company={company}
                onRefresh={fetchMasterDataFromDB}
              />
            } 
          />
          <Route 
            path="/expenses" 
            element={
              <ExpensesPage 
                expenses={expenses}
                onRefresh={fetchMasterDataFromDB}
                showToast={showGlobalToast}
              />
            } 
          />
          <Route 
            path="/products" 
            element={
              <ProductsPage 
                onRefresh={fetchMasterDataFromDB}
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