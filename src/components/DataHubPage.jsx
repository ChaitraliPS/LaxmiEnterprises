import React, { useState, useEffect } from "react";
import {
  Database, Download, RefreshCw, CheckCircle2,
  FileText, ShieldCheck, Users, Package, ShoppingCart,
  Receipt, MessageCircle, AlertCircle
} from "lucide-react";
import { erpApi } from "../services/api";


function exportToCsv(data, filename) {
  if (!data || !data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map((item) =>
    headers
      .map((h) => {
        const val = item[h] === null || item[h] === undefined ? "" : String(item[h]);
        return `"${val.replace(/"/g, '""')}"`;
      })
      .join(",")
  );
  const csvContent = [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function DataHubPage({
  clients = [],
  setClients,
  products = [],
  setProducts,
  inventory = [],
  setInventory,
  company = {},
  invoices = [],
  purchases = [],
  setPurchases,
  expoLeads = [],
  setExpoLeads,
  showToast,
}) {
  const [dbStatus, setDbStatus] = useState({ online: true, checking: false });
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    setDbStatus((prev) => ({ ...prev, checking: true }));
    try {
      await erpApi.checkHealth();
      setDbStatus({ online: true, checking: false });
    } catch (e) {
      setDbStatus({ online: false, checking: false });
    }
  };

  const handleSyncToDatabase = async () => {
    setSyncing(true);
    try {
      await Promise.all([
        erpApi.syncClients(clients),
        erpApi.syncInvoices(invoices),
        erpApi.syncPurchases(purchases),
        erpApi.syncProducts(products),
        erpApi.syncInventory(inventory),
        erpApi.syncExpoLeads(expoLeads),
        erpApi.syncCompany(company),
      ]);
      if (showToast) showToast("✓ All records synchronized with MySQL database");
    } catch (err) {
      if (showToast) showToast("Sync error: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="page-container">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Database size={26} color="var(--primary)" />
            Data Hub & Database Management
          </h1>
          <p className="page-subtitle">
            Direct MySQL database status, cloud data synchronization, and CSV audit registers.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button
            type="button"
            className="outline"
            onClick={checkConnection}
            disabled={dbStatus.checking}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={15} className={dbStatus.checking ? "spin" : ""} />
            <span>Check DB</span>
          </button>
          <button
            type="button"
            className="primary"
            onClick={handleSyncToDatabase}
            disabled={syncing}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <RefreshCw size={15} className={syncing ? "spin" : ""} />
            <span>{syncing ? "Syncing..." : "Sync to MySQL"}</span>
          </button>
        </div>
      </div>

      {/* Database Status Card */}
      <div
        className="card"
        style={{
          marginBottom: 24,
          background: dbStatus.online ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.05)",
          border: `1px solid ${dbStatus.online ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
          padding: 20,
          borderRadius: 12,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 10,
                background: dbStatus.online ? "#10b981" : "#ef4444",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Database size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem" }}>
                MySQL Database: {dbStatus.online ? "Connected & Active" : "Offline / Unreachable"}
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                Database: laxmi_enterprises_db • Host: 127.0.0.1:3306 (Hostinger Ready)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Database Registers Table */}
      <div className="card" style={{ padding: 20, borderRadius: 12 }}>
        <h3 style={{ marginTop: 0, marginBottom: 16, fontSize: "1rem" }}>
          Export Standard CSV Registers
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Users size={18} color="var(--primary)" />
              <div>
                <strong>Clients / Customers</strong>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{clients.length} records</div>
              </div>
            </div>
            <button
              type="button"
              className="outline"
              disabled={clients.length === 0}
              onClick={() => exportToCsv(clients, `Clients_Register_${new Date().toISOString().slice(0, 10)}.csv`)}
            >
              CSV
            </button>
          </div>

          <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Receipt size={18} color="#10b981" />
              <div>
                <strong>Invoices & Sales</strong>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{invoices.length} records</div>
              </div>
            </div>
            <button
              type="button"
              className="outline"
              disabled={invoices.length === 0}
              onClick={() => exportToCsv(invoices, `Invoices_Ledger_${new Date().toISOString().slice(0, 10)}.csv`)}
            >
              CSV
            </button>
          </div>

          <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <ShoppingCart size={18} color="#f59e0b" />
              <div>
                <strong>Inward Purchases</strong>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{purchases.length} records</div>
              </div>
            </div>
            <button
              type="button"
              className="outline"
              disabled={purchases.length === 0}
              onClick={() => exportToCsv(purchases, `Purchases_Ledger_${new Date().toISOString().slice(0, 10)}.csv`)}
            >
              CSV
            </button>
          </div>

          <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <Package size={18} color="#8b5cf6" />
              <div>
                <strong>Products Catalog</strong>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{products.length} items</div>
              </div>
            </div>
            <button
              type="button"
              className="outline"
              disabled={products.length === 0}
              onClick={() => exportToCsv(products, `Products_Catalog_${new Date().toISOString().slice(0, 10)}.csv`)}
            >
              CSV
            </button>
          </div>

          <div style={{ padding: 16, border: "1px solid var(--border)", borderRadius: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <MessageCircle size={18} color="#06b6d4" />
              <div>
                <strong>Expo Leads</strong>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{expoLeads.length} leads</div>
              </div>
            </div>
            <button
              type="button"
              className="outline"
              disabled={expoLeads.length === 0}
              onClick={() => exportToCsv(expoLeads, `Expo_Leads_${new Date().toISOString().slice(0, 10)}.csv`)}
            >
              CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
