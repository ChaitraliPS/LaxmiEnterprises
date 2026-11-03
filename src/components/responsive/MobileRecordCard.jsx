import React, { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * MobileRecordCard
 * Touch-optimized card for smartphones (320px–600px).
 * Displays critical info upfront, provides expandable details accordion,
 * and prominent contextual action buttons.
 */
export default function MobileRecordCard({
  idBadge = null,
  title,
  subtitle = null,
  categoryBadge = null,
  statusBadge = null,
  primaryMetrics = [],
  expandedDetails = null,
  actions = null,
  onClick = null,
  className = "",
  style = {},
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div
      className={`mobile-record-card ${className}`}
      style={style}
    >
      {/* Top Header Row */}
      <div className="mobile-record-header" onClick={onClick} style={{ cursor: onClick ? "pointer" : "default" }}>
        <div className="mobile-record-title-group">
          <div className="mobile-record-id-row">
            {idBadge && <span className="mobile-record-id-badge">{idBadge}</span>}
            {categoryBadge && <span className="mobile-record-cat-badge">{categoryBadge}</span>}
          </div>
          <h3 className="mobile-record-title">{title}</h3>
          {subtitle && <p className="mobile-record-subtitle">{subtitle}</p>}
        </div>

        {statusBadge && (
          <div className="mobile-record-status-wrap">
            {statusBadge}
          </div>
        )}
      </div>

      {/* Primary Metrics Grid (1-3 key values like Amount, Stock, Mobile) */}
      {primaryMetrics && primaryMetrics.length > 0 && (
        <div className="mobile-record-metrics">
          {primaryMetrics.map((metric, idx) => (
            <div key={idx} className="mobile-record-metric-item">
              <span className="mobile-record-metric-label">{metric.label}</span>
              <span
                className={`mobile-record-metric-value ${metric.isMoney ? "money" : ""}`}
                style={{ color: metric.color || "inherit" }}
              >
                {metric.value}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Collapsible Accordion for Full Details */}
      {expandedDetails && (
        <div className="mobile-record-expand-wrap">
          <button
            type="button"
            className="mobile-record-expand-btn"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
          >
            <span>{isExpanded ? "Hide details" : "View full details"}</span>
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {isExpanded && (
            <div className="mobile-record-expanded-content">
              {expandedDetails}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons Footer */}
      {actions && (
        <div className="mobile-record-actions">
          {actions}
        </div>
      )}
    </div>
  );
}
