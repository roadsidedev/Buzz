/**
 * Performance Monitoring Utilities
 * Tracks Web Vitals and component performance
 * ~100 lines
 */

export interface PerformanceMetrics {
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
  tti?: number; // Time to Interactive
  fcp?: number; // First Contentful Paint
}

export interface ComponentMetrics {
  componentName: string;
  renderTime: number;
  renderCount: number;
  lastRenderTime: number;
}

const componentMetrics = new Map<string, ComponentMetrics>();
const performanceObservers = new Set<PerformanceObserverCallback>();

type PerformanceObserverCallback = (metrics: PerformanceMetrics) => void;

/**
 * Initialize Web Vitals monitoring
 */
export function initializeWebVitals(): void {
  // Measure LCP (Largest Contentful Paint)
  if ("PerformanceObserver" in window) {
    try {
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        notifyObservers({
          lcp: lastEntry.startTime,
        });
      });
      lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });

      // Measure CLS (Cumulative Layout Shift)
      const clsObserver = new PerformanceObserver((list) => {
        let cls = 0;
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            cls += (entry as any).value;
          }
        }
        notifyObservers({
          cls,
        });
      });
      clsObserver.observe({ entryTypes: ["layout-shift"] });

      // Measure FCP (First Contentful Paint)
      const fcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry) => {
          if (entry.name === "first-contentful-paint") {
            notifyObservers({
              fcp: entry.startTime,
            });
          }
        });
      });
      fcpObserver.observe({ entryTypes: ["paint"] });
    } catch (err) {
      console.error("Failed to initialize Web Vitals:", err);
    }
  }

  // Measure TTFB via Navigation Timing
  if ("performance" in window && window.performance.timing) {
    const timing = window.performance.timing;
    const ttfb = timing.responseStart - timing.navigationStart;
    notifyObservers({ ttfb: Math.max(0, ttfb) });
  }
}

/**
 * Measure component render time
 */
export function measureComponentRender(
  componentName: string,
  renderTime: number
): void {
  const existing = componentMetrics.get(componentName) || {
    componentName,
    renderTime: 0,
    renderCount: 0,
    lastRenderTime: 0,
  };

  existing.renderCount++;
  existing.lastRenderTime = renderTime;
  existing.renderTime = (existing.renderTime + renderTime) / existing.renderCount;

  componentMetrics.set(componentName, existing);
}

/**
 * Get component metrics
 */
export function getComponentMetrics(
  componentName?: string
): ComponentMetrics | ComponentMetrics[] | null {
  if (componentName) {
    return componentMetrics.get(componentName) || null;
  }
  return Array.from(componentMetrics.values());
}

/**
 * Subscribe to performance metrics
 */
export function onPerformanceMetrics(callback: PerformanceObserverCallback): () => void {
  performanceObservers.add(callback);

  return () => {
    performanceObservers.delete(callback);
  };
}

/**
 * Notify all observers of metric changes
 */
function notifyObservers(metrics: Partial<PerformanceMetrics>): void {
  performanceObservers.forEach((callback) => {
    try {
      callback(metrics as PerformanceMetrics);
    } catch (err) {
      console.error("Error in performance observer:", err);
    }
  });
}

/**
 * Get current performance report
 */
export function getPerformanceReport(): {
  vitals: Partial<PerformanceMetrics>;
  components: ComponentMetrics[];
  timestamp: number;
} {
  const vitals: Partial<PerformanceMetrics> = {};

  // Get LCP
  if ("PerformanceObserver" in window) {
    const paintEntries = window.performance.getEntriesByType("largest-contentful-paint");
    if (paintEntries.length > 0) {
      vitals.lcp = paintEntries[paintEntries.length - 1].startTime;
    }

    // Get CLS
    let cls = 0;
    const layoutShiftEntries = window.performance.getEntriesByType("layout-shift");
    for (const entry of layoutShiftEntries) {
      if (!(entry as any).hadRecentInput) {
        cls += (entry as any).value;
      }
    }
    vitals.cls = cls;

    // Get FCP
    const paintFCPEntries = window.performance.getEntriesByType("paint");
    for (const entry of paintFCPEntries) {
      if (entry.name === "first-contentful-paint") {
        vitals.fcp = entry.startTime;
      }
    }
  }

  // Get TTFB
  if ("performance" in window && window.performance.timing) {
    const timing = window.performance.timing;
    vitals.ttfb = Math.max(0, timing.responseStart - timing.navigationStart);
  }

  return {
    vitals,
    components: Array.from(componentMetrics.values()),
    timestamp: Date.now(),
  };
}

/**
 * Send performance report to analytics
 */
export async function sendPerformanceReport(): Promise<void> {
  const report = getPerformanceReport();

  try {
    await fetch("/api/analytics/performance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token") || ""}`,
      },
      body: JSON.stringify(report),
    });
  } catch (err) {
    console.error("Failed to send performance report:", err);
  }
}

/**
 * React hook for measuring component render time
 */
export function useComponentMetrics(componentName: string): void {
  const startTime = React.useRef(performance.now());

  React.useEffect(() => {
    const renderTime = performance.now() - startTime.current;
    measureComponentRender(componentName, renderTime);
  });
}

// Import React for useComponentMetrics
import React from "react";
