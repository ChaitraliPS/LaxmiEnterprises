import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard, Users, Truck, ShoppingCart, MessageCircle, Receipt,
  IndianRupee, Package, Boxes, ShieldCheck, X, LogOut, Wallet
} from "lucide-react";

export const coreNav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/clients", label: "Clients", icon: Users },
  { to: "/vendors", label: "Vendors", icon: Truck },
  { to: "/purchases", label: "Purchases", icon: ShoppingCart },
  { to: "/expo", label: "Expo Leads", icon: MessageCircle },
];

export const financialNav = [
  { to: "/invoices", label: "Sales", icon: Receipt },
  { to: "/revenue", label: "Revenue", icon: IndianRupee },
  { to: "/expenses", label: "Expenses", icon: Wallet },
  { to: "/products", label: "Products", icon: Package },
  { to: "/inventory", label: "Inventory", icon: Boxes },
];

export const enterpriseNav = [
  { to: "/workspace", label: "Admin Workspace", icon: ShieldCheck }
];

export default function DesktopSidebar({
  isOpen,
  onClose,
  isDbOnline,
  currentUser,
  adminProfile,
  onLogout
}) {
  return (
    <>
      <aside className={`sidebar ${isOpen ? "sidebar-open" : ""}`} aria-label="Desktop Sidebar Navigation">
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
          <button
            type="button"
            className="mobile-close"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* NAVIGATION SECTIONS */}
        <nav className="sidebar-nav" aria-label="Main Navigation">
          <div className="nav-section-title">CORE OPERATIONS</div>
          {coreNav.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={onClose}
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
              onClick={onClose}
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
              onClick={onClose}
              className={({ isActive }) => (isActive ? "nav-item active" : "nav-item")}
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}

          
        </nav>

        {/* SIDEBAR FOOTER */}
        <div className="sidebar-footer-wrapper">
          <NavLink
            to="/workspace"
            className="sidebar-footer-link"
            title="Open Admin Workspace"
            onClick={onClose}
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

      {/* OVERLAY FOR TABLET / MOBILE DRAWER */}
      {isOpen && <div className="overlay" onClick={onClose} />}
    </>
  );
}
