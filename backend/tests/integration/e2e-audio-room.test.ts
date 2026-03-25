/**
 * E2E Test: Audio Room Flow
 *
 * End-to-end tests for the complete audio room lifecycle:
 * 1. Agent creates room
 * 2. Jam room created (V2 or V1 fallback)
 * 3. Agent connects via WebSocket
 * 4. Audio streamed
 * 5. Events published
 * 6. Room closed
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { generateKeypair, signPayload } from "../../src/utils/ssr-auth.js";
import { generateTurnCredentials } from "../../src/utils/turn-credentials.js";
import {
  JamServiceV2,
  createJamServiceV2,
  JamConfigV2,
} from "../../src/services/jam-service-v2.js";
import { JamService } from "../../src/services/jam-service.js";
import {
  JamEventBridge,
  createJamEventBridge,
  JamEvent,
} from "../../src/services/jam-event-bridge.js";
import {
  initializeJamServiceFactory,
  getJamServiceFactory,
} from "../../src/services/jam-service-factory.js";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock WebSocket classes defined in vi.hoisted so they are available to vi.mock factories
const { MockWebSocket, FailingWebSocket, wsImpl } = vi.hoisted(() => {
  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = 1; // OPEN
    // DOM-style handlers
    onopen: (() => void) | null = null;
    onerror: ((error: Error) => void) | null = null;
    onclose: (() => void) | null = null;
    onmessage: ((data: { data: string }) => void) | null = null;

    // EventEmitter-style (used by jam-service-v2.ts via ws.on("open", ...))
    private _listeners: Record<string, Array<(...args: any[]) => void>> = {};
    protected _shouldOpen = true;

    constructor(_url: string) {
      setTimeout(() => {
        if (!this._shouldOpen) return;
        this._listeners["open"]?.forEach((fn) => fn());
        this.onopen?.();
      }, 0);
    }

    on(event: string, listener: (...args: any[]) => void) {
      if (!this._listeners[event]) this._listeners[event] = [];
      this._listeners[event].push(listener);
      return this;
    }

    off(event: string, listener: (...args: any[]) => void) {
      if (this._listeners[event]) {
        this._listeners[event] = this._listeners[event].filter(
          (fn) => fn !== listener,
        );
      }
      return this;
    }

    emit(event: string, ...args: any[]) {
      this._listeners[event]?.forEach((fn) => fn(...args));
    }

    send(_data: string) {}
    close() {
      this.readyState = MockWebSocket.CLOSED;
      this._listeners["close"]?.forEach((fn) => fn());
      this.onclose?.();
    }
  }

  class FailingWebSocket extends MockWebSocket {
    constructor(url: string) {
      super(url);
      this._shouldOpen = false; // Prevent "open" event from firing
      setTimeout(() => {
        const err = new Error("Connection refused");
        this.emit("error", err);
        this.onerror?.(err);
      }, 0);
    }
  }

  const wsImpl = { current: MockWebSocket as any };
  return { MockWebSocket, FailingWebSocket, wsImpl };
});

vi.mock("ws", () => ({ get default() { return wsImpl.current; } }));

// Mock ioredis
const mockRedis = {
  publish: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockResolvedValue(undefined),
  unsubscribe: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  disconnect: vi.fn(),
};

vi.mock("ioredis", () => ({
  default: vi.fn(() => mockRedis),
}));

describe("E2E: Audio Room Flow", () => {
  const config: JamConfigV2 = {
    pantryUrl: "http://localhost:3003",
    sfuEnabled: true,
    stunUrl: "stun:localhost:3478",
    turnUrl: "turn:localhost:3478",
    turnSecret: "test-secret",
    turnRealm: "clawzz.dev",
  };

  let service: JamServiceV2;
  let eventBridge: JamEventBridge;
  let hostKeypair: Awaited<ReturnType<typeof generateKeypair>>;

  beforeEach(async () => {
    vi.clearAllMocks();
    hostKeypair = await generateKeypair();
    service = new JamServiceV2(config);
    eventBridge = createJamEventBridge({
      redisUrl: "redis://localhost:6379",
    });
  });

  afterEach(async () => {
    service.disconnect("test-room");
    await eventBridge.disconnect();
  });

  describe("Complete Room Lifecycle", () => {
    it("should complete the full room lifecycle", async () => {
      // Step 1: Create room
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "test-room",
          name: "Test Room",
          stageOnly: true,
          sfuEnabled: true,
          createdAt: new Date().toISOString(),
        }),
      });

      const room = await service.createRoom(
        "test-room",
        {
          title: "AI Debate Room",
          description: "Discussing the future of AI",
          hostId: "agent-1",
          roomType: "debate",
        },
        hostKeypair,
      );

      expect(room.roomId).toBe("test-room");
      expect(room.status).toBe("created");

      // Step 2: Get ICE servers
      const { iceServers, credentials } = service.getIceServers("agent-1");

      expect(iceServers.length).toBeGreaterThan(0);
      expect(credentials).not.toBeNull();

      // Step 3: Connect agent via WebSocket
      const ws = await service.connectAgent("test-room", hostKeypair);
      expect(ws.readyState).toBe(MockWebSocket.OPEN);

      // Step 4: Publish turn event
      const turnEvent: JamEvent = {
        type: "turn_started",
        roomId: "test-room",
        agentId: "agent-1",
        data: { duration: 30000 },
        timestamp: Date.now(),
      };

      await eventBridge.publish(turnEvent);
      expect(mockRedis.publish).toHaveBeenCalled();

      // Step 5: End room
      mockFetch.mockResolvedValueOnce({ ok: true });

      await service.endRoom("test-room", hostKeypair);
      service.disconnect("test-room");
    });

    it("should handle multiple agents joining room", async () => {
      // Create room
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "multi-agent-room",
          name: "Multi Agent Room",
          stageOnly: true,
          sfuEnabled: true,
          createdAt: new Date().toISOString(),
        }),
      });

      await service.createRoom(
        "multi-agent-room",
        {
          title: "Multi-Agent Debate",
          description: "Multiple AI agents",
          hostId: "agent-1",
          roomType: "debate",
        },
        hostKeypair,
      );

      // Connect multiple agents
      const agent2Keypair = await generateKeypair();
      const agent3Keypair = await generateKeypair();

      const ws1 = await service.connectAgent("multi-agent-room", hostKeypair);
      const ws2 = await service.connectAgent("multi-agent-room", agent2Keypair);
      const ws3 = await service.connectAgent("multi-agent-room", agent3Keypair);

      expect(ws1.readyState).toBe(MockWebSocket.OPEN);
      expect(ws2.readyState).toBe(MockWebSocket.OPEN);
      expect(ws3.readyState).toBe(MockWebSocket.OPEN);

      // Publish peer joined events
      await eventBridge.publish({
        type: "peer_joined",
        roomId: "multi-agent-room",
        peerId: "agent-2",
        timestamp: Date.now(),
      });

      await eventBridge.publish({
        type: "peer_joined",
        roomId: "multi-agent-room",
        peerId: "agent-3",
        timestamp: Date.now(),
      });

      expect(mockRedis.publish).toHaveBeenCalledTimes(2);
    });

    it("should handle audio streaming events", async () => {
      // Setup room
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "audio-room",
          name: "Audio Room",
          stageOnly: true,
          sfuEnabled: true,
          createdAt: new Date().toISOString(),
        }),
      });

      await service.createRoom(
        "audio-room",
        {
          title: "Audio Test",
          description: "Testing audio",
          hostId: "agent-1",
          roomType: "debate",
        },
        hostKeypair,
      );

      // Simulate audio start
      await eventBridge.publishToJam({
        type: "audio_started",
        roomId: "audio-room",
        agentId: "agent-1",
        data: { messageId: "msg-123" },
        timestamp: Date.now(),
      });

      // Simulate audio end
      await eventBridge.publishToJam({
        type: "audio_ended",
        roomId: "audio-room",
        agentId: "agent-1",
        data: { messageId: "msg-123" },
        timestamp: Date.now(),
      });

      expect(mockRedis.publish).toHaveBeenCalledWith(
        "jam:events",
        expect.stringContaining("audio_started"),
      );
      expect(mockRedis.publish).toHaveBeenCalledWith(
        "jam:events",
        expect.stringContaining("audio_ended"),
      );
    });
  });

  describe("Error Handling", () => {
    it("should handle room creation failure gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      await expect(
        service.createRoom(
          "fail-room",
          {
            title: "Fail Room",
            description: "This should fail",
            hostId: "agent-1",
            roomType: "debate",
          },
          hostKeypair,
        ),
      ).rejects.toThrow();
    });

    it("should handle WebSocket connection failure", async () => {
      // Switch to FailingWebSocket for this test
      wsImpl.current = FailingWebSocket;
      try {
        await expect(
          service.connectAgent("fail-room", hostKeypair),
        ).rejects.toThrow();
      } finally {
        wsImpl.current = MockWebSocket;
      }
    });
  });

  describe("Fallback Behavior", () => {
    it("should fallback to V1 when V2 fails and fallback enabled", async () => {
      const fallbackService = new JamService(
        "http://localhost:3001",
        "test-key",
      );
      const serviceWithFallback = new JamServiceV2(config, fallbackService);

      // V2 fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => "Service Unavailable",
      });

      // V1 succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "fallback-room",
          url: "http://localhost:3001/fallback-room",
          createdAt: new Date().toISOString(),
        }),
      });

      const result = await serviceWithFallback.createRoom(
        "fallback-room",
        {
          title: "Fallback Room",
          description: "Testing fallback",
          hostId: "agent-1",
          roomType: "debate",
        },
        hostKeypair,
      );

      expect(result.roomId).toBe("fallback-room");
      expect(result.status).toBe("created");
    });
  });
});

describe("Jam Service Factory E2E", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      JAM_SELF_HOSTED_ENABLED: "true",
      JAM_FALLBACK_ENABLED: "true",
      PANTRY_URL: "http://localhost:3003",
      COTURN_SECRET: "test-secret",
      COTURN_REALM: "clawzz.dev",
      REDIS_URL: "redis://localhost:6379",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should initialize factory from environment", () => {
    const factory = initializeJamServiceFactory();

    expect(factory).toBeDefined();
    expect(factory.isConfigured()).toBe(true);
    expect(factory.getServiceType()).toBe("v2");
  });

  it("should get service from factory", () => {
    const factory = initializeJamServiceFactory();
    const service = factory.getService();

    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(JamServiceV2);
  });

  it("should get event bridge from factory", () => {
    const factory = initializeJamServiceFactory();
    const bridge = factory.getEventBridge();

    expect(bridge).toBeDefined();
  });
});

describe("TURN Credentials E2E", () => {
  it("should generate valid credentials for WebRTC", () => {
    const secret = "test-turn-secret";
    const credentials = generateTurnCredentials(secret, "webrtc-client", 86400);

    expect(credentials.username).toMatch(/^\d+:webrtc-client$/);
    expect(credentials.credential).toBeDefined();
    expect(credentials.ttl).toBe(86400);
    expect(credentials.expiresAt).toBeGreaterThan(Date.now());
  });

  it("should generate different credentials per session", () => {
    const secret = "test-turn-secret";

    const cred1 = generateTurnCredentials(secret, "session-1");
    const cred2 = generateTurnCredentials(secret, "session-2");

    expect(cred1.username).not.toBe(cred2.username);
  });
});
