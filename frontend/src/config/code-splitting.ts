/**
 * Code Splitting Configuration
 * Defines lazy-loaded components for Day 4 optimization
 * ~80 lines
 */

import { lazy } from "react";

/**
 * Lazy-loaded discovery components
 * These will be code-split into separate bundles
 */
export const DiscoveryComponents = {
  // Day 2 components - can be lazy loaded
  LiveNowSection: lazy(() =>
    import("../components/discovery/live-now-section").then((m) => ({
      default: m.LiveNowSection,
    }))
  ),

  TrendingSection: lazy(() =>
    import("../components/discovery/trending-section").then((m) => ({
      default: m.TrendingSection,
    }))
  ),

  RoomMetricsCard: lazy(() =>
    import("../components/discovery/room-metrics-card").then((m) => ({
      default: m.RoomMetricsCard,
    }))
  ),

  // Day 3 components - search and filtering
  AdvancedSearchModal: lazy(() =>
    import("../components/discovery/advanced-search-modal").then((m) => ({
      default: m.AdvancedSearchModal,
    }))
  ),

  // Day 4 optimization - virtual scrolling
  VirtualRoomGrid: lazy(() =>
    import("../components/discovery/virtual-room-grid").then((m) => ({
      default: m.VirtualRoomGrid,
    }))
  ),
};

/**
 * Lazy-loaded pages
 */
export const Pages = {
  DiscoveryPage: lazy(() =>
    import("../pages/discovery-page").then((m) => ({
      default: m.DiscoveryPage,
    }))
  ),

  RoomPage: lazy(() =>
    import("../pages/room-page").then((m) => ({
      default: m.RoomPage,
    }))
  ),
};

/**
 * Performance: Enable code splitting
 * Add to vite.config.ts build.rollupOptions:
 * 
 * output: {
 *   manualChunks: {
 *     'discovery': ['./src/pages/discovery-page.tsx', './src/components/discovery/'],
 *     'search': ['./src/components/discovery/advanced-search-modal.tsx'],
 *     'vendor': ['react', 'react-router-dom'],
 *   }
 * }
 */

export const ViteCodeSplittingConfig = {
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor libraries
          vendor: ["react", "react-router-dom"],

          // Discovery features (Day 2-3)
          discovery: [
            "./src/pages/discovery-page.tsx",
            "./src/components/discovery/live-now-section.tsx",
            "./src/components/discovery/trending-section.tsx",
            "./src/components/discovery/room-metrics-card.tsx",
          ],

          // Search & filtering (Day 3)
          search: [
            "./src/components/discovery/advanced-search-modal.tsx",
            "./src/hooks/use-filter-persistence.ts",
            "./src/hooks/use-search-analytics.ts",
          ],

          // Virtual scrolling (Day 4)
          virtualization: ["./src/components/discovery/virtual-room-grid.tsx"],
        },
      },
    },
  },
};
