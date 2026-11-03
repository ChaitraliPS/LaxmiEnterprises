import React from "react";

/**
 * ResponsiveKpiGrid
 * - Mobile (320px–600px): 2-column KPI grid (1-col on extreme narrow <= 340px)
 * - Tablet (601px–1024px): 2-column grid
 * - Laptop/Desktop (1025px+): 4-column KPI cards
 */
export default function ResponsiveKpiGrid({
  children,
  cols = 4,
  className = "",
  style = {},
}) {
  return (
    <div
      className={`responsive-kpi-grid ${className}`}
      style={{
        "--desktop-kpi-cols": cols,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
