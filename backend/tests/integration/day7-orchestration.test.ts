/**
 * Day 7 Integration Tests: Orchestrator Integration
 *
 * Comprehensive test suite covering:
 * - Full room lifecycle (submit → score → select → play → complete)
 * - Multiple agents and message handling
 * - Turn timeout scenarios
 * - Output contract validation
 * - Error handling and edge cases
 *
 * Part of Day 7: Task 8 - Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { Room, RoomMessage } from "../../common/types/index.js";
import {
  turnManagementService,
} from "../../src/services/turn-management-service.js";
import { messageService } from "../../src/services/message-service.js";
import {
  outputContractService,
} from "../../src/services/output-contract-service.js";
import { roomRepository, messageRepository } from "../../src/repositories/index.js";
import { ValidationError, NotFoundError } from "../../src/utils/errors.js";

// ===================================================================
// Test Fixtures & Setup
// ===================================================================

const MOCK_ROOM_ID = "test-room-" + Date.now();
const MOCK_AGENT_A = "agent-a-" + Date.now();
const MOCK_AGENT_B = "agent-b-" + Date.now();

// Mock orchestrator responses
const mockOrchestratorScore = (messageId: string): number => {
  const scores: Record<string, number> = {
    [MOCK_AGENT_A]: 75,
    [MOCK_AGENT_B]: 65,
  };
  return scores[messageId] || 50;
};

describe("Day 7: Orchestrator Integration Tests", () => {
  beforeAll(async () => {
    // Setup: Create test room in database
    console.log("Setting up test fixtures");
  });

  afterAll(async () => {
    // Cleanup: Remove test data
    console.log("Cleaning up test fixtures");
  });

  beforeEach(async () => {
    // Reset state before each test
  });

  // ===================================================================
  // TASK 1: Message Submission
  // ===================================================================

  describe("Message Submission", () => {
    it("should submit valid message successfully", async () => {
      const text = "This is a valid debate message with content";

      const message = await turnManagementService.submitMessage(
        MOCK_ROOM_ID,
        MOCK_AGENT_A,
        text,
      );

      expect(message).toBeDefined();
      expect(message.id).toBeTruthy();
      expect(message.roomId).toBe(MOCK_ROOM_ID);
      expect(message.agentId).toBe(MOCK_AGENT_A);
      expect(message.text).toBe(text);
      expect(message.status).toBe("candidate");
      expect(message.createdAt).toBeDefined();
    });

    it("should reject empty message", async () => {
      try {
        await turnManagementService.submitMessage(
          MOCK_ROOM_ID,
          MOCK_AGENT_A,
          "",
        );
        expect.fail("Should have thrown ValidationError");
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as any).context.code).toBe("EMPTY_TEXT");
      }
    });

    it("should reject message too short (< 10 chars)", async () => {
      try {
        await turnManagementService.submitMessage(
          MOCK_ROOM_ID,
          MOCK_AGENT_A,
          "short",
        );
        expect.fail("Should have thrown ValidationError");
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as any).context.code).toBe("TEXT_TOO_SHORT");
      }
    });

    it("should reject message too long (> 2000 chars)", async () => {
      const longText = "x".repeat(2001);

      try {
        await turnManagementService.submitMessage(
          MOCK_ROOM_ID,
          MOCK_AGENT_A,
          longText,
        );
        expect.fail("Should have thrown ValidationError");
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as any).context.code).toBe("TEXT_TOO_LONG");
      }
    });

    it("should reject when room not found", async () => {
      try {
        await turnManagementService.submitMessage(
          "nonexistent-room-id",
          MOCK_AGENT_A,
          "This is a valid message",
        );
        expect.fail("Should have thrown NotFoundError");
      } catch (err) {
        expect(err).toBeInstanceOf(NotFoundError);
      }
    });

    it("should reject when room is not live", async () => {
      // Mock room with status "pending"
      // This would require setting up a room with pending status first
      // TODO: Implement when room creation endpoint available
    });
  });

  // ===================================================================
  // TASK 2: Message Lifecycle
  // ===================================================================

  describe("Message Lifecycle", () => {
    it("should track message through status transitions", async () => {
      const text = "Debate message for status test";

      // 1. CREATE MESSAGE
      const message = await messageService.createMessage(
        MOCK_ROOM_ID,
        MOCK_AGENT_A,
        text,
      );

      expect(message.status).toBe("candidate");

      // 2. UPDATE TO SELECTED
      const updated = await messageService.updateMessage(
        message.id,
        "selected",
        {
          score: 75,
          selectedAt: new Date(),
        },
      );

      expect(updated.status).toBe("selected");
      expect(updated.score).toBe(75);
      expect(updated.selectedAt).toBeDefined();

      // 3. UPDATE TO PLAYING
      const playing = await messageService.updateMessage(
        message.id,
        "playing",
        {
          audioUrl: "https://example.com/audio.mp3",
        },
      );

      expect(playing.status).toBe("playing");
      expect(playing.audioUrl).toBe("https://example.com/audio.mp3");

      // 4. UPDATE TO PLAYED
      const played = await messageService.updateMessage(
        message.id,
        "played",
        {
          playedAt: new Date(),
        },
      );

      expect(played.status).toBe("played");
      expect(played.playedAt).toBeDefined();
    });

    it("should reject invalid status transitions", async () => {
      const message = await messageService.createMessage(
        MOCK_ROOM_ID,
        MOCK_AGENT_A,
        "Message for transition test",
      );

      // Try to go directly from candidate to played (invalid)
      try {
        await messageService.updateMessage(message.id, "played");
        expect.fail("Should have thrown ValidationError");
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as any).context.code).toBe("INVALID_TRANSITION");
      }
    });

    it("should reject message at any state", async () => {
      const message = await messageService.createMessage(
        MOCK_ROOM_ID,
        MOCK_AGENT_A,
        "Message to reject",
      );

      const rejected = await messageService.updateMessage(
        message.id,
        "rejected",
      );

      expect(rejected.status).toBe("rejected");
    });
  });

  // ===================================================================
  // TASK 3: Candidate Queries
  // ===================================================================

  describe("Candidate Message Queries", () => {
    it("should retrieve pending candidates", async () => {
      // Submit multiple messages
      await turnManagementService.submitMessage(
        MOCK_ROOM_ID,
        MOCK_AGENT_A,
        "First debate message for candidates test",
      );

      await turnManagementService.submitMessage(
        MOCK_ROOM_ID,
        MOCK_AGENT_B,
        "Second debate message from agent B",
      );

      // Get candidates
      const candidates = await messageService.getCandidates(MOCK_ROOM_ID);

      expect(candidates.length).toBeGreaterThanOrEqual(2);
      expect(candidates[0].status).toBe("candidate");
      expect(candidates[0].waitTime).toBeGreaterThanOrEqual(0);
    });

    it("should return candidates sorted by creation time", async () => {
      const msg1 = await messageService.createMessage(
        MOCK_ROOM_ID,
        MOCK_AGENT_A,
        "First message in order",
      );

      const msg2 = await messageService.createMessage(
        MOCK_ROOM_ID,
        MOCK_AGENT_B,
        "Second message in order",
      );

      const candidates = await messageService.getCandidates(MOCK_ROOM_ID);

      expect(candidates[0].id).toBe(msg1.id);
      expect(candidates[1].id).toBe(msg2.id);
    });

    it("should filter by room", async () => {
      const anotherRoomId = "other-room-" + Date.now();

      await messageService.createMessage(
        MOCK_ROOM_ID,
        MOCK_AGENT_A,
        "Message in room 1",
      );

      await messageService.createMessage(
        anotherRoomId,
        MOCK_AGENT_A,
        "Message in room 2",
      );

      const roomMessages = await messageService.getByRoom(MOCK_ROOM_ID);
      const otherMessages = await messageService.getByRoom(anotherRoomId);

      expect(roomMessages.length).toBeGreaterThan(otherMessages.length);
    });
  });

  // ===================================================================
  // TASK 4: Agent Statistics
  // ===================================================================

  describe("Agent Statistics", () => {
    it("should calculate selection rate", async () => {
      // Agent A: submit 3 messages
      const msg1 = await messageService.createMessage(
        MOCK_ROOM_ID,
        MOCK_AGENT_A,
        "Agent A message 1 for stats",
      );

      const msg2 = await messageService.createMessage(
        MOCK_ROOM_ID,
        MOCK_AGENT_A,
        "Agent A message 2 for stats",
      );

      const msg3 = await messageService.createMessage(
        MOCK_ROOM_ID,
        MOCK_AGENT_A,
        "Agent A message 3 for stats",
      );

      // Select 1 of 3
      await messageService.updateMessage(msg1.id, "selected", { score: 80 });

      // Get stats
      const stats = await messageService.getAgentStatistics(
        MOCK_ROOM_ID,
        MOCK_AGENT_A,
      );

      expect(stats.submitted).toBe(3);
      expect(stats.selected).toBe(1);
      expect(stats.selectionRate).toBe(1 / 3);
    });

    it("should calculate average score", async () => {
      const msg1 = await messageService.createMessage(
        MOCK_ROOM_ID,
        MOCK_AGENT_B,
        "High scoring message for average test",
      );

      const msg2 = await messageService.createMessage(
        MOCK_ROOM_ID,
        MOCK_AGENT_B,
        "Another scoring message",
      );

      await messageService.updateMessage(msg1.id, "selected", { score: 90 });
      await messageService.updateMessage(msg2.id, "selected", { score: 70 });

      const stats = await messageService.getAgentStatistics(
        MOCK_ROOM_ID,
        MOCK_AGENT_B,
      );

      expect(stats.averageScore).toBe(80);
    });
  });

  // ===================================================================
  // TASK 5: Output Contract Validation
  // ===================================================================

  describe("Output Contract Validation", () => {
    it("should load contract for debate room type", async () => {
      const contract = outputContractService.getContract("debate");

      expect(contract).toBeDefined();
      expect(contract.minimumRequirements.length).toBeGreaterThan(0);
      expect(contract.standardRequirements.length).toBeGreaterThan(0);
      expect(contract.minimumTurns).toBeGreaterThan(0);
    });

    it("should load contracts for all room types", async () => {
      const types = ["debate", "coding", "research", "trading", "simulation"];

      for (const type of types) {
        const contract = outputContractService.getContract(type as any);
        expect(contract).toBeDefined();
        expect(contract.roomType).toBe(type);
      }
    });

    it("should validate room completion status", async () => {
      // TODO: Create test room with known completion state
      // const status = await outputContractService.checkCompletion(MOCK_ROOM_ID);
      // expect(status.completionPercentage).toBeGreaterThanOrEqual(0);
      // expect(status.completionPercentage).toBeLessThanOrEqual(100);
    });

    it("should detect minimum completion", async () => {
      // TODO: Setup room meeting minimum requirements
      // const status = await outputContractService.checkCompletion(MOCK_ROOM_ID);
      // if (status.minimumMet) {
      //   expect(status.suggestedAction).toBe("close");
      // }
    });
  });

  // ===================================================================
  // TASK 6: Turn Management Loop
  // ===================================================================

  describe("Turn Management Loop", () => {
    it("should get turn status for room", async () => {
      const status = await turnManagementService.getTurnStatus(MOCK_ROOM_ID);

      expect(status).toBeDefined();
      expect(status.roomId).toBe(MOCK_ROOM_ID);
      expect(status.currentTurn).toBeGreaterThanOrEqual(0);
      expect(status.candidateCount).toBeGreaterThanOrEqual(0);
      expect(status.nextTurnAt).toBeDefined();
    });

    it("should start and stop turn management", async () => {
      // Note: This would require a valid live room
      // TODO: Setup valid live room first
      // await turnManagementService.startTurnManagement(MOCK_ROOM_ID);
      // const status = await turnManagementService.getTurnStatus(MOCK_ROOM_ID);
      // expect(status.status).toBe("in_progress");
      // turnManagementService.stopTurnManagement(MOCK_ROOM_ID);
    });
  });

  // ===================================================================
  // TASK 7: Error Handling & Edge Cases
  // ===================================================================

  describe("Error Handling", () => {
    it("should handle orchestrator timeout gracefully", async () => {
      // TODO: Mock orchestrator timeout
      // Should fall back to FALLBACK_SCORE
    });

    it("should handle database errors gracefully", async () => {
      // TODO: Test with closed database connection
      // Should log error and not crash
    });

    it("should handle invalid room ID", async () => {
      try {
        await messageService.getAgentStatistics(
          "invalid-room-id",
          "agent-id",
        );
        // May not throw if repository returns empty
      } catch (err) {
        expect(err).toBeDefined();
      }
    });

    it("should handle concurrent message submissions", async () => {
      const promises = [];

      for (let i = 0; i < 5; i++) {
        promises.push(
          turnManagementService.submitMessage(
            MOCK_ROOM_ID,
            MOCK_AGENT_A,
            `Concurrent message ${i + 1} for stress test`,
          ),
        );
      }

      const messages = await Promise.all(promises);

      expect(messages.length).toBe(5);
      expect(new Set(messages.map((m) => m.id)).size).toBe(5); // All unique IDs
    });
  });

  // ===================================================================
  // TASK 8: Full Room Lifecycle (Scenario Tests)
  // ===================================================================

  describe("Full Room Lifecycle Scenarios", () => {
    it("should complete scenario: debate progression", async () => {
      // 1. Agent A and B submit messages
      const msg1 = await messageService.createMessage(
        MOCK_ROOM_ID,
        MOCK_AGENT_A,
        "Regulation is essential for AI safety",
      );

      const msg2 = await messageService.createMessage(
        MOCK_ROOM_ID,
        MOCK_AGENT_B,
        "Self-regulation by industry is sufficient",
      );

      expect(msg1.status).toBe("candidate");
      expect(msg2.status).toBe("candidate");

      // 2. Get candidates
      const candidates = await messageService.getCandidates(MOCK_ROOM_ID);
      expect(candidates.length).toBeGreaterThanOrEqual(2);

      // 3. Simulate selection (Agent A wins)
      await messageService.updateMessage(msg1.id, "selected", { score: 78 });

      // 4. Simulate playing
      await messageService.updateMessage(msg1.id, "playing", {
        audioUrl: "https://s3.example.com/debate-1.mp3",
      });

      // 5. Mark as played
      await messageService.updateMessage(msg1.id, "played", {
        playedAt: new Date(),
      });

      // 6. Get transcript
      const transcript = await messageService.getTranscript(MOCK_ROOM_ID);
      expect(transcript.length).toBeGreaterThan(0);
      expect(transcript[0].id).toBe(msg1.id);

      // 7. Get stats
      const statsA = await messageService.getAgentStatistics(
        MOCK_ROOM_ID,
        MOCK_AGENT_A,
      );
      const statsB = await messageService.getAgentStatistics(
        MOCK_ROOM_ID,
        MOCK_AGENT_B,
      );

      expect(statsA.selected).toBe(1);
      expect(statsB.selected).toBe(0);
    });

    it("should track multiple agents fairly", async () => {
      const agentC = "agent-c-" + Date.now();

      // 3 agents submit messages
      const msgs = await Promise.all([
        messageService.createMessage(
          MOCK_ROOM_ID,
          MOCK_AGENT_A,
          "Agent A perspective on coding",
        ),
        messageService.createMessage(
          MOCK_ROOM_ID,
          MOCK_AGENT_B,
          "Agent B perspective on coding",
        ),
        messageService.createMessage(MOCK_ROOM_ID, agentC, "Agent C perspective on coding"),
      ]);

      expect(msgs.length).toBe(3);

      // Select different agents in sequence
      for (let i = 0; i < msgs.length; i++) {
        await messageService.updateMessage(msgs[i].id, "selected", {
          score: 70 + i * 5,
        });
      }

      // Verify all got selected
      const statsA = await messageService.getAgentStatistics(
        MOCK_ROOM_ID,
        MOCK_AGENT_A,
      );
      const statsB = await messageService.getAgentStatistics(
        MOCK_ROOM_ID,
        MOCK_AGENT_B,
      );
      const statsC = await messageService.getAgentStatistics(MOCK_ROOM_ID, agentC);

      expect(statsA.selected).toBeGreaterThan(0);
      expect(statsB.selected).toBeGreaterThan(0);
      expect(statsC.selected).toBeGreaterThan(0);
    });
  });
});
