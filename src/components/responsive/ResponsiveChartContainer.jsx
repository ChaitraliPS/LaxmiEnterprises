import React from "react";
import { ResponsiveContainer } from "recharts";
import { useViewport } from "./useViewport";

/**
 * ResponsiveChartContainer
 * Wraps Recharts ResponsiveContainer with screen-aware dimensions and ergonomics:
 * - Desktop: 300px-340px height with full analytical context
 * - Mobile: 210px-240px height with compact margins
 */
export default function ResponsiveChartContainer({
  children,
  height = 300,
  mobileHeight = 220,
  className = "",
  style = {},
}) {
  const { isMobile } = useViewport();
  const effectiveHeight = isMobile ? mobileHeight : height;

  return (
    <div
      className={`responsive-chart-container ${className}`}
      style={{
        width: "100%",
        height: effectiveHeight,
        minHeight: effectiveHeight,
        position: "relative",
        ...style,
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}
