import { useState, useEffect } from "react";

/**
 * Custom hook to detect viewport breakpoints:
 * - Mobile: <= 600px
 * - Tablet: 601px - 1024px
 * - Desktop: >= 1025px
 */
export function useViewport() {
  const [width, setWidth] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1200));

  useEffect(() => {
    let timeoutId = null;
    const handleResize = () => {
      // Throttle slightly with requestAnimationFrame
      if (timeoutId) cancelAnimationFrame(timeoutId);
      timeoutId = requestAnimationFrame(() => {
        setWidth(window.innerWidth);
      });
    };

    window.addEventListener("resize", handleResize, { passive: true });
    return () => {
      if (timeoutId) cancelAnimationFrame(timeoutId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return {
    width,
    isMobile: width <= 600,
    isTablet: width > 600 && width <= 1024,
    isDesktop: width >= 1025,
  };
}

export default useViewport;
