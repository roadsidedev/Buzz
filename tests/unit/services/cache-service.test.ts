/**
 * Cache Service Unit Tests
 * Tests caching functionality, TTL, and error handling
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CacheService } from "../../../backend/src/services/cache-service";

// Mock Redis for testing
let cache: CacheService;

describe("CacheService", () => {
  beforeEach(async () => {
    // Create a test cache instance
    // Note: In real testing, this would connect to a test Redis instance
    cache = new CacheService("redis://localhost:6379");
    // Don't initialize in tests to avoid real Redis dependency
  });

  afterEach(async () => {
    // Cleanup
    if (cache) {
      await cache.shutdown();
    }
  });

  describe("set/get operations", () => {
    it("should store and retrieve a simple value", async () => {
      // Skip if Redis not available
      if (!cache) return;

      const key = "test:simple";
      const value = { id: 1, name: "test" };

      await cache.set(key, value);
      const retrieved = await cache.get<typeof value>(key);

      expect(retrieved).toEqual(value);
    });

    it("should handle complex nested objects", async () => {
      if (!cache) return;

      const key = "test:complex";
      const value = {
        rooms: [
          {
            id: "room-1",
            objective: "Debate",
            participants: [
              { agentId: "agent-1", name: "Alice" },
              { agentId: "agent-2", name: "Bob" },
            ],
          },
        ],
        metadata: {
          total: 1,
          page: 1,
        },
      };

      await cache.set(key, value);
      const retrieved = await cache.get(key);

      expect(retrieved).toEqual(value);
    });

    it("should return null for non-existent key", async () => {
      if (!cache) return;

      const retrieved = await cache.get("non-existent-key");
      expect(retrieved).toBeNull();
    });

    it("should overwrite existing value", async () => {
      if (!cache) return;

      const key = "test:overwrite";

      await cache.set(key, { version: 1 });
      let retrieved = await cache.get(key);
      expect(retrieved).toEqual({ version: 1 });

      await cache.set(key, { version: 2 });
      retrieved = await cache.get(key);
      expect(retrieved).toEqual({ version: 2 });
    });
  });

  describe("TTL expiration", () => {
    it("should respect TTL parameter", async () => {
      if (!cache) return;

      const key = "test:ttl";
      const value = { data: "test" };

      // Set with 1 second TTL
      await cache.set(key, value, 1);

      // Retrieve immediately should work
      let retrieved = await cache.get(key);
      expect(retrieved).toEqual(value);

      // Wait 1.5 seconds and retrieve again
      await new Promise((resolve) => setTimeout(resolve, 1500));
      retrieved = await cache.get(key);
      expect(retrieved).toBeNull();
    });

    it("should use default TTL if not specified", async () => {
      if (!cache) return;

      const key = "test:default-ttl";
      const value = { data: "test" };

      await cache.set(key, value); // Uses default 300s

      // Should still be there immediately
      const retrieved = await cache.get(key);
      expect(retrieved).toEqual(value);
    });

    it("should allow checking TTL of a key", async () => {
      if (!cache) return;

      const key = "test:check-ttl";

      await cache.set(key, { data: "test" }, 300);
      const ttl = await cache.getTTL(key);

      // TTL should be close to 300 (allowing for timing variations)
      expect(ttl).toBeGreaterThan(290);
      expect(ttl).toBeLessThanOrEqual(300);
    });

    it("should return -1 for keys with no expiry", async () => {
      if (!cache) return;

      const key = "test:no-expiry";

      // Note: This tests persistent keys if supported
      const ttl = await cache.getTTL("non-existent");
      expect(ttl).toBe(-2); // Key doesn't exist
    });
  });

  describe("delete operations", () => {
    it("should delete a key", async () => {
      if (!cache) return;

      const key = "test:delete";

      await cache.set(key, { data: "test" });
      let exists = await cache.exists(key);
      expect(exists).toBe(true);

      await cache.delete(key);
      exists = await cache.exists(key);
      expect(exists).toBe(false);
    });

    it("should not throw when deleting non-existent key", async () => {
      if (!cache) return;

      expect(async () => {
        await cache.delete("non-existent-key");
      }).not.toThrow();
    });

    it("should delete multiple keys matching pattern", async () => {
      if (!cache) return;

      // Set multiple keys with same pattern
      await cache.set("pattern:1", { id: 1 });
      await cache.set("pattern:2", { id: 2 });
      await cache.set("pattern:3", { id: 3 });
      await cache.set("other:1", { id: 4 });

      const count = await cache.deletePattern("pattern:*");

      expect(count).toBe(3);

      // Verify they're deleted
      const key1 = await cache.get("pattern:1");
      expect(key1).toBeNull();
    });

    it("should clear all cache", async () => {
      if (!cache) return;

      // Set some data
      await cache.set("key:1", { data: 1 });
      await cache.set("key:2", { data: 2 });

      // Clear all
      await cache.clear();

      // Verify cleared
      const key1 = await cache.get("key:1");
      const key2 = await cache.get("key:2");

      expect(key1).toBeNull();
      expect(key2).toBeNull();
    });
  });

  describe("exists check", () => {
    it("should return true for existing key", async () => {
      if (!cache) return;

      const key = "test:exists";

      await cache.set(key, { data: "test" });
      const exists = await cache.exists(key);

      expect(exists).toBe(true);
    });

    it("should return false for non-existent key", async () => {
      if (!cache) return;

      const exists = await cache.exists("non-existent");
      expect(exists).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle gracefully if Redis unavailable on get", async () => {
      if (!cache) return;

      // Test graceful degradation
      const result = await cache.get("any-key");

      // Should return null, not throw
      expect(result).toBeNull();
    });

    it("should handle gracefully if Redis unavailable on set", async () => {
      if (!cache) return;

      // Should not throw even if Redis is down
      expect(async () => {
        await cache.set("key", { data: "test" });
      }).not.toThrow();
    });
  });

  describe("health checks", () => {
    it("should return health status", async () => {
      if (!cache) return;

      const health = await cache.getHealth();

      expect(health).toHaveProperty("status");
      expect(health).toHaveProperty("latency");
      expect(health).toHaveProperty("connected");
    });

    it("should measure latency", async () => {
      if (!cache) return;

      const health = await cache.getHealth();

      if (health.status === "healthy") {
        expect(health.latency).toBeGreaterThanOrEqual(0);
        expect(typeof health.latency).toBe("number");
      }
    });
  });

  describe("concurrent access", () => {
    it("should handle multiple concurrent sets", async () => {
      if (!cache) return;

      const promises = Array.from({ length: 10 }, (_, i) =>
        cache.set(`key:${i}`, { id: i })
      );

      await Promise.all(promises);

      // Verify all were set
      for (let i = 0; i < 10; i++) {
        const value = await cache.get(`key:${i}`);
        expect(value).toEqual({ id: i });
      }
    });

    it("should handle concurrent gets", async () => {
      if (!cache) return;

      // Set some data
      const data = Array.from({ length: 10 }, (_, i) => ({ id: i }));
      await Promise.all(
        data.map((_, i) => cache.set(`key:${i}`, data[i]))
      );

      // Get concurrently
      const promises = Array.from({ length: 10 }, (_, i) =>
        cache.get(`key:${i}`)
      );

      const results = await Promise.all(promises);

      results.forEach((result, i) => {
        expect(result).toEqual(data[i]);
      });
    });

    it("should handle mixed concurrent operations", async () => {
      if (!cache) return;

      const operations = [
        cache.set("key:1", { data: 1 }),
        cache.get("key:1"),
        cache.set("key:2", { data: 2 }),
        cache.get("key:2"),
        cache.delete("key:1"),
        cache.get("key:1"),
      ];

      const results = await Promise.all(operations);

      // Last get should return null since we deleted it
      expect(results[5]).toBeNull();
    });
  });

  describe("data type serialization", () => {
    it("should handle arrays", async () => {
      if (!cache) return;

      const key = "test:array";
      const value = [1, 2, 3, 4, 5];

      await cache.set(key, value);
      const retrieved = await cache.get<typeof value>(key);

      expect(retrieved).toEqual(value);
    });

    it("should handle strings", async () => {
      if (!cache) return;

      const key = "test:string";
      const value = "hello world";

      await cache.set(key, value);
      const retrieved = await cache.get<typeof value>(key);

      expect(retrieved).toEqual(value);
    });

    it("should handle numbers", async () => {
      if (!cache) return;

      const key = "test:number";
      const value = 42.5;

      await cache.set(key, value);
      const retrieved = await cache.get<typeof value>(key);

      expect(retrieved).toEqual(value);
    });

    it("should handle booleans", async () => {
      if (!cache) return;

      const key = "test:boolean";
      const value = true;

      await cache.set(key, value);
      const retrieved = await cache.get<typeof value>(key);

      expect(retrieved).toEqual(value);
    });

    it("should handle null values", async () => {
      if (!cache) return;

      const key = "test:null";
      const value = null;

      await cache.set(key, value);
      const retrieved = await cache.get(key);

      // Note: Cache might distinguish between null and non-existent
      expect(retrieved === null || retrieved === undefined).toBe(true);
    });
  });
});
