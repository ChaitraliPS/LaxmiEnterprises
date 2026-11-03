import React, { useState, useEffect } from "react";
import {
  Database, Download, RefreshCw, CheckCircle2,
  FileText, ShieldCheck, Users, Package, ShoppingCart,
  Receipt, MessageCircle, AlertCircle
} from "lucide-react";
import ResponsivePageHeader from "./responsive/ResponsivePageHeader";
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
  expoLeads = [],
  setExpoLeads,
  showToast,
  onRefresh,
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

  const handleRefreshFromDatabase = async () => {
    setSyncing(true);
    try {
      await erpApi.getAllData();
      if (showToast) showToast("✓ Data refreshed live from MySQL database");
      if (onRefresh) await onRefresh();
    } catch (err) {
      if (showToast) showToast("Refresh error: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="page data-hub-page">
      {/* Responsive Page Header */}
      <ResponsivePageHeader
        title="Data Hub & Cloud Sync"
        subtitle="Direct MySQL database health, cloud data synchronization, and CSV audit registers"
        actions={
          <>
            <button
              type="button"
              className="outline"
              onClick={checkConnection}
              disabled={dbStatus.checking}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={15} className={dbStatus.checking ? "spin" : ""} />
              <span>Check DB</span>
            </button>
            <button
              type="button"
              className="primary"
              onClick={handleRefreshFromDatabase}
              disabled={syncing}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <RefreshCw size={15} className={syncing ? "spin" : ""} />
              <span>{syncing ? "Syncing..." : "Sync MySQL"}</span>
            </button>
          </>
        }
      />

      {/* Database Status Card */}
      <div
        className="card"
        style={{
          marginBottom: 20,
          background: dbStatus.online ? "rgba(16, 185, 129, 0.05)" : "rgba(239, 68, 68, 0.05)",
          border: `1px solid ${dbStatus.online ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
          padding: 18,
          borderRadius: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
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
                flexShrink: 0
              }}
            >
              <Database size={22} />
            </div>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: "1rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                MySQL Database: {dbStatus.online ? "Connected & Active" : "Offline / Unreachable"}
              </h3>
              <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "var(--text-muted)" }}>
                laxmi_enterprises_db • 127.0.0.1:3306 (Production Protected)
              </p>
            </div>
          </div>
          <span className={`badge ${dbStatus.online ? "success" : "danger"}`} style={{ flexShrink: 0 }}>
            {dbStatus.online ? "Live Synchronized" : "Reconnecting"}
          </span>
        </div>
      </div>

      {/* Database Registers Cards */}
      <div className="card" style={{ padding: 18, borderRadius: 14 }}>
        <h3 style={{ marginTop: 0, marginBottom: 14, fontSize: "1rem" }}>
          Export Standard CSV Registers
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
          <div style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg)", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <Users size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 13, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Clients Register</strong>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{clients.length} records</div>
              </div>
            </div>
            <button
              type="button"
              className="outline"
              disabled={clients.length === 0}
              onClick={() => exportToCsv(clients, `Clients_Register_${new Date().toISOString().slice(0, 10)}.csv`)}
              style={{ minHeight: 36, padding: "4px 12px", fontSize: 12 }}
            >
              <Download size={13} /> CSV
            </button>
          </div>

          <div style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg)", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <Receipt size={18} color="#10b981" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 13, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Invoices & Sales</strong>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{invoices.length} records</div>
              </div>
            </div>
            <button
              type="button"
              className="outline"
              disabled={invoices.length === 0}
              onClick={() => exportToCsv(invoices, `Invoices_Ledger_${new Date().toISOString().slice(0, 10)}.csv`)}
              style={{ minHeight: 36, padding: "4px 12px", fontSize: 12 }}
            >
              <Download size={13} /> CSV
            </button>
          </div>

          <div style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg)", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <ShoppingCart size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 13, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Purchases Ledger</strong>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{purchases.length} records</div>
              </div>
            </div>
            <button
              type="button"
              className="outline"
              disabled={purchases.length === 0}
              onClick={() => exportToCsv(purchases, `Purchases_Ledger_${new Date().toISOString().slice(0, 10)}.csv`)}
              style={{ minHeight: 36, padding: "4px 12px", fontSize: 12 }}
            >
              <Download size={13} /> CSV
            </button>
          </div>

          <div style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg)", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <Package size={18} color="#8b5cf6" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 13, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Products Catalogue</strong>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{products.length} items</div>
              </div>
            </div>
            <button
              type="button"
              className="outline"
              disabled={products.length === 0}
              onClick={() => exportToCsv(products, `Products_Catalog_${new Date().toISOString().slice(0, 10)}.csv`)}
              style={{ minHeight: 36, padding: "4px 12px", fontSize: 12 }}
            >
              <Download size={13} /> CSV
            </button>
          </div>

          <div style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 10, display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg)", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <MessageCircle size={18} color="#06b6d4" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <strong style={{ fontSize: 13, display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Expo Visitors</strong>
                <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>{expoLeads.length} leads</div>
              </div>
            </div>
            <button
              type="button"
              className="outline"
              disabled={expoLeads.length === 0}
              onClick={() => exportToCsv(expoLeads, `Expo_Leads_${new Date().toISOString().slice(0, 10)}.csv`)}
              style={{ minHeight: 36, padding: "4px 12px", fontSize: 12 }}
            >
              <Download size={13} /> CSV
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
