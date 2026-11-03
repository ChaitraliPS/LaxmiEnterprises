import React, { useEffect } from "react";
import { NavLink } from "react-router-dom";
import {
  Truck, ShoppingCart, MessageCircle, IndianRupee, Package,
  Database, ShieldCheck, X, RefreshCw, Moon, Sun, LogOut, ChevronRight, Wallet
} from "lucide-react";

export default function MobileMoreMenu({
  isOpen,
  onClose,
  currentTheme,
  onSelectTheme,
  onRefreshAll,
  currentUser,
  adminProfile,
  onLogout,
  isDbOnline = true
}) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  // Prevent background scroll
  useEffect(() => {
    if (isOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const moreModules = [
    { to: "/vendors", label: "Vendor Directory", sub: "Suppliers & Procurement", icon: Truck, color: "var(--primary)" },
    { to: "/purchases", label: "Purchases & Inward", sub: "Feed & Raw Goods Bills", icon: ShoppingCart, color: "#10b981" },
    { to: "/expo", label: "Expo Leads & WhatsApp", sub: "Visitor Registry & Campaigns", icon: MessageCircle, color: "#25D366" },
    { to: "/revenue", label: "Revenue Intelligence", sub: "Cash Flows & Targets", icon: IndianRupee, color: "#d97706" },
    { to: "/expenses", label: "Operating Expenses", sub: "Overhead Bills & Outflows", icon: Wallet, color: "#ef4444" },
    { to: "/products", label: "Product Catalogue", sub: "SKUs & Unit Safety", icon: Package, color: "#6366f1" },
    { to: "/data-hub", label: "Data Hub & Cloud Sync", sub: "MySQL Registers & Backups", icon: Database, color: "#0ea5e9" },
    { to: "/workspace", label: "Admin Workspace", sub: "Enterprise Configuration", icon: ShieldCheck, color: "var(--primary)" },
  ];

  const toggleTheme = () => {
    const nextTheme = currentTheme === "dark" ? "light" : "dark";
    if (onSelectTheme) onSelectTheme(nextTheme);
  };

  return (
    <div className="mobile-more-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="mobile-more-sheet" onClick={(e) => e.stopPropagation()}>
        {/* Drag Handle */}
        <div className="mobile-sheet-handle-bar">
          <span className="mobile-sheet-handle" />
        </div>

        {/* Sheet Header */}
        <div className="mobile-more-header">
          <div className="mobile-more-user-info">
            <div className="profile-avatar" style={{ width: 38, height: 38, fontSize: 13 }}>
              {(currentUser?.name || adminProfile?.name || "LE").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <strong style={{ display: "block", fontSize: 14 }}>{currentUser?.name || adminProfile?.name || "Admin"}</strong>
              <small style={{ color: "var(--text-muted)", fontSize: 11 }}>{currentUser?.role || adminProfile?.role || "Administrator"}</small>
            </div>
          </div>

          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Utilities Row */}
        <div className="mobile-more-quick-bar">
          <button
            type="button"
            className="mobile-quick-tool-btn"
            onClick={toggleTheme}
            title="Toggle Light / Dark mode"
          >
            {currentTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            <span>{currentTheme === "dark" ? "Light Mode" : "Dark Mode"}</span>
          </button>

          {onRefreshAll && (
            <button
              type="button"
              className="mobile-quick-tool-btn"
              onClick={() => {
                onRefreshAll();
                onClose();
              }}
              title="Sync all data with MySQL"
            >
              <RefreshCw size={15} />
              <span>Sync DB</span>
            </button>
          )}

          <button
            type="button"
            className="mobile-quick-tool-btn danger"
            onClick={() => {
              onClose();
              if (onLogout) onLogout();
            }}
            title="Log out"
          >
            <LogOut size={15} />
            <span>Logout</span>
          </button>
        </div>

        {/* Additional Modules List */}
        <div className="mobile-more-list">
          <div className="mobile-more-section-title">ALL MODULES</div>
          {moreModules.map(({ to, label, sub, icon: Icon, color }) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) => `mobile-more-item ${isActive ? "active" : ""}`}
            >
              <div className="mobile-more-icon-wrap" style={{ background: `${color}18`, color }}>
                <Icon size={18} />
              </div>
              <div className="mobile-more-item-text">
                <span className="mobile-more-item-label">{label}</span>
                <span className="mobile-more-item-sub">{sub}</span>
              </div>
              <ChevronRight size={16} className="mobile-more-chevron" />
            </NavLink>
          ))}
        </div>

        {/* Live Status Footer */}
        <div className="mobile-more-status-footer">
          <span
            className="sidebar-status-dot"
            style={{ background: isDbOnline ? "#10b981" : "#ef4444" }}
          />
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {isDbOnline ? "MySQL Connected & Protected" : "Database Offline / Retrying..."}
          </span>
        </div>
      </div>
    </div>
  );
}
