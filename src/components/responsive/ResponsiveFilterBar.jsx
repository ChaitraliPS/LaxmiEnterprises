import React from "react";
import { Search, X } from "lucide-react";

/**
 * ResponsiveFilterBar
 * Adapts search, category filters, dropdowns, and counter seamlessly across:
 * - Desktop: horizontal toolbar with inline inputs and filters
 * - Mobile: search bar + horizontally scrolling filter chips + wrap dropdowns
 */
export default function ResponsiveFilterBar({
  search = "",
  onSearchChange,
  searchPlaceholder = "Search records...",
  filterPills = null,
  selects = null,
  actions = null,
  filteredCount = null,
  totalCount = null,
  countLabel = "records",
  onClearAll = null,
  hasActiveFilters = false,
  className = "",
}) {
  return (
    <div className={`responsive-filter-bar ${className}`}>
      {/* Search Input */}
      {onSearchChange && (
        <div className="filter-search-box">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="filter-search-input"
            aria-label={searchPlaceholder}
          />
          {search && (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => onSearchChange("")}
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Filter Pills / Tabs */}
      {filterPills && (
        <div className="filter-pills-scroll">
          {filterPills}
        </div>
      )}

      {/* Select Dropdowns */}
      {selects && (
        <div className="filter-selects-row">
          {selects}
        </div>
      )}

      {/* Active Filter Clear & Counters */}
      <div className="filter-meta-row">
        {hasActiveFilters && onClearAll && (
          <button
            type="button"
            className="filter-clear-all-btn"
            onClick={onClearAll}
          >
            <X size={13} />
            <span>Clear filters</span>
          </button>
        )}

        {filteredCount !== null && (
          <span className="filter-count-badge">
            Showing {filteredCount} {totalCount !== null ? `of ${totalCount}` : ""} {countLabel}
          </span>
        )}

        {actions && (
          <div className="filter-actions-slot">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
