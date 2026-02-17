/**
 * Test: Crypto Import Fixes
 *
 * This test verifies that all files using crypto.randomUUID() and other
 * crypto methods have proper imports.
 */

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe("Crypto Import Verification", () => {
  const srcDir = path.join(__dirname, "../src");

  // Files that should have crypto imports based on usage
  const filesWithCryptoUsage = [
    "server.ts",
    "services/x402-payment-service.ts",
    "middleware/csrf-protection.ts",
    "utils/encryption.ts",
    "utils/audit-logger.ts",
    "services/turn-management-service.ts",
    "services/room-service.ts",
    "services/agent-service.ts",
    "services/message-service.ts",
    "services/payment-service.ts",
    "services/refresh-token-service.ts",
  ];

  filesWithCryptoUsage.forEach((filePath) => {
    it(`should have crypto import in ${filePath}`, () => {
      const fullPath = path.join(srcDir, filePath);

      // Check if file exists
      expect(fs.existsSync(fullPath)).toBe(true);

      // Read file content
      const content = fs.readFileSync(fullPath, "utf-8");

      // Check for crypto usage
      const usesCrypto =
        content.includes("crypto.randomUUID") ||
        content.includes("crypto.randomBytes") ||
        content.includes("crypto.createHmac") ||
        content.includes("crypto.timingSafeEqual") ||
        content.includes("crypto.createHash") ||
        content.includes("crypto.createCipheriv") ||
        content.includes("crypto.createDecipheriv") ||
        content.includes("crypto.pbkdf2Sync");

      if (usesCrypto) {
        // Check for crypto import
        const hasCryptoImport =
          content.includes('import crypto from "crypto"') ||
          content.includes('import { randomBytes } from "crypto"') ||
          content.includes('import { createHmac } from "crypto"') ||
          content.includes('import * as crypto from "crypto"');

        expect(hasCryptoImport).toBe(true);
      }
    });
  });

  describe("Server.ts specific", () => {
    it("should have crypto import before crypto usage", () => {
      const serverPath = path.join(srcDir, "server.ts");
      const content = fs.readFileSync(serverPath, "utf-8");

      const importIndex = content.indexOf('import crypto from "crypto"');
      const usageIndex = content.indexOf("crypto.randomUUID()");

      expect(importIndex).toBeGreaterThan(-1);
      expect(usageIndex).toBeGreaterThan(-1);
      expect(importIndex).toBeLessThan(usageIndex);
    });
  });
});

/**
 * Test Results Summary:
 *
 * ✅ Fixed: Missing Crypto Import (Issue #4)
 *
 * Before Fix:
 * - server.ts used crypto.randomUUID() without importing crypto
 * - Would cause runtime error when generating message IDs
 * - Multiple other files had same issue
 *
 * After Fix:
 * - Added `import crypto from "crypto"` to all affected files:
 *   - backend/src/server.ts
 *   - backend/src/utils/audit-logger.ts
 *   - backend/src/services/turn-management-service.ts
 *   - backend/src/services/room-service.ts
 *   - backend/src/services/message-service.ts
 *   - backend/src/services/payment-service.ts
 *
 * Files already had imports (verified):
 *   - backend/src/services/x402-payment-service.ts
 *   - backend/src/middleware/csrf-protection.ts
 *   - backend/src/utils/encryption.ts
 *   - backend/src/services/agent-service.ts
 *   - backend/src/services/refresh-token-service.ts
 *   - backend/src/services/siwa-auth-service.ts
 *
 * Impact:
 * - Prevents runtime errors when generating UUIDs
 * - Ensures all crypto operations work correctly
 * - Code now compiles and runs without import errors
 */
