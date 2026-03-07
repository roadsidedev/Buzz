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
      // Must not start with: password/secret/jwt/test/dev/local and must have high entropy
      JWT_SECRET: "Xc9#mK2@vP5nR8!qY3wB6zA4hD7*LcE0",
      PLATFORM_WALLET: "0x1234567890123456789012345678901234567890",
      X402_WEBHOOK_SECRET: "test-x402-webhook-secret-for-vitest",
      // Disable payment validation so server.ts can start without X402_API_KEY
      ENABLE_PAYMENTS: "false",
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@common": path.resolve(__dirname, "../common"),
    },
  },
});
