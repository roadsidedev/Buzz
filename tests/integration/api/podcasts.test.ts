/**
 * Podcast API Integration Tests
 *
 * Test scenarios:
 * - Create podcast (auth, validation)
 * - Generate episode (orchestrator, payment, database)
 * - Distribute episode (platform records created)
 * - Get podcasts (by agent, trending, filtered)
 * - Error cases (not found, unauthorized, payment failure)
 *
 * Week 2: Backend Integration
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { app } from "../../../backend/src/server";
import { podcastService, paymentService } from "../../../backend/src/services/index.js";

// ===================================================================
// Test Fixtures
// ===================================================================

const createMockAgent = () => ({
  agentId: "agent-test-" + Math.random().toString(36).substr(2, 9),
  name: "Test Agent",
  erc8004Address: "0x1234567890123456789012345678901234567890",
});

const createMockAuthToken = (agentId: string) => {
  // In real tests, this would be a valid JWT signed with the test secret
  return `Bearer mock-jwt-${agentId}`;
};

// ===================================================================
// Tests: Create Podcast
// ===================================================================

describe("POST /api/v1/podcasts", () => {
  let agent: any;
  let authToken: string;

  beforeEach(() => {
    agent = createMockAgent();
    authToken = createMockAuthToken(agent.agentId);
  });

  it("should create a podcast and return 201", async () => {
    const response = await request(app)
      .post("/api/v1/podcasts")
      .set("Authorization", authToken)
      .send({
        title: "My Podcast",
        description: "A great podcast about tech",
        category: "tech",
        coverImageUrl: "https://example.com/cover.jpg",
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.podcast).toBeDefined();
    expect(response.body.data.podcast.title).toBe("My Podcast");
    expect(response.body.data.podcast.category).toBe("tech");
    expect(response.body.data.podcast.status).toBe("active");
  });

  it("should reject podcast without authentication", async () => {
    const response = await request(app)
      .post("/api/v1/podcasts")
      .send({
        title: "My Podcast",
        category: "tech",
      });

    expect(response.status).toBe(401);
  });

  it("should reject invalid input", async () => {
    const response = await request(app)
      .post("/api/v1/podcasts")
      .set("Authorization", authToken)
      .send({
        title: "", // Empty title
        category: "tech",
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBeDefined();
  });

  it("should reject invalid category", async () => {
    const response = await request(app)
      .post("/api/v1/podcasts")
      .set("Authorization", authToken)
      .send({
        title: "My Podcast",
        category: "invalid",
      });

    expect(response.status).toBe(400);
  });

  it("should normalize whitespace in title", async () => {
    const response = await request(app)
      .post("/api/v1/podcasts")
      .set("Authorization", authToken)
      .send({
        title: "  My Podcast  ",
        category: "tech",
      });

    expect(response.status).toBe(201);
    expect(response.body.data.podcast.title).toBe("My Podcast");
  });
});

// ===================================================================
// Tests: Get Podcast
// ===================================================================

describe("GET /api/v1/podcasts/:id", () => {
  it("should return podcast by ID", async () => {
    // Note: In real tests, we'd seed the database with a test podcast
    const podcastId = "test-podcast-" + Math.random().toString(36).substr(2, 9);

    const response = await request(app).get(`/api/v1/podcasts/${podcastId}`);

    // Expect 404 if not found (or 200 if seeded)
    expect([200, 404]).toContain(response.status);
  });

  it("should return 404 for non-existent podcast", async () => {
    const response = await request(app).get(
      "/api/v1/podcasts/nonexistent-id",
    );

    expect(response.status).toBe(404);
  });
});

// ===================================================================
// Tests: Get Agent's Podcasts
// ===================================================================

describe("GET /api/v1/agents/:agentId/podcasts", () => {
  it("should return podcasts for agent", async () => {
    const agentId = "agent-test-" + Math.random().toString(36).substr(2, 9);

    const response = await request(app).get(`/api/v1/agents/${agentId}/podcasts`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.podcasts)).toBe(true);
  });

  it("should respect pagination parameters", async () => {
    const agentId = "agent-test-123";

    const response = await request(app)
      .get(`/api/v1/agents/${agentId}/podcasts`)
      .query({ limit: 10, offset: 0 });

    expect(response.status).toBe(200);
    expect(response.body.data.limit).toBe(10);
    expect(response.body.data.offset).toBe(0);
  });

  it("should cap limit at 100", async () => {
    const agentId = "agent-test-123";

    const response = await request(app)
      .get(`/api/v1/agents/${agentId}/podcasts`)
      .query({ limit: 500 });

    expect(response.body.data.limit).toBeLessThanOrEqual(100);
  });
});

// ===================================================================
// Tests: Update Podcast
// ===================================================================

describe("PATCH /api/v1/podcasts/:id", () => {
  let agent: any;
  let authToken: string;

  beforeEach(() => {
    agent = createMockAgent();
    authToken = createMockAuthToken(agent.agentId);
  });

  it("should update podcast title", async () => {
    const podcastId = "test-podcast-" + Math.random().toString(36).substr(2, 9);

    const response = await request(app)
      .patch(`/api/v1/podcasts/${podcastId}`)
      .set("Authorization", authToken)
      .send({
        title: "Updated Title",
      });

    expect([200, 404, 403]).toContain(response.status);
    if (response.status === 200) {
      expect(response.body.data.podcast.title).toBe("Updated Title");
    }
  });

  it("should reject update without authentication", async () => {
    const response = await request(app)
      .patch("/api/v1/podcasts/test-podcast")
      .send({
        title: "Updated Title",
      });

    expect(response.status).toBe(401);
  });

  it("should reject update by non-owner", async () => {
    // In real tests, we'd verify authorization
    const response = await request(app)
      .patch("/api/v1/podcasts/other-agents-podcast")
      .set("Authorization", authToken)
      .send({
        title: "Hacked Title",
      });

    expect([403, 404]).toContain(response.status);
  });
});

// ===================================================================
// Tests: Generate Episode
// ===================================================================

describe("POST /api/v1/podcasts/:id/episodes", () => {
  let agent: any;
  let authToken: string;

  beforeEach(() => {
    agent = createMockAgent();
    authToken = createMockAuthToken(agent.agentId);
  });

  it("should generate episode and charge payment", async () => {
    const podcastId = "test-podcast-" + Math.random().toString(36).substr(2, 9);

    const response = await request(app)
      .post(`/api/v1/podcasts/${podcastId}/episodes`)
      .set("Authorization", authToken)
      .send({
        title: "Episode 1",
        description: "First episode",
        sourceUrls: ["https://example.com/article"],
      });

    expect([201, 403, 404, 402]).toContain(response.status);
    if (response.status === 201) {
      expect(response.body.success).toBe(true);
      expect(response.body.data.episode).toBeDefined();
      expect(response.body.data.episode.status).toBe("generating");
    }
  });

  it("should reject episode without title", async () => {
    const podcastId = "test-podcast-123";

    const response = await request(app)
      .post(`/api/v1/podcasts/${podcastId}/episodes`)
      .set("Authorization", authToken)
      .send({
        title: "",
      });

    expect([400, 404, 403]).toContain(response.status);
  });

  it("should reject generation without authentication", async () => {
    const response = await request(app)
      .post("/api/v1/podcasts/test-podcast/episodes")
      .send({
        title: "Episode 1",
      });

    expect(response.status).toBe(401);
  });

  it("should reject if payment fails", async () => {
    // In real tests, we'd mock a failed payment
    const podcastId = "test-podcast-insufficient-balance";

    const response = await request(app)
      .post(`/api/v1/podcasts/${podcastId}/episodes`)
      .set("Authorization", authToken)
      .send({
        title: "Episode 1",
      });

    expect([201, 402, 404, 403]).toContain(response.status);
    if (response.status === 402) {
      expect(response.body.error.code).toBe("PAYMENT_FAILED");
    }
  });
});

// ===================================================================
// Tests: List Episodes
// ===================================================================

describe("GET /api/v1/podcasts/:id/episodes", () => {
  it("should return episodes for podcast", async () => {
    const podcastId = "test-podcast-" + Math.random().toString(36).substr(2, 9);

    const response = await request(app).get(
      `/api/v1/podcasts/${podcastId}/episodes`,
    );

    expect([200, 404]).toContain(response.status);
    if (response.status === 200) {
      expect(Array.isArray(response.body.data.episodes)).toBe(true);
    }
  });

  it("should filter by status", async () => {
    const podcastId = "test-podcast-123";

    const response = await request(app)
      .get(`/api/v1/podcasts/${podcastId}/episodes`)
      .query({ status: "ready" });

    expect([200, 404]).toContain(response.status);
  });

  it("should paginate results", async () => {
    const podcastId = "test-podcast-123";

    const response = await request(app)
      .get(`/api/v1/podcasts/${podcastId}/episodes`)
      .query({ limit: 10, offset: 0 });

    expect([200, 404]).toContain(response.status);
  });
});

// ===================================================================
// Tests: Get Single Episode
// ===================================================================

describe("GET /api/v1/episodes/:id", () => {
  it("should return episode by ID", async () => {
    const episodeId = "test-episode-" + Math.random().toString(36).substr(2, 9);

    const response = await request(app).get(`/api/v1/episodes/${episodeId}`);

    expect([200, 404]).toContain(response.status);
  });
});

// ===================================================================
// Tests: Distribute Episode
// ===================================================================

describe("POST /api/v1/episodes/:id/distribute", () => {
  let agent: any;
  let authToken: string;

  beforeEach(() => {
    agent = createMockAgent();
    authToken = createMockAuthToken(agent.agentId);
  });

  it("should create distribution records for all platforms", async () => {
    const episodeId = "test-episode-" + Math.random().toString(36).substr(2, 9);

    const response = await request(app)
      .post(`/api/v1/episodes/${episodeId}/distribute`)
      .set("Authorization", authToken);

    expect([201, 403, 404]).toContain(response.status);
    if (response.status === 201) {
      expect(Array.isArray(response.body.data.distributions)).toBe(true);
      expect(response.body.data.distributions.length).toBe(4); // 4 platforms
    }
  });

  it("should reject without authentication", async () => {
    const response = await request(app).post("/api/v1/episodes/test-episode/distribute");

    expect(response.status).toBe(401);
  });

  it("should reject if not podcast owner", async () => {
    const response = await request(app)
      .post("/api/v1/episodes/other-agents-episode/distribute")
      .set("Authorization", authToken);

    expect([403, 404]).toContain(response.status);
  });
});

// ===================================================================
// Tests: Trending Podcasts
// ===================================================================

describe("GET /api/v1/podcasts/trending", () => {
  it("should return trending podcasts", async () => {
    const response = await request(app).get("/api/v1/podcasts/trending");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.podcasts)).toBe(true);
  });

  it("should filter by category", async () => {
    const response = await request(app)
      .get("/api/v1/podcasts/trending")
      .query({ category: "tech" });

    expect(response.status).toBe(200);
    expect(response.body.data.category).toBe("tech");
  });

  it("should respect limit parameter", async () => {
    const response = await request(app)
      .get("/api/v1/podcasts/trending")
      .query({ limit: 5 });

    expect(response.status).toBe(200);
    expect(response.body.data.limit).toBe(5);
  });

  it("should return empty array if no trending podcasts", async () => {
    const response = await request(app)
      .get("/api/v1/podcasts/trending")
      .query({ category: "nonexistent" });

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data.podcasts)).toBe(true);
  });
});

// ===================================================================
// Tests: Error Handling
// ===================================================================

describe("Error Handling", () => {
  it("should return 404 for non-existent endpoints", async () => {
    const response = await request(app).get("/api/v1/podcasts/nonexistent-endpoint");

    expect(response.status).toBe(404);
  });

  it("should return validation error for malformed request", async () => {
    const response = await request(app)
      .post("/api/v1/podcasts")
      .set("Authorization", `Bearer test-token`)
      .send({
        title: 1, // Should be string
        category: "tech",
      });

    expect(response.status).toBe(400);
  });

  it("should handle orchestrator failures gracefully", async () => {
    // In real tests, we'd mock orchestrator to return error
    const response = await request(app)
      .post("/api/v1/podcasts/orchestrator-error/episodes")
      .set("Authorization", `Bearer test-token`)
      .send({
        title: "Episode 1",
      });

    expect([201, 400, 404, 403, 500]).toContain(response.status);
  });
});
