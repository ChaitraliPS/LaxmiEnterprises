import React, { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, Truck, ShoppingCart, MessageCircle, Receipt,
  IndianRupee, Package, Boxes, ShieldCheck, X, Menu, Database,
  Search, Bell, LogOut, RefreshCw
} from "lucide-react";
import ThemeSelector from "./ThemeSelector";

export default function Layout({ children, currentTheme, onSelectTheme, adminProfile, currentUser, onLogout, onRefreshAll }) {
  const [isRefreshingGlobal, setIsRefreshingGlobal] = useState(false);

  const handleGlobalRefresh = async () => {
    if (onRefreshAll) {
      setIsRefreshingGlobal(true);
      await onRefreshAll();
      setTimeout(() => setIsRefreshingGlobal(false), 500);
    }
  };
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const titles = {
    "/": ["Enterprise Dashboard", "Live operations, revenue intelligence and stock alerts"],
    "/clients": ["Client Directory", "Enterprise accounts, real-time client management, orders and billing"],
    "/vendors": ["Vendor Directory", "Suppliers, farmers procurement partners, trade accounts & payables"],
    "/purchases": ["Purchase & Inward Procurement", "Animal feed stocks inward, raw milk procurement & farm direct receipts"],
    "/expo": ["Expo Leads & WhatsApp Broadcasting", "Stall visitors registry (Name, Village, Mobile & Remark) with 1-click bulk WhatsApp campaigns"],
    "/invoices": ["Sales", "Commercial GST tax invoices, billing ledger & PDF download"],
    "/revenue": ["Revenue Intelligence", "Track financial milestones, invoicing and gross earnings"],
    "/products": ["Product Catalogue", "Manage supplies, pricing tiers, stock levels & safety thresholds"],
    "/inventory": ["Inventory Logistics", "Track inward receipts, outward dispatches, SKU flow & bay storage"],
    "/data-hub": ["Data Hub & Cloud Sync", "Enterprise data registers, CSV exports & MySQL database synchronization"],
    "/workspace": ["Admin Workspace", "Enterprise settings, company registry, access controls & system configuration"],
    "/login": ["Authentication & Security", "User credentials, access levels and secure enterprise register"]
  };
  const [title, subtitle] = titles[location.pathname] || titles["/"];

  const coreNav = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/clients", label: "Clients", icon: Users },
    { to: "/vendors", label: "Vendors", icon: Truck },
    { to: "/purchases", label: "Purchases", icon: ShoppingCart },
    { to: "/expo", label: "Expo Leads", icon: MessageCircle },
  ];

  const financialNav = [
    { to: "/invoices", label: "Sales", icon: Receipt },
    { to: "/revenue", label: "Revenue", icon: IndianRupee },
    { to: "/products", label: "Products", icon: Package },
    { to: "/inventory", label: "Inventory", icon: Boxes },
  ];

  const enterpriseNav = [
    { to: "/workspace", label: "Admin Workspace", icon: ShieldCheck }
  ];

  return (
    <div className="app-shell">
      {/* SIDEBAR NAVIGATION */}
      <aside className={`sidebar ${open ? "sidebar-open" : ""}`}>
        {/* BRAND HEADER WITH OFFICIAL LOGO */}
        <div className="brand">
          <div className="brand-logo-container">
            <img 
              src="/logo.png" 
              alt="Laxmi Enterprises Official Logo" 
              className="brand-logo-img" 
            />
          </div>
          <div className="brand-info">
            <strong className="brand-title">LAXMI</strong>
            <span className="brand-subtitle">ENTERPRISES</span>
          </div>
          <button className="mobile-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        {/* NAVIGATION ITEMS */}
        <nav className="sidebar-nav" aria-label="Main Navigation">
          <div className="nav-section-title">CORE OPERATIONS</div>
          {coreNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}

          <div className="nav-section-title" style={{ marginTop: 10 }}>FINANCIALS & INVENTORY</div>
          {financialNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}

          <div className="nav-section-title" style={{ marginTop: 10 }}>ENTERPRISE & WORKSPACE</div>
          {enterpriseNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}

          {/* SYSTEM STATUS PILL */}
          <div className="sidebar-status-card">
            <span className="sidebar-status-dot" />
            <div className="sidebar-status-text">
              <strong>Enterprise ERP Online</strong>
              <small>MySQL Synced & Protected</small>
            </div>
          </div>
        </nav>

        {/* SIDEBAR FOOTER - CLICKABLE ADMIN WORKSPACE SHORTCUT WITH LOGOUT */}
        <div className="sidebar-footer-wrapper">
          <NavLink
            to="/workspace"
            className="sidebar-footer-link"
            title="Open Admin Workspace"
            onClick={() => setOpen(false)}
          >
            <div className="sidebar-footer">
              <div className="profile-avatar">
                <ShieldCheck size={18} />
              </div>
              <div className="sidebar-footer-info">
                <b className="sidebar-footer-name">
                  {currentUser?.name || adminProfile?.name || "Admin"}
                </b>
                <small className="sidebar-footer-role">
                  {currentUser?.role || adminProfile?.role || "Administrator"}
                </small>
              </div>
            </div>
          </NavLink>
          <button
            type="button"
            className="icon-btn sidebar-logout-btn"
            onClick={onLogout}
            title="Log Out & Switch User"
            aria-label="Log Out & Switch User"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {open && <div className="overlay" onClick={() => setOpen(false)} />}

      {/* MAIN VIEWPORT */}
      <main className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)} aria-label="Open sidebar">
            <Menu size={20} />
          </button>
          <div className="heading">
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          
          <div className="top-actions">
            {/* Live MySQL Database Status Indicator */}
            

            {/* Color Palette Switcher */}
            {onRefreshAll && (
              <button
                type="button"
                className="icon-btn"
                onClick={handleGlobalRefresh}
                title="Sync & refresh all data with database"
                style={{ cursor: "pointer" }}
              >
                <RefreshCw size={17} style={{ animation: isRefreshingGlobal ? "spin 1s linear infinite" : "none" }} />
              </button>
            )}
            <ThemeSelector currentTheme={currentTheme} onSelectTheme={onSelectTheme} />

            <div className="search-box">
              <Search size={16} />
              <input placeholder="Search records, SKUs..." />
            </div>

            <button className="icon-btn" title="Notifications">
              <Bell size={18} />
              <i></i>
            </button>

            {/* Topbar User Avatar Links to Workspace */}
            <NavLink
              to="/workspace"
              className="profile-avatar"
              style={{ width: 36, height: 36, fontSize: 13, textDecoration: "none", cursor: "pointer" }}
              title={`Logged in as ${currentUser?.name || adminProfile?.name || "Admin"}`}
            >
              {(currentUser?.name || adminProfile?.name || "LE").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
            </NavLink>

            {/* Topbar Log Out Button */}
            <button
              type="button"
              className="icon-btn"
              onClick={onLogout}
              title="Log Out of Portal"
              style={{ color: "var(--danger)" }}
            >
              <LogOut size={17} />
            </button>
          </div>
        </header>

        <section className="content">{children}</section>
      </main>

      {/* MOBILE BOTTOM NAVIGATION DOCK */}
      <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
        <NavLink to="/" end className={({ isActive }) => `mobile-bottom-item ${isActive ? "active" : ""}`}>
          <LayoutDashboard size={20} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/clients" className={({ isActive }) => `mobile-bottom-item ${isActive ? "active" : ""}`}>
          <Users size={20} />
          <span>Clients</span>
        </NavLink>
        <NavLink to="/purchases" className={({ isActive }) => `mobile-bottom-item ${isActive ? "active" : ""}`}>
          <ShoppingCart size={20} />
          <span>Procure</span>
        </NavLink>
        <NavLink to="/invoices" className={({ isActive }) => `mobile-bottom-item ${isActive ? "active" : ""}`}>
          <Receipt size={20} />
          <span>Sales</span>
        </NavLink>
        <button
          type="button"
          className="mobile-bottom-item"
          onClick={() => setOpen(true)}
          aria-label="Open full menu"
        >
          <Menu size={20} />
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
}
