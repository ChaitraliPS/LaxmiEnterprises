import React from "react";

/**
 * ResponsivePageHeader
 * - Laptop/Desktop (1025px+): Full title & subtitle on left, actions neatly right-aligned
 * - Mobile (320px–600px): Compact header with touch-friendly wrap
 */
export default function ResponsivePageHeader({
  title,
  subtitle,
  badge = null,
  actions = null,
  className = "",
  style = {},
}) {
  return (
    <div className={`responsive-page-header ${className}`} style={style}>
      <div className="responsive-header-info">
        <div className="responsive-header-title-row">
          <h1 className="responsive-header-title">{title}</h1>
          {badge && <div className="responsive-header-badge">{badge}</div>}
        </div>
        {subtitle && <p className="responsive-header-subtitle">{subtitle}</p>}
      </div>

      {actions && (
        <div className="responsive-header-actions">
          {actions}
        </div>
      )}
    </div>
  );
}
