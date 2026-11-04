import React, { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  Menu, Search, Bell, LogOut, RefreshCw
} from "lucide-react";
import ThemeSelector from "./ThemeSelector";
import { erpApi } from "../services/api";
import DesktopSidebar from "./responsive/DesktopSidebar";
import MobileBottomNavigation from "./responsive/MobileBottomNavigation";
import MobileMoreMenu from "./responsive/MobileMoreMenu";

export default function Layout({
  children,
  currentTheme,
  onSelectTheme,
  adminProfile,
  currentUser,
  onLogout,
  onRefreshAll
}) {
  const [isRefreshingGlobal, setIsRefreshingGlobal] = useState(false);
  const [isDbOnline, setIsDbOnline] = useState(true);
  const [alertCount, setAlertCount] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    let mounted = true;
    erpApi.checkHealth()
      .then(() => { if (mounted) setIsDbOnline(true); })
      .catch(() => { if (mounted) setIsDbOnline(false); });

    erpApi.getDashboardStats()
      .then((res) => {
        if (mounted && res?.data) {
          const alerts = (res.data.lowStockCount || 0) + (res.data.overdueCount || 0);
          setAlertCount(alerts);
        }
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, []);

  const handleGlobalRefresh = async () => {
    if (onRefreshAll) {
      setIsRefreshingGlobal(true);
      await onRefreshAll();
      setTimeout(() => setIsRefreshingGlobal(false), 500);
    }
  };

  const titles = {
    "/": ["Enterprise Dashboard", "Live operations, revenue intelligence and stock alerts"],
    "/clients": ["Client Directory", "Enterprise accounts, real-time client management, orders and billing"],
    "/vendors": ["Vendor Directory", "Suppliers, farmers procurement partners, trade accounts & payables"],
    "/purchases": ["Purchase & Inward Procurement", "Animal feed stocks inward, raw milk procurement & farm direct receipts"],
    "/expo": ["Expo Leads & WhatsApp Broadcasting", "Stall visitors registry with 1-click bulk WhatsApp campaigns"],
    "/invoices": ["Sales", "Commercial GST tax invoices, billing ledger & PDF download"],
    "/revenue": ["Revenue Intelligence", "Track financial milestones, invoicing and gross earnings"],
    "/expenses": ["Operating Expenses", "Operational costs, bills ledger, expense categories & tracking"],
    "/products": ["Product Catalogue", "Manage supplies, pricing tiers, stock levels & safety thresholds"],
    "/inventory": ["Inventory Logistics", "Track inward receipts, outward dispatches, SKU flow & bay storage"],
    "/workspace": ["Admin Workspace", "Enterprise settings, company registry, access controls & system configuration"],
    "/login": ["Authentication & Security", "User credentials, access levels and secure enterprise register"]
  };
  const [title, subtitle] = titles[location.pathname] || titles["/"];

  return (
    <div className="app-shell">
      {/* DESKTOP & TABLET SIDEBAR */}
      <DesktopSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isDbOnline={isDbOnline}
        currentUser={currentUser}
        adminProfile={adminProfile}
        onLogout={onLogout}
      />

      {/* MAIN VIEWPORT */}
      <main className="main">
        {/* RESPONSIVE TOPBAR */}
        <header className="topbar">
          <button
            type="button"
            className="menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Toggle navigation drawer"
          >
            <Menu size={20} />
          </button>

          <div className="heading">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>

          <div className="top-actions">
            {/* Global live database refresh button */}
            {onRefreshAll && (
              <button
                type="button"
                className="icon-btn"
                onClick={handleGlobalRefresh}
                title="Sync & refresh all data with database"
                style={{ cursor: "pointer" }}
                aria-label="Refresh live data"
              >
                <RefreshCw
                  size={17}
                  style={{ animation: isRefreshingGlobal ? "spin 1s linear infinite" : "none" }}
                />
              </button>
            )}

            {/* Color Palette Switcher */}
            <ThemeSelector currentTheme={currentTheme} onSelectTheme={onSelectTheme} />

            {/* Desktop-only Search Box */}
            <div className="search-box">
              <Search size={16} />
              <input placeholder="Search records, SKUs..." />
            </div>

            {/* Alerts Notification Bell */}
            <button
              type="button"
              className="icon-btn"
              title={alertCount > 0 ? `${alertCount} active alerts` : "No new notifications"}
              aria-label="System notifications"
            >
              <Bell size={18} />
              {alertCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: "var(--danger)"
                  }}
                />
              )}
            </button>

            {/* Topbar User Avatar Shortcut */}
            <NavLink
              to="/workspace"
              className="profile-avatar"
              style={{ width: 36, height: 36, fontSize: 13, textDecoration: "none", cursor: "pointer" }}
              title={`Logged in as ${currentUser?.name || adminProfile?.name || "Admin"}`}
            >
              {(currentUser?.name || adminProfile?.name || "LE")
                .split(" ")
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </NavLink>

            {/* Topbar Log Out Button */}
            <button
              type="button"
              className="icon-btn"
              onClick={onLogout}
              title="Log Out of Portal"
              style={{ color: "var(--danger)" }}
              aria-label="Log Out"
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER */}
        <section className="content">
          {children}
        </section>
      </main>

      {/* MOBILE BOTTOM NAVIGATION DOCK (Visible only on mobile <= 600px) */}
      <MobileBottomNavigation onOpenMore={() => setMoreMenuOpen(true)} />

      {/* MOBILE MORE MENU BOTTOM SHEET */}
      <MobileMoreMenu
        isOpen={moreMenuOpen}
        onClose={() => setMoreMenuOpen(false)}
        currentTheme={currentTheme}
        onSelectTheme={onSelectTheme}
        onRefreshAll={onRefreshAll}
        currentUser={currentUser}
        adminProfile={adminProfile}
        onLogout={onLogout}
        isDbOnline={isDbOnline}
      />
    </div>
  );
}
