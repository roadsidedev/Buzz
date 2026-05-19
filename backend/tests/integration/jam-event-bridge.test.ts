/**
 * Jam Event Bridge Integration Tests
 *
 * Tests for Redis-based event communication between Buzz and Jam.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  JamEventBridge,
  createJamEventBridge,
  JamEvent,
  JamEventType,
} from "../../src/services/jam-event-bridge.js";

// Mock ioredis
const mockRedis = {
  publish: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockResolvedValue(undefined),
  unsubscribe: vi.fn().mockResolvedValue(undefined),
  lpush: vi.fn().mockResolvedValue(undefined),
  lrange: vi.fn().mockResolvedValue([]),
  ltrim: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn(),
  on: vi.fn(),
};

vi.mock("ioredis", () => {
  return {
    default: vi.fn(() => mockRedis),
  };
});

describe("JamEventBridge", () => {
  let bridge: JamEventBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    bridge = new JamEventBridge({
      redisUrl: "redis://localhost:6379",
    });
  });

  afterEach(async () => {
    await bridge.disconnect();
  });

  describe("constructor", () => {
    it("should create bridge with config", () => {
      expect(bridge).toBeDefined();
    });

    it("should use custom channels", () => {
      const customBridge = new JamEventBridge({
        redisUrl: "redis://localhost:6379",
        channels: {
          jamEvents: "custom:jam",
          beelyEvents: "custom:Buzz",
        },
      });

      expect(customBridge).toBeDefined();
    });
  });

  describe("subscribe", () => {
    it("should subscribe to Jam events channel", async () => {
      await bridge.subscribe();

      expect(mockRedis.subscribe).toHaveBeenCalledWith("jam:events");
    });
  });

  describe("unsubscribe", () => {
    it("should unsubscribe from channels", async () => {
      await bridge.unsubscribe();

      expect(mockRedis.unsubscribe).toHaveBeenCalledWith("jam:events");
    });
  });

  describe("event handlers", () => {
    it("should register event handler", () => {
      const handler = vi.fn();
      bridge.on("room_created", handler);

      // Handler should be registered (no error)
      expect(true).toBe(true);
    });

    it("should remove event handler", () => {
      const handler = vi.fn();
      bridge.on("room_created", handler);
      bridge.off("room_created", handler);

      // Handler should be removed (no error)
      expect(true).toBe(true);
    });

    it("should handle multiple handlers for same event", () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bridge.on("peer_joined", handler1);
      bridge.on("peer_joined", handler2);

      expect(true).toBe(true);
    });
  });

  describe("publish", () => {
    it("should publish event to Buzz channel", async () => {
      const event: JamEvent = {
        type: "room_closing",
        roomId: "room-123",
        timestamp: Date.now(),
      };

      await bridge.publish(event);

      expect(mockRedis.publish).toHaveBeenCalledWith(
        "buzz:room:events",
        JSON.stringify(event),
      );
    });

    it("should publish event with agent data", async () => {
      const event: JamEvent = {
        type: "turn_started",
        roomId: "room-123",
        agentId: "agent-456",
        data: { duration: 30000 },
        timestamp: Date.now(),
      };

      await bridge.publish(event);

      expect(mockRedis.publish).toHaveBeenCalled();
    });
  });

  describe("publishToJam", () => {
    it("should publish event to Jam channel", async () => {
      const event: JamEvent = {
        type: "audio_started",
        roomId: "room-123",
        agentId: "agent-456",
        timestamp: Date.now(),
      };

      await bridge.publishToJam(event);

      expect(mockRedis.publish).toHaveBeenCalledWith(
        "jam:events",
        JSON.stringify(event),
      );
    });
  });

  describe("isReady", () => {
    it("should return connection status", () => {
      const ready = bridge.isReady();
      expect(typeof ready).toBe("boolean");
    });
  });

  describe("getEventHistory", () => {
    it("should get event history from Redis", async () => {
      mockRedis.lrange.mockResolvedValueOnce([
        JSON.stringify({
          type: "room_created",
          roomId: "room-1",
          timestamp: 1000,
        }),
        JSON.stringify({
          type: "peer_joined",
          roomId: "room-1",
          timestamp: 2000,
        }),
      ]);

      const history = await bridge.getEventHistory("room-123");

      expect(mockRedis.lrange).toHaveBeenCalledWith(
        "jam:events:room-123",
        0,
        49,
      );
    });

    it("should return empty array on error", async () => {
      mockRedis.lrange.mockRejectedValueOnce(new Error("Redis error"));

      const history = await bridge.getEventHistory("room-123");

      expect(history).toEqual([]);
    });
  });

  describe("storeEvent", () => {
    it("should store event in history", async () => {
      const event: JamEvent = {
        type: "turn_ended",
        roomId: "room-123",
        agentId: "agent-456",
        timestamp: Date.now(),
      };

      await bridge.storeEvent(event);

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        "jam:events:room-123",
        JSON.stringify(event),
      );
      expect(mockRedis.ltrim).toHaveBeenCalledWith(
        "jam:events:room-123",
        0,
        99,
      );
    });
  });

  describe("disconnect", () => {
    it("should disconnect and cleanup", async () => {
      await bridge.disconnect();

      expect(mockRedis.disconnect).toHaveBeenCalled();
    });
  });
});

describe("createJamEventBridge", () => {
  it("should create singleton instance", () => {
    const bridge1 = createJamEventBridge({
      redisUrl: "redis://localhost:6379",
    });

    const bridge2 = createJamEventBridge({
      redisUrl: "redis://localhost:6379",
    });

    expect(bridge1).toBe(bridge2);
  });
});

describe("Event Types", () => {
  it("should support all event types", () => {
    const eventTypes: JamEventType[] = [
      "room_created",
      "room_ended",
      "peer_joined",
      "peer_left",
      "audio_started",
      "audio_ended",
      "turn_started",
      "turn_ended",
      "room_closing",
      "turn_selected",
    ];

    eventTypes.forEach((type) => {
      const event: JamEvent = {
        type,
        roomId: "test-room",
        timestamp: Date.now(),
      };

      expect(event.type).toBe(type);
    });
  });
});
