import React from "react";

/**
 * ResponsiveDataTable
 * The core component for Dual-Experience ERP:
 * - On Laptop & Desktop (1025px+) & Tablet: Renders full desktop table with all columns preserved.
 * - On Mobile (320px–600px): Renders card-based records with touch ergonomics.
 * Both views consume the exact same underlying dataset and callback handlers.
 */
export default function ResponsiveDataTable({
  desktopView,
  mobileView,
  hasRecords = true,
  emptyState = null,
  className = "",
}) {
  if (!hasRecords && emptyState) {
    return <div className="responsive-empty-state-wrap">{emptyState}</div>;
  }

  return (
    <div className={`responsive-data-table-root ${className}`}>
      {/* Desktop & Tablet Table View (Hidden on mobile <= 600px) */}
      <div className="desktop-table-container">
        {desktopView}
      </div>

      {/* Mobile Card List View (Hidden on tablet/desktop >= 601px) */}
      <div className="mobile-card-container">
        {mobileView}
      </div>
    </div>
  );
}
