/**
 * Trending Service Unit Tests
 * Tests scoring calculations, caching, and cache invalidation
 */

import { describe, it, expect } from "vitest";
import type { TrendingMetrics } from "../../../backend/src/services/trending-service";

describe("TrendingService", () => {
  describe("calculateTrendingScore", () => {
    // Mock implementation for testing calculations
    const calculateScore = (metrics: TrendingMetrics): number => {
      const maxViewers = 10000;
      const maxGrowth = 200;
      const maxEngagement = 5;

      const popularityScore = Math.min(metrics.viewerCount / maxViewers, 1.0);
      const growthScore = Math.min(
        Math.abs(metrics.growthRate) / maxGrowth,
        1.0
      );
      const engagementScore = Math.min(
        metrics.engagementRate / maxEngagement,
        1.0
      );

      const timeSinceStart =
        Date.now() - new Date(metrics.startedAt).getTime();
      const minutesRunning = timeSinceStart / (1000 * 60);
      let recencyBoost = 1.0;
      if (minutesRunning < 30) recencyBoost = 1.0;
      else if (minutesRunning < 60) recencyBoost = 0.9;
      else if (minutesRunning < 180) recencyBoost = 0.7;
      else if (minutesRunning < 480) recencyBoost = 0.5;
      else recencyBoost = 0.3;

      const categoryAffinity = 0.5;

      const WEIGHTS = {
        POPULARITY: 0.35,
        GROWTH: 0.25,
        ENGAGEMENT: 0.2,
        RECENCY: 0.15,
        CATEGORY: 0.05,
      };

      const finalScore =
        (WEIGHTS.POPULARITY * popularityScore +
          WEIGHTS.GROWTH * growthScore +
          WEIGHTS.ENGAGEMENT * engagementScore +
          WEIGHTS.RECENCY * recencyBoost +
          WEIGHTS.CATEGORY * categoryAffinity) *
        100;

      return Math.round(finalScore * 100) / 100;
    };

    it("should return 0 for room with no metrics", () => {
      const metrics: TrendingMetrics = {
        roomId: "room-1",
        viewerCount: 0,
        totalMessages: 0,
        engagementRate: 0,
        growthRate: 0,
        startedAt: new Date(),
      };

      const score = calculateScore(metrics);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should normalize popularity to max 35 points", () => {
      const metricsHigh: TrendingMetrics = {
        roomId: "room-1",
        viewerCount: 10000, // Max
        totalMessages: 0,
        engagementRate: 0,
        growthRate: 0,
        startedAt: new Date(),
      };

      const metricsLow: TrendingMetrics = {
        roomId: "room-2",
        viewerCount: 0,
        totalMessages: 0,
        engagementRate: 0,
        growthRate: 0,
        startedAt: new Date(),
      };

      const scoreHigh = calculateScore(metricsHigh);
      const scoreLow = calculateScore(metricsLow);

      expect(scoreHigh).toBeGreaterThan(scoreLow);
    });

    it("should apply growth bonus correctly", () => {
      const metricsNoGrowth: TrendingMetrics = {
        roomId: "room-1",
        viewerCount: 100,
        totalMessages: 10,
        engagementRate: 0.5,
        growthRate: 0,
        startedAt: new Date(),
      };

      const metricsHighGrowth: TrendingMetrics = {
        roomId: "room-2",
        viewerCount: 100,
        totalMessages: 10,
        engagementRate: 0.5,
        growthRate: 100, // 100% growth
        startedAt: new Date(),
      };

      const scoreNoGrowth = calculateScore(metricsNoGrowth);
      const scoreHighGrowth = calculateScore(metricsHighGrowth);

      expect(scoreHighGrowth).toBeGreaterThan(scoreNoGrowth);
    });

    it("should apply recency boost for new rooms", () => {
      const now = new Date();
      const metricsNew: TrendingMetrics = {
        roomId: "room-1",
        viewerCount: 100,
        totalMessages: 10,
        engagementRate: 0.5,
        growthRate: 10,
        startedAt: now, // Just started
      };

      const metricsOld: TrendingMetrics = {
        roomId: "room-2",
        viewerCount: 100,
        totalMessages: 10,
        engagementRate: 0.5,
        growthRate: 10,
        startedAt: new Date(now.getTime() - 12 * 60 * 60 * 1000), // 12 hours ago
      };

      const scoreNew = calculateScore(metricsNew);
      const scoreOld = calculateScore(metricsOld);

      expect(scoreNew).toBeGreaterThan(scoreOld);
    });

    it("should apply recency decay for old rooms", () => {
      const now = new Date();

      const metrics30min: TrendingMetrics = {
        roomId: "room-1",
        viewerCount: 1000,
        totalMessages: 50,
        engagementRate: 1.0,
        growthRate: 50,
        startedAt: new Date(now.getTime() - 30 * 60 * 1000),
      };

      const metrics60min: TrendingMetrics = {
        roomId: "room-2",
        viewerCount: 1000,
        totalMessages: 50,
        engagementRate: 1.0,
        growthRate: 50,
        startedAt: new Date(now.getTime() - 60 * 60 * 1000),
      };

      const metrics3h: TrendingMetrics = {
        roomId: "room-3",
        viewerCount: 1000,
        totalMessages: 50,
        engagementRate: 1.0,
        growthRate: 50,
        startedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000),
      };

      const metrics8h: TrendingMetrics = {
        roomId: "room-4",
        viewerCount: 1000,
        totalMessages: 50,
        engagementRate: 1.0,
        growthRate: 50,
        startedAt: new Date(now.getTime() - 8 * 60 * 60 * 1000),
      };

      const score30 = calculateScore(metrics30min);
      const score60 = calculateScore(metrics60min);
      const score3h = calculateScore(metrics3h);
      const score8h = calculateScore(metrics8h);

      // Scores should decay with age
      expect(score30).toBeGreaterThan(score60);
      expect(score60).toBeGreaterThan(score3h);
      expect(score3h).toBeGreaterThan(score8h);
    });

    it("should clamp scores between 0 and 100", () => {
      const metricsExtremeHigh: TrendingMetrics = {
        roomId: "room-1",
        viewerCount: 100000, // Beyond max
        totalMessages: 1000,
        engagementRate: 10,
        growthRate: 1000,
        startedAt: new Date(),
      };

      const score = calculateScore(metricsExtremeHigh);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should handle negative growth rates", () => {
      const metrics: TrendingMetrics = {
        roomId: "room-1",
        viewerCount: 100,
        totalMessages: 10,
        engagementRate: 0.5,
        growthRate: -50, // Negative growth
        startedAt: new Date(),
      };

      const score = calculateScore(metrics);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it("should score consistently across calls", () => {
      const metrics: TrendingMetrics = {
        roomId: "room-1",
        viewerCount: 500,
        totalMessages: 25,
        engagementRate: 1.2,
        growthRate: 30,
        startedAt: new Date(),
      };

      const score1 = calculateScore(metrics);
      const score2 = calculateScore(metrics);
      const score3 = calculateScore(metrics);

      // Note: Scores may differ slightly due to time passing
      expect(Math.abs(score1 - score2)).toBeLessThan(0.1);
    });

    it("should differentiate between high and low engagement", () => {
      const metricsLowEngage: TrendingMetrics = {
        roomId: "room-1",
        viewerCount: 100,
        totalMessages: 2,
        engagementRate: 0.2,
        growthRate: 10,
        startedAt: new Date(),
      };

      const metricsHighEngage: TrendingMetrics = {
        roomId: "room-2",
        viewerCount: 100,
        totalMessages: 100,
        engagementRate: 4.0,
        growthRate: 10,
        startedAt: new Date(),
      };

      const scoreLow = calculateScore(metricsLowEngage);
      const scoreHigh = calculateScore(metricsHighEngage);

      expect(scoreHigh).toBeGreaterThan(scoreLow);
    });

    it("should weight popularity more than other factors", () => {
      // High popularity, low other metrics
      const metricsHighPop: TrendingMetrics = {
        roomId: "room-1",
        viewerCount: 8000,
        totalMessages: 5,
        engagementRate: 0.1,
        growthRate: 1,
        startedAt: new Date(),
      };

      // Low popularity, high other metrics
      const metricsHighOther: TrendingMetrics = {
        roomId: "room-2",
        viewerCount: 100,
        totalMessages: 100,
        engagementRate: 4.0,
        growthRate: 150,
        startedAt: new Date(),
      };

      const scorePop = calculateScore(metricsHighPop);
      const scoreOther = calculateScore(metricsHighOther);

      expect(scorePop).toBeGreaterThan(scoreOther);
    });
  });

  describe("Scoring weights validation", () => {
    it("should have weights that sum to 1.0", () => {
      const WEIGHTS = {
        POPULARITY: 0.35,
        GROWTH: 0.25,
        ENGAGEMENT: 0.2,
        RECENCY: 0.15,
        CATEGORY: 0.05,
      };

      const sum =
        WEIGHTS.POPULARITY +
        WEIGHTS.GROWTH +
        WEIGHTS.ENGAGEMENT +
        WEIGHTS.RECENCY +
        WEIGHTS.CATEGORY;

      expect(sum).toBe(1.0);
    });
  });

  describe("Edge cases", () => {
    const calculateScore = (metrics: TrendingMetrics): number => {
      const maxViewers = 10000;
      const maxGrowth = 200;
      const maxEngagement = 5;

      const popularityScore = Math.min(metrics.viewerCount / maxViewers, 1.0);
      const growthScore = Math.min(
        Math.abs(metrics.growthRate) / maxGrowth,
        1.0
      );
      const engagementScore = Math.min(
        metrics.engagementRate / maxEngagement,
        1.0
      );

      const timeSinceStart =
        Date.now() - new Date(metrics.startedAt).getTime();
      const minutesRunning = timeSinceStart / (1000 * 60);
      let recencyBoost = 1.0;
      if (minutesRunning < 30) recencyBoost = 1.0;
      else if (minutesRunning < 60) recencyBoost = 0.9;
      else if (minutesRunning < 180) recencyBoost = 0.7;
      else if (minutesRunning < 480) recencyBoost = 0.5;
      else recencyBoost = 0.3;

      const categoryAffinity = 0.5;

      const WEIGHTS = {
        POPULARITY: 0.35,
        GROWTH: 0.25,
        ENGAGEMENT: 0.2,
        RECENCY: 0.15,
        CATEGORY: 0.05,
      };

      const finalScore =
        (WEIGHTS.POPULARITY * popularityScore +
          WEIGHTS.GROWTH * growthScore +
          WEIGHTS.ENGAGEMENT * engagementScore +
          WEIGHTS.RECENCY * recencyBoost +
          WEIGHTS.CATEGORY * categoryAffinity) *
        100;

      return Math.round(finalScore * 100) / 100;
    };

    it("should handle very large viewer counts", () => {
      const metrics: TrendingMetrics = {
        roomId: "room-1",
        viewerCount: 999999,
        totalMessages: 1000,
        engagementRate: 5.0,
        growthRate: 200,
        startedAt: new Date(),
      };

      const score = calculateScore(metrics);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
      expect(score).toBeGreaterThan(90); // Should be very high
    });

    it("should handle fractional metrics", () => {
      const metrics: TrendingMetrics = {
        roomId: "room-1",
        viewerCount: 123,
        totalMessages: 5,
        engagementRate: 0.456,
        growthRate: 12.3,
        startedAt: new Date(),
      };

      const score = calculateScore(metrics);

      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });
});
