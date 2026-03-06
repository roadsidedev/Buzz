import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    // Environment configuration
    environment: "node",
    globals: true,

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.test.ts",
        "**/tests/**",
        "**/test-utils/**",
      ],
      lines: 80,
      functions: 80,
      branches: 80,
      statements: 80,
    },

    // Test file patterns
    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist"],

    // Timeouts
    testTimeout: 10000,

    // Reporters
    reporters: ["verbose"],

    // Setup files
    setupFiles: ["./tests/setup.ts"],

    // Environment variables set before any module is evaluated
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5432/test_db",
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@common": path.resolve(__dirname, "../common"),
    },
  },
});
