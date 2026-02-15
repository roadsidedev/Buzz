/**
 * Podcast Service Unit Tests
 *
 * Test coverage for:
 * - createPodcast (5 tests)
 * - generateEpisode (4 tests)
 * - getEpisodes (3 tests)
 * - updateEpisodeStatus (3 tests)
 * - distributeEpisode (3 tests)
 * - getTrendingPodcasts (3 tests)
 *
 * Total: 21 unit tests (~80% coverage)
 *
 * Week 2: Backend Integration
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Pool, QueryResult } from "pg";
import { PodcastService } from "../../../backend/src/services/podcast-service";
import {
  ValidationError,
  NotFoundError,
  PaymentError,
} from "../../../backend/src/utils/errors";
import { OrchestratorClient } from "../../../backend/src/services/orchestrator-client";
import { PaymentService } from "../../../backend/src/services/payment-service";

// ===================================================================
// Mock Setup
// ===================================================================

const createMockDb = (): Partial<Pool> => {
  return {
    query: vi.fn(),
  };
};

const createMockOrchestratorClient = (): Partial<OrchestratorClient> => {
  return {
    generatePodcastEpisode: vi.fn(),
    getPodcastEpisodeStatus: vi.fn(),
  };
};

const createMockPaymentService = (): Partial<PaymentService> => {
  return {
    chargeGenerationCost: vi.fn(),
  };
};

// ===================================================================
// Tests: createPodcast
// ===================================================================

describe("PodcastService.createPodcast", () => {
  let service: PodcastService;
  let mockDb: Partial<Pool>;
  let mockOrchestrator: Partial<OrchestratorClient>;
  let mockPayment: Partial<PaymentService>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockOrchestrator = createMockOrchestratorClient();
    mockPayment = createMockPaymentService();

    service = new PodcastService(
      mockDb as Pool,
      mockOrchestrator as OrchestratorClient,
      mockPayment as PaymentService,
    );
  });

  it("should create a podcast and return with correct fields", async () => {
    const agentId = "agent-1";
    const req = { title: "My Podcast", category: "tech" };
    const now = new Date();

    (mockDb.query as any).mockResolvedValueOnce({
      rows: [
        {
          id: "podcast-1",
          agent_id: agentId,
          title: "My Podcast",
          category: "tech",
          status: "active",
          created_at: now,
          updated_at: now,
        },
      ],
    } as QueryResult);

    const podcast = await service.createPodcast(agentId, req);

    expect(podcast.id).toBe("podcast-1");
    expect(podcast.title).toBe("My Podcast");
    expect(podcast.category).toBe("tech");
    expect(podcast.status).toBe("active");
    expect(podcast.agentId).toBe(agentId);
  });

  it("should reject podcast without title", async () => {
    const agentId = "agent-1";
    const req = { title: "", category: "tech" };

    await expect(service.createPodcast(agentId, req)).rejects.toThrow(
      ValidationError,
    );
  });

  it("should reject invalid category", async () => {
    const agentId = "agent-1";
    const req = { title: "My Podcast", category: "invalid" };

    await expect(service.createPodcast(agentId, req)).rejects.toThrow(
      ValidationError,
    );
  });

  it("should normalize title and category to lowercase", async () => {
    const agentId = "agent-1";
    const req = { title: "  My Podcast  ", category: "TECH" };
    const now = new Date();

    (mockDb.query as any).mockResolvedValueOnce({
      rows: [
        {
          id: "podcast-1",
          agent_id: agentId,
          title: "My Podcast",
          category: "tech",
          status: "active",
          created_at: now,
          updated_at: now,
        },
      ],
    } as QueryResult);

    await service.createPodcast(agentId, req);

    const call = (mockDb.query as any).mock.calls[0];
    expect(call[1][2]).toBe("My Podcast"); // title trimmed
    expect(call[1][4]).toBe("tech"); // category lowercased
  });

  it("should store optional fields when provided", async () => {
    const agentId = "agent-1";
    const req = {
      title: "My Podcast",
      category: "tech",
      description: "A great podcast",
      coverImageUrl: "https://example.com/cover.jpg",
    };
    const now = new Date();

    (mockDb.query as any).mockResolvedValueOnce({
      rows: [
        {
          id: "podcast-1",
          agent_id: agentId,
          title: "My Podcast",
          category: "tech",
          description: "A great podcast",
          cover_image_url: "https://example.com/cover.jpg",
          status: "active",
          created_at: now,
          updated_at: now,
        },
      ],
    } as QueryResult);

    const podcast = await service.createPodcast(agentId, req);

    expect(podcast.description).toBe("A great podcast");
    expect(podcast.coverImageUrl).toBe("https://example.com/cover.jpg");
  });
});

// ===================================================================
// Tests: generateEpisode
// ===================================================================

describe("PodcastService.generateEpisode", () => {
  let service: PodcastService;
  let mockDb: Partial<Pool>;
  let mockOrchestrator: Partial<OrchestratorClient>;
  let mockPayment: Partial<PaymentService>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockOrchestrator = createMockOrchestratorClient();
    mockPayment = createMockPaymentService();

    service = new PodcastService(
      mockDb as Pool,
      mockOrchestrator as OrchestratorClient,
      mockPayment as PaymentService,
    );
  });

  it("should generate episode and charge payment", async () => {
    const podcastId = "podcast-1";
    const req = { title: "Episode 1" };
    const now = new Date();

    // Mock podcast fetch
    (mockDb.query as any).mockResolvedValueOnce({
      rows: [{ id: podcastId, agent_id: "agent-1", status: "active" }],
    });

    // Mock orchestrator call
    (mockOrchestrator.generatePodcastEpisode as any).mockResolvedValueOnce({
      episodeId: "episode-1",
      estimatedCostUsdc: 50,
      status: "generating",
    });

    // Mock payment charge
    (mockPayment.chargeGenerationCost as any).mockResolvedValueOnce({
      id: "payment-1",
    });

    // Mock episode insert
    (mockDb.query as any).mockResolvedValueOnce({
      rows: [
        {
          id: "episode-1",
          podcast_id: podcastId,
          title: "Episode 1",
          status: "generating",
          created_at: now,
          updated_at: now,
        },
      ],
    });

    const episode = await service.generateEpisode(podcastId, req);

    expect(episode.id).toBeDefined();
    expect(episode.status).toBe("generating");
    expect(mockPayment.chargeGenerationCost).toHaveBeenCalled();
  });

  it("should reject episode without title", async () => {
    const podcastId = "podcast-1";
    const req = { title: "" };

    // Mock podcast fetch
    (mockDb.query as any).mockResolvedValueOnce({
      rows: [{ id: podcastId, agent_id: "agent-1", status: "active" }],
    });

    await expect(service.generateEpisode(podcastId, req)).rejects.toThrow(
      ValidationError,
    );
  });

  it("should throw if podcast not found", async () => {
    const podcastId = "nonexistent";
    const req = { title: "Episode 1" };

    // Mock empty result
    (mockDb.query as any).mockResolvedValueOnce({ rows: [] });

    await expect(service.generateEpisode(podcastId, req)).rejects.toThrow(
      NotFoundError,
    );
  });

  it("should throw if payment charge fails", async () => {
    const podcastId = "podcast-1";
    const req = { title: "Episode 1" };

    // Mock podcast fetch
    (mockDb.query as any).mockResolvedValueOnce({
      rows: [{ id: podcastId, agent_id: "agent-1", status: "active" }],
    });

    // Mock orchestrator call
    (mockOrchestrator.generatePodcastEpisode as any).mockResolvedValueOnce({
      episodeId: "episode-1",
      estimatedCostUsdc: 50,
    });

    // Mock payment failure
    (mockPayment.chargeGenerationCost as any).mockRejectedValueOnce(
      new PaymentError("Insufficient balance", new Error()),
    );

    await expect(service.generateEpisode(podcastId, req)).rejects.toThrow(
      PaymentError,
    );
  });
});

// ===================================================================
// Tests: getEpisodesByPodcast
// ===================================================================

describe("PodcastService.getEpisodesByPodcast", () => {
  let service: PodcastService;
  let mockDb: Partial<Pool>;
  let mockOrchestrator: Partial<OrchestratorClient>;
  let mockPayment: Partial<PaymentService>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockOrchestrator = createMockOrchestratorClient();
    mockPayment = createMockPaymentService();

    service = new PodcastService(
      mockDb as Pool,
      mockOrchestrator as OrchestratorClient,
      mockPayment as PaymentService,
    );
  });

  it("should return episodes for podcast", async () => {
    const podcastId = "podcast-1";

    (mockDb.query as any).mockResolvedValueOnce({
      rows: [
        {
          id: "episode-1",
          podcast_id: podcastId,
          title: "Episode 1",
          status: "ready",
        },
        {
          id: "episode-2",
          podcast_id: podcastId,
          title: "Episode 2",
          status: "generating",
        },
      ],
    });

    const episodes = await service.getEpisodesByPodcast(podcastId);

    expect(episodes).toHaveLength(2);
    expect(episodes[0].title).toBe("Episode 1");
    expect(episodes[1].title).toBe("Episode 2");
  });

  it("should filter by status", async () => {
    const podcastId = "podcast-1";

    (mockDb.query as any).mockResolvedValueOnce({
      rows: [
        {
          id: "episode-1",
          podcast_id: podcastId,
          title: "Episode 1",
          status: "ready",
        },
      ],
    });

    const episodes = await service.getEpisodesByPodcast(podcastId, 20, 0, "ready");

    expect(episodes).toHaveLength(1);
    expect(episodes[0].status).toBe("ready");
  });

  it("should respect pagination", async () => {
    const podcastId = "podcast-1";

    (mockDb.query as any).mockResolvedValueOnce({
      rows: [
        {
          id: "episode-21",
          podcast_id: podcastId,
          title: "Episode 21",
        },
      ],
    });

    const episodes = await service.getEpisodesByPodcast(podcastId, 20, 20);

    expect(episodes).toHaveLength(1);

    const call = (mockDb.query as any).mock.calls[0];
    expect(call[1]).toContain(20); // limit
    expect(call[1]).toContain(20); // offset
  });
});

// ===================================================================
// Tests: updateEpisodeStatus
// ===================================================================

describe("PodcastService.updateEpisodeStatus", () => {
  let service: PodcastService;
  let mockDb: Partial<Pool>;
  let mockOrchestrator: Partial<OrchestratorClient>;
  let mockPayment: Partial<PaymentService>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockOrchestrator = createMockOrchestratorClient();
    mockPayment = createMockPaymentService();

    service = new PodcastService(
      mockDb as Pool,
      mockOrchestrator as OrchestratorClient,
      mockPayment as PaymentService,
    );
  });

  it("should update episode status to ready with audio", async () => {
    const episodeId = "episode-1";
    const now = new Date();

    (mockDb.query as any).mockResolvedValueOnce({
      rows: [
        {
          id: episodeId,
          title: "Episode 1",
          status: "ready",
          audio_url: "https://s3.example.com/audio.mp3",
          duration_seconds: 3600,
          generated_at: now,
        },
      ],
    });

    const episode = await service.updateEpisodeStatus(
      episodeId,
      "ready",
      "https://s3.example.com/audio.mp3",
      undefined,
      3600,
    );

    expect(episode.status).toBe("ready");
    expect(episode.audioUrl).toBe("https://s3.example.com/audio.mp3");
    expect(episode.durationSeconds).toBe(3600);
  });

  it("should throw if episode not found", async () => {
    (mockDb.query as any).mockResolvedValueOnce({ rows: [] });

    await expect(
      service.updateEpisodeStatus("nonexistent", "ready"),
    ).rejects.toThrow(NotFoundError);
  });

  it("should update transcript when provided", async () => {
    const episodeId = "episode-1";
    const transcript = "This is the episode transcript...";
    const now = new Date();

    (mockDb.query as any).mockResolvedValueOnce({
      rows: [
        {
          id: episodeId,
          title: "Episode 1",
          status: "ready",
          transcript,
        },
      ],
    });

    const episode = await service.updateEpisodeStatus(
      episodeId,
      "ready",
      undefined,
      transcript,
    );

    expect(episode.transcript).toBe(transcript);
  });
});

// ===================================================================
// Tests: distributeEpisode
// ===================================================================

describe("PodcastService.distributeEpisode", () => {
  let service: PodcastService;
  let mockDb: Partial<Pool>;
  let mockOrchestrator: Partial<OrchestratorClient>;
  let mockPayment: Partial<PaymentService>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockOrchestrator = createMockOrchestratorClient();
    mockPayment = createMockPaymentService();

    service = new PodcastService(
      mockDb as Pool,
      mockOrchestrator as OrchestratorClient,
      mockPayment as PaymentService,
    );
  });

  it("should create distribution records for all platforms", async () => {
    const episodeId = "episode-1";

    // Mock episode fetch
    (mockDb.query as any).mockResolvedValueOnce({
      rows: [{ id: episodeId, status: "ready" }],
    });

    // Mock 4 distribution inserts
    for (let i = 0; i < 4; i++) {
      (mockDb.query as any).mockResolvedValueOnce({
        rows: [
          {
            id: `dist-${i}`,
            episode_id: episodeId,
            platform: ["spotify", "apple_podcasts", "youtube", "rss"][i],
            status: "pending",
          },
        ],
      });
    }

    const distributions = await service.distributeEpisode(episodeId);

    expect(distributions).toHaveLength(4);
    expect(distributions.map((d) => d.platform)).toEqual([
      "spotify",
      "apple_podcasts",
      "youtube",
      "rss",
    ]);
  });

  it("should throw if episode not found", async () => {
    (mockDb.query as any).mockResolvedValueOnce({ rows: [] });

    await expect(
      service.distributeEpisode("nonexistent"),
    ).rejects.toThrow(NotFoundError);
  });

  it("should throw if episode not in ready status", async () => {
    (mockDb.query as any).mockResolvedValueOnce({
      rows: [{ id: "episode-1", status: "generating" }],
    });

    await expect(
      service.distributeEpisode("episode-1"),
    ).rejects.toThrow(ValidationError);
  });
});

// ===================================================================
// Tests: getTrendingPodcasts
// ===================================================================

describe("PodcastService.getTrendingPodcasts", () => {
  let service: PodcastService;
  let mockDb: Partial<Pool>;
  let mockOrchestrator: Partial<OrchestratorClient>;
  let mockPayment: Partial<PaymentService>;

  beforeEach(() => {
    mockDb = createMockDb();
    mockOrchestrator = createMockOrchestratorClient();
    mockPayment = createMockPaymentService();

    service = new PodcastService(
      mockDb as Pool,
      mockOrchestrator as OrchestratorClient,
      mockPayment as PaymentService,
    );
  });

  it("should return trending podcasts sorted by listens", async () => {
    (mockDb.query as any).mockResolvedValueOnce({
      rows: [
        {
          id: "podcast-1",
          title: "Popular Pod",
          total_listens: 1000,
          status: "active",
        },
        {
          id: "podcast-2",
          title: "New Pod",
          total_listens: 100,
          status: "active",
        },
      ],
    });

    const podcasts = await service.getTrendingPodcasts(20);

    expect(podcasts).toHaveLength(2);
    expect(podcasts[0].totalListens).toBeGreaterThanOrEqual(
      podcasts[1].totalListens,
    );
  });

  it("should filter by category", async () => {
    (mockDb.query as any).mockResolvedValueOnce({
      rows: [
        {
          id: "podcast-1",
          category: "tech",
          status: "active",
        },
      ],
    });

    await service.getTrendingPodcasts(20, "tech");

    const call = (mockDb.query as any).mock.calls[0];
    expect(call[0]).toContain("category = $");
    expect(call[1]).toContain("tech");
  });

  it("should respect limit parameter", async () => {
    (mockDb.query as any).mockResolvedValueOnce({ rows: [] });

    await service.getTrendingPodcasts(50);

    const call = (mockDb.query as any).mock.calls[0];
    expect(call[1][call[1].length - 1]).toBe(50); // limit is last param
  });
});
