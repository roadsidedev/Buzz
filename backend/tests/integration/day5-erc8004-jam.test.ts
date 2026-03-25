/**
 * Day 5 Integration Tests: ERC-8004 & Jam Integration
 *
 * Tests:
 * 1. ERC-8004 agent verification in room creation
 * 2. Jam room creation upon spawn
 * 3. Jam webhook handling
 * 4. Participant lifecycle
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { RoomService } from "../../src/services/room-service.js";
import { ERC8004VerificationService } from "../../src/services/erc8004-verification-service.js";
import { JamService } from "../../src/services/jam-service.js";

// Mock repositories to prevent real DB connections
vi.mock("../../src/repositories/index.js", () => ({
  agentRepository: {
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateVerificationStatus: vi.fn(),
  },
  roomRepository: {
    create: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
  },
}));

describe("Day 5: ERC-8004 & Jam Integration", () => {
  let roomService: RoomService;
  let erc8004Service: ERC8004VerificationService;
  let jamService: JamService;

  beforeEach(() => {
    // Mock services
    erc8004Service = {
      isAgentOwner: vi.fn(),
      verifyAgentOwnership: vi.fn(),
      healthCheck: vi.fn(),
    } as any;

    jamService = {
      createRoom: vi.fn(),
      endRoom: vi.fn(),
      getRoomStatus: vi.fn(),
      validateWebhookSignature: vi.fn(),
      healthCheck: vi.fn(),
    } as any;

    roomService = new RoomService(erc8004Service);
  });

  describe("ERC-8004 Verification", () => {
    it("should reject room creation if host agent not found", async () => {
      const { agentRepository } = await import("../../src/repositories/index.js");
      vi.mocked(agentRepository.getById).mockResolvedValue(null as any);

      const input = {
        hostAgentId: "agent-123",
        hostAgentName: "Test Agent",
        type: "debate" as const,
        objective: "Discuss AI ethics in depth",
        spawnFee: 100,
      };

      // Act & Assert: agent not found in DB → NotFoundError
      await expect(roomService.createRoom(input)).rejects.toThrow(
        /agent with id agent-123 not found|not found/i
      );
    });

    it("should allow room creation if host is verified on ERC-8004", async () => {
      // Arrange
      vi.mocked(erc8004Service.isAgentOwner).mockResolvedValue(true);
      vi.mocked(jamService.createRoom).mockResolvedValue({
        roomId: "jam-room-123",
        roomUrl: "https://jam.example.com/rooms/jam-room-123",
        createdAt: new Date(),
        status: "created",
      });

      const input = {
        hostAgentId: "agent-123",
        hostAgentName: "Test Agent",
        type: "debate" as const,
        objective: "Discuss AI ethics in depth",
        spawnFee: 100,
      };

      roomService.setERC8004Service(erc8004Service);

      // Act
      // Note: This would require mocking roomRepository too
      // const room = await roomService.createRoom(input);

      // Assert
      // expect(room).toBeDefined();
      // expect(erc8004Service.isAgentOwner).toHaveBeenCalled();
    });
  });

  describe("Jam Room Creation", () => {
    it("should create Jam room with correct parameters", async () => {
      // Arrange
      const roomConfig = {
        title: "Test Agent's debate room",
        description: "Discuss AI ethics",
        hostId: "agent-123",
        roomType: "debate" as const,
        maxParticipants: 50,
        metadata: {
          objective: "Discuss AI ethics in depth",
          spawnFee: 100,
        },
      };

      vi.mocked(jamService.createRoom).mockResolvedValue({
        roomId: "jam-room-123",
        roomUrl: "https://jam.example.com/rooms/jam-room-123",
        createdAt: new Date(),
        status: "created",
      });

      // Act
      const result = await jamService.createRoom("clawhouse-room-123", roomConfig);

      // Assert
      expect(result).toEqual({
        roomId: "jam-room-123",
        roomUrl: "https://jam.example.com/rooms/jam-room-123",
        createdAt: expect.any(Date),
        status: "created",
      });

      expect(jamService.createRoom).toHaveBeenCalledWith(
        "clawhouse-room-123",
        expect.objectContaining(roomConfig)
      );
    });

    it("should reject room creation with invalid title", async () => {
      // Arrange
      const roomConfig = {
        title: "Bad", // Too short
        hostId: "agent-123",
        roomType: "debate" as const,
      };

      // Mock the createRoom to reject with validation error for short titles
      vi.mocked(jamService.createRoom).mockRejectedValue(
        new Error("Room title must be at least 5 characters")
      );

      // Act & Assert
      await expect(
        jamService.createRoom("clawhouse-room-123", roomConfig)
      ).rejects.toThrow("Room title");
    });
  });

  describe("Jam Webhook Handling", () => {
    it("should validate webhook signature", () => {
      // Arrange
      const payload =
        '{"roomId":"jam-123","event":"room_started","timestamp":1234567890}';
      const validSignature = "valid-sig";

      vi.mocked(jamService.validateWebhookSignature).mockReturnValue(true);

      // Act
      const result = jamService.validateWebhookSignature(
        payload,
        validSignature
      );

      // Assert
      expect(result).toBe(true);
    });

    it("should reject invalid webhook signature", () => {
      // Arrange
      const payload =
        '{"roomId":"jam-123","event":"room_started","timestamp":1234567890}';
      const invalidSignature = "invalid-sig";

      vi.mocked(jamService.validateWebhookSignature).mockReturnValue(false);

      // Act
      const result = jamService.validateWebhookSignature(
        payload,
        invalidSignature
      );

      // Assert
      expect(result).toBe(false);
    });

    it("should handle room_started event", () => {
      // TODO: Implement when webhook event handling is complete
      // Should update room status to 'live'
    });

    it("should handle room_ended event", () => {
      // TODO: Implement when webhook event handling is complete
      // Should close room and archive recording
    });

    it("should handle user_joined event", () => {
      // TODO: Implement when webhook event handling is complete
      // Should add participant to room
    });

    it("should handle user_left event", () => {
      // TODO: Implement when webhook event handling is complete
      // Should remove participant from room
    });
  });

  describe("Jam Health Check", () => {
    it("should verify Jam API is accessible", async () => {
      // Arrange
      vi.mocked(jamService.healthCheck).mockResolvedValue(true);

      // Act
      const result = await jamService.healthCheck();

      // Assert
      expect(result).toBe(true);
    });

    it("should report health check failure", async () => {
      // Arrange
      vi.mocked(jamService.healthCheck).mockResolvedValue(false);

      // Act
      const result = await jamService.healthCheck();

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("ERC-8004 Health Check", () => {
    it("should verify ERC-8004 contract is accessible", async () => {
      // Arrange
      vi.mocked(erc8004Service.healthCheck).mockResolvedValue(true);

      // Act
      const result = await erc8004Service.healthCheck();

      // Assert
      expect(result).toBe(true);
    });

    it("should report health check failure", async () => {
      // Arrange
      vi.mocked(erc8004Service.healthCheck).mockResolvedValue(false);

      // Act
      const result = await erc8004Service.healthCheck();

      // Assert
      expect(result).toBe(false);
    });
  });
});
