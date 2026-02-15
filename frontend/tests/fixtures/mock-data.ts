/**
 * Mock Data Fixtures
 *
 * Reusable test data for all test suites
 */

import {
  Agent,
  Podcast,
  Episode,
  Room,
  Message,
  ScoringResult,
  Payment,
  TrendingPodcast,
} from '../../src/types';

/**
 * Mock Agents
 */
export const mockAgents = {
  alice: {
    id: 'agent-alice',
    username: 'alice',
    email: 'alice@example.com',
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-02-01'),
  } as Agent,

  bob: {
    id: 'agent-bob',
    username: 'bob',
    email: 'bob@example.com',
    createdAt: new Date('2025-01-05'),
    updatedAt: new Date('2025-02-05'),
  } as Agent,
};

/**
 * Mock Podcasts
 */
export const mockPodcasts = {
  techTalk: {
    id: 'pod-tech-1',
    title: 'Tech Talk Daily',
    description: 'Daily discussions about technology trends',
    category: 'tech' as const,
    hostAgentId: 'agent-alice',
    episodeCount: 42,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-02-10'),
  } as Podcast,

  financeEdge: {
    id: 'pod-fin-1',
    title: 'Finance Edge',
    description: 'Investment and financial market analysis',
    category: 'finance' as const,
    hostAgentId: 'agent-bob',
    episodeCount: 28,
    createdAt: new Date('2025-01-10'),
    updatedAt: new Date('2025-02-08'),
  } as Podcast,
};

/**
 * Mock Episodes
 */
export const mockEpisodes = {
  episode1: {
    id: 'ep-1',
    podcastId: 'pod-tech-1',
    title: 'AI Agents vs LLMs: The Future',
    status: 'ready' as const,
    audioUrl: 'https://cdn.example.com/ep1.mp3',
    transcript: 'This episode discusses the differences between AI agents and large language models...',
    duration: 2400,
    listenCount: 1250,
    createdAt: new Date('2025-02-10'),
    updatedAt: new Date('2025-02-10'),
  } as Episode,

  episode2: {
    id: 'ep-2',
    podcastId: 'pod-tech-1',
    title: 'Latest React Updates',
    status: 'generating' as const,
    listenCount: 0,
    createdAt: new Date('2025-02-11'),
    updatedAt: new Date('2025-02-11'),
  } as Episode,

  episode3: {
    id: 'ep-3',
    podcastId: 'pod-fin-1',
    title: 'Market Volatility Analysis',
    status: 'ready' as const,
    audioUrl: 'https://cdn.example.com/ep3.mp3',
    transcript: 'Analysis of recent market volatility...',
    duration: 1800,
    listenCount: 850,
    createdAt: new Date('2025-02-09'),
    updatedAt: new Date('2025-02-09'),
  } as Episode,
};

/**
 * Mock Rooms
 */
export const mockRooms = {
  debateActive: {
    id: 'room-debate-1',
    type: 'debate' as const,
    objective: 'AI Ethics: Should AGI development be regulated?',
    hostAgentId: 'agent-alice',
    status: 'active' as const,
    participantCount: 7,
    listenerCount: 340,
    duration: 1800,
    createdAt: new Date('2025-02-11T10:00:00Z'),
    updatedAt: new Date('2025-02-11T10:30:00Z'),
  } as Room,

  codingActive: {
    id: 'room-coding-1',
    type: 'coding' as const,
    objective: 'Building a scalable API with TypeScript',
    hostAgentId: 'agent-bob',
    status: 'active' as const,
    participantCount: 4,
    listenerCount: 95,
    duration: 900,
    createdAt: new Date('2025-02-11T11:00:00Z'),
    updatedAt: new Date('2025-02-11T11:15:00Z'),
  } as Room,

  roomPending: {
    id: 'room-pending-1',
    type: 'research' as const,
    objective: 'Climate change impact on tech infrastructure',
    hostAgentId: 'agent-alice',
    status: 'pending' as const,
    participantCount: 1,
    listenerCount: 0,
    duration: 0,
    createdAt: new Date('2025-02-11T12:00:00Z'),
    updatedAt: new Date('2025-02-11T12:00:00Z'),
  } as Room,
};

/**
 * Mock Messages
 */
export const mockMessages = {
  message1: {
    id: 'msg-1',
    roomId: 'room-debate-1',
    agentId: 'agent-alice',
    text: 'I believe AGI development should have strong safety guardrails.',
    score: 87,
    selected: true,
    createdAt: new Date('2025-02-11T10:05:00Z'),
  } as Message,

  message2: {
    id: 'msg-2',
    roomId: 'room-debate-1',
    agentId: 'agent-bob',
    text: 'But over-regulation might stifle innovation in the field.',
    score: 72,
    selected: false,
    createdAt: new Date('2025-02-11T10:10:00Z'),
  } as Message,

  message3: {
    id: 'msg-3',
    roomId: 'room-debate-1',
    agentId: 'agent-alice',
    text: 'A balanced approach is needed, combining innovation with safety.',
    score: 94,
    selected: true,
    createdAt: new Date('2025-02-11T10:15:00Z'),
  } as Message,
};

/**
 * Mock Scoring Results
 */
export const mockScoringResults = {
  score1: {
    messageId: 'msg-1',
    score: 87,
    relevance: 95,
    novelty: 80,
    coherence: 85,
    actionability: 75,
    engagement: 90,
    reasoning: 'Strong relevance to topic with good engagement potential',
  } as ScoringResult,

  score2: {
    messageId: 'msg-2',
    score: 72,
    relevance: 75,
    novelty: 85,
    coherence: 70,
    actionability: 65,
    engagement: 72,
    reasoning: 'Novel perspective but less coherent with discussion flow',
  } as ScoringResult,
};

/**
 * Mock Payments
 */
export const mockPayments = {
  spawnFee: {
    id: 'pay-1',
    agentId: 'agent-alice',
    amount: 10000, // 100 USDC in cents
    type: 'spawn_fee' as const,
    status: 'completed' as const,
    reference: 'x402-txn-12345',
    createdAt: new Date('2025-02-11T09:00:00Z'),
    updatedAt: new Date('2025-02-11T09:00:00Z'),
  } as Payment,

  generationCost: {
    id: 'pay-2',
    agentId: 'agent-bob',
    amount: 5000, // 50 USDC in cents
    type: 'generation_cost' as const,
    status: 'completed' as const,
    reference: 'x402-txn-12346',
    createdAt: new Date('2025-02-11T09:30:00Z'),
    updatedAt: new Date('2025-02-11T09:30:00Z'),
  } as Payment,
};

/**
 * Mock Trending Podcasts
 */
export const mockTrendingPodcasts = {
  trending1: {
    ...mockPodcasts.techTalk,
    listenCount: 45000,
    trend: 'rising' as const,
  } as TrendingPodcast,

  trending2: {
    ...mockPodcasts.financeEdge,
    listenCount: 32000,
    trend: 'stable' as const,
  } as TrendingPodcast,
};

/**
 * Factory functions for creating test data
 */
export const factories = {
  podcast: (overrides?: Partial<Podcast>): Podcast => ({
    ...mockPodcasts.techTalk,
    ...overrides,
  }),

  episode: (overrides?: Partial<Episode>): Episode => ({
    ...mockEpisodes.episode1,
    ...overrides,
  }),

  room: (overrides?: Partial<Room>): Room => ({
    ...mockRooms.debateActive,
    ...overrides,
  }),

  message: (overrides?: Partial<Message>): Message => ({
    ...mockMessages.message1,
    ...overrides,
  }),
};
