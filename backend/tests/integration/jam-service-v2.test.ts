/**
 * Jam Service V2 Integration Tests
 *
 * Tests for self-hosted Jam service with SSR authentication.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import WebSocket from "ws";
import {
  JamServiceV2,
  createJamServiceV2,
  JamConfigV2,
} from "../../src/services/jam-service-v2.js";
import { JamService } from "../../src/services/jam-service.js";
import { generateKeypair, AgentKeyPair } from "../../src/utils/ssr-auth.js";

// Mock fetch for testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock WebSocket - define inside vi.mock to avoid hoisting issues
vi.mock("ws", () => {
  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = MockWebSocket.OPEN;
    private eventHandlers: Map<string, Function[]> = new Map();

    constructor(url: string) {
      setTimeout(() => this.emit("open"), 0);
    }

    on(event: string, handler: Function) {
      const handlers = this.eventHandlers.get(event) || [];
      handlers.push(handler);
      this.eventHandlers.set(event, handlers);
    }

    emit(event: string, ...args: any[]) {
      const handlers = this.eventHandlers.get(event) || [];
      handlers.forEach((h) => h(...args));
    }

    send(data: string) {}
    close() {
      this.readyState = MockWebSocket.CLOSED;
      this.emit("close");
    }
  }
  return { default: MockWebSocket };
});

describe("JamServiceV2", () => {
  let service: JamServiceV2;
  let keypair: AgentKeyPair;
  const config: JamConfigV2 = {
    pantryUrl: "http://localhost:3003",
    sfuEnabled: true,
    stunUrl: "stun:localhost:3478",
    turnUrl: "turn:localhost:3478",
    turnSecret: "test-secret",
    turnRealm: "clawhouse.dev",
  };

  beforeEach(async () => {
    keypair = await generateKeypair();
    service = new JamServiceV2(config);
    mockFetch.mockReset();
  });

  afterEach(() => {
    service.disconnect("test-room");
  });

  describe("constructor", () => {
    it("should initialize with config", () => {
      expect(service).toBeDefined();
      expect(service.hasFallback()).toBe(false);
    });

    it("should accept fallback service", () => {
      const fallback = new JamService("http://localhost:3001", "test-key");
      const serviceWithFallback = new JamServiceV2(config, fallback);

      expect(serviceWithFallback.hasFallback()).toBe(true);
    });
  });

  describe("createRoom", () => {
    it("should create room with SSR auth", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "room-123",
          name: "Test Room",
          stageOnly: true,
          sfuEnabled: true,
          createdAt: new Date().toISOString(),
        }),
      });

      const result = await service.createRoom(
        "room-123",
        {
          title: "Test Room",
          description: "Test Description",
          hostId: "agent-1",
          roomType: "debate",
        },
        keypair,
      );

      expect(result.roomId).toBe("room-123");
      expect(result.status).toBe("created");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3003/api/v1/rooms/room-123",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        }),
      );
    });

    it("should handle creation failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      await expect(
        service.createRoom(
          "room-123",
          {
            title: "Test Room",
            description: "Test",
            hostId: "agent-1",
            roomType: "debate",
          },
          keypair,
        ),
      ).rejects.toThrow();
    });

    it("should fallback to V1 on failure if available", async () => {
      const fallback = new JamService("http://localhost:3001", "test-key");
      const serviceWithFallback = new JamServiceV2(config, fallback);

      // V2 fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Error",
      });

      // V1 succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "room-123",
          url: "http://localhost:3001/room-123",
          createdAt: new Date().toISOString(),
        }),
      });

      const result = await serviceWithFallback.createRoom(
        "room-123",
        {
          title: "Test Room",
          description: "Test",
          hostId: "agent-1",
          roomType: "debate",
        },
        keypair,
      );

      expect(result.roomId).toBe("room-123");
    });
  });

  describe("endRoom", () => {
    it("should end room with SSR auth", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      });

      await service.endRoom("room-123", keypair);

      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3003/api/v1/rooms/room-123/end",
        expect.objectContaining({
          method: "POST",
        }),
      );
    });
  });

  describe("getIceServers", () => {
    it("should return ICE server configuration", () => {
      const iceServers = service.getIceServers("test-user");

      expect(iceServers.iceServers).toBeDefined();
      expect(iceServers.iceServers.length).toBeGreaterThan(0);
      expect(iceServers.credentials).not.toBeNull();
    });

    it("should include STUN server", () => {
      const { iceServers } = service.getIceServers();

      const stunServer = iceServers.find(
        (s) => typeof s.urls === "string" && s.urls.startsWith("stun:"),
      );
      expect(stunServer).toBeDefined();
    });

    it("should include TURN server with credentials", () => {
      const { iceServers, credentials } = service.getIceServers();

      const turnServer = iceServers.find((s) => s.username);
      expect(turnServer).toBeDefined();
      expect(turnServer?.username).toBe(credentials?.username);
    });
  });

  describe("getRoomStatus", () => {
    it("should get room status", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: "active" }),
      });

      const status = await service.getRoomStatus("room-123");

      expect(status).toBe("active");
    });

    it("should return 'unknown' on failure", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      });

      const status = await service.getRoomStatus("room-123");

      expect(status).toBe("unknown");
    });
  });

  describe("healthCheck", () => {
    it("should return true when healthy", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true });

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(true);
    });

    it("should return false when unhealthy", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Connection refused"));

      const isHealthy = await service.healthCheck();

      expect(isHealthy).toBe(false);
    });
  });

  describe("WebSocket connections", () => {
    it("should connect agent to room", async () => {
      const ws = await service.connectAgent("room-123", keypair);

      expect(ws).toBeDefined();
      expect(ws.readyState).toBe(WebSocket.OPEN);
    });

    it("should disconnect from room", () => {
      service.disconnect("room-123");
      // Should not throw
    });

    it("should send message to room", async () => {
      await service.connectAgent("room-123", keypair);

      // Should not throw
      service.sendToRoom("room-123", "test-topic", "test-type", {
        data: "test",
      });
    });
  });
});

describe("createJamServiceV2", () => {
  it("should create service instance", () => {
    const service = createJamServiceV2({
      pantryUrl: "http://localhost:3003",
      sfuEnabled: true,
      stunUrl: "stun:localhost:3478",
      turnUrl: "turn:localhost:3478",
      turnSecret: "secret",
      turnRealm: "test",
    });

    expect(service).toBeInstanceOf(JamServiceV2);
  });
});
