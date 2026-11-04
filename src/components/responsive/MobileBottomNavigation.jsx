import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, Receipt, Boxes, MoreHorizontal } from "lucide-react";

/**
 * MobileBottomNavigation
 * Ergonomic fixed bottom navigation dock for smartphones (320px–600px).
 * Five primary tabs:
 * 1. Home
 * 2. Clients
 * 3. Sales
 * 4. Inventory
 * 5. More (opens bottom-sheet navigation menu)
 */
export default function MobileBottomNavigation({ onOpenMore }) {
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation Dock">
      <NavLink
        to="/"
        end
        className={({ isActive }) => `mobile-bottom-item ${isActive ? "active" : ""}`}
      >
        <LayoutDashboard size={22} className="mobile-nav-icon" />
        <span className="mobile-nav-label">Home</span>
      </NavLink>

      <NavLink
        to="/clients"
        className={({ isActive }) => `mobile-bottom-item ${isActive ? "active" : ""}`}
      >
        <Users size={22} className="mobile-nav-icon" />
        <span className="mobile-nav-label">Clients</span>
      </NavLink>

      <NavLink
        to="/invoices"
        className={({ isActive }) => `mobile-bottom-item ${isActive ? "active" : ""}`}
      >
        <Receipt size={22} className="mobile-nav-icon" />
        <span className="mobile-nav-label">Sales</span>
      </NavLink>

      <NavLink
        to="/inventory"
        className={({ isActive }) => `mobile-bottom-item ${isActive ? "active" : ""}`}
      >
        <Boxes size={22} className="mobile-nav-icon" />
        <span className="mobile-nav-label">Inventory</span>
      </NavLink>

      <button
        type="button"
        className="mobile-bottom-item"
        onClick={onOpenMore}
        aria-label="Open More Modules"
      >
        <MoreHorizontal size={22} className="mobile-nav-icon" />
        <span className="mobile-nav-label">More</span>
      </button>
    </nav>
  );
}
