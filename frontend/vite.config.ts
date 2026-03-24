import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@react-aria/interactions": path.resolve(__dirname, "./src/mock-react-aria.ts")
    }
  },
  server: {
    port: 3000,
    host: "0.0.0.0",
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    // Disable source maps in production — they inflate bundle size and expose
    // source code to end users. Use a Sentry upload step in CI if you need
    // server-side symbolication for error traces.
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split large stable vendor libraries into separate chunks so browsers
        // can cache them independently and download them in parallel.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-socket": ["socket.io-client"],
          "vendor-blockchain": ["viem"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-avatar",
            "@radix-ui/react-switch",
            "@radix-ui/react-label",
          ],
        },
      },
    },
  }
});
