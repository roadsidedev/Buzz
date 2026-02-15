# Week 2 Kickoff: Backend Integration

**Start Date:** February 20, 2026  
**Duration:** 1 week (Feb 20 - Feb 26)  
**Status:** 📋 READY TO EXECUTE

---

## Objectives

1. **API Routes:** Expose podcast service via REST endpoints
2. **Orchestrator Integration:** Connect to podcast generation RPC
3. **Payment Flow:** Verify x402 charging for episodes
4. **Unit Tests:** 80%+ coverage for podcast-service
5. **Integration Tests:** End-to-end API → Database flow

---

## Task Breakdown (5 Tasks, Est. 5 Days)

### Task 2.1: API Routes (Day 1-2)

**Goal:** Create REST endpoints for podcast CRUD + generation

**Files to Create:**
```
backend/src/api/routes/podcasts.ts
backend/src/api/routes/podcast-episodes.ts
```

**Endpoints:**
```typescript
// Podcast Management
POST   /api/v1/podcasts              // Create podcast
GET    /api/v1/podcasts/:id          // Fetch podcast
GET    /api/v1/agents/:agentId/podcasts // Agent's podcasts
PATCH  /api/v1/podcasts/:id          // Update podcast

// Episode Management
POST   /api/v1/podcasts/:id/episodes // Generate episode
GET    /api/v1/podcasts/:id/episodes // List episodes
GET    /api/v1/episodes/:id          // Single episode
POST   /api/v1/episodes/:id/distribute // Distribute episode

// Discovery
GET    /api/v1/podcasts/trending     // Trending (cached)
GET    /api/v1/podcasts?category=tech // Category filtered
```

**Route Handler Pattern:**
```typescript
// Example from existing code
import { Router, Request, Response } from 'express';
import { PodcastService } from '@/services/podcast-service';
import { auth } from '@/api/middleware/auth';
import { validate } from '@/api/middleware/validate';

const router = Router();
const podcastService = new PodcastService(db, orchestrator, payment);

// POST /api/v1/podcasts
router.post('/', auth, async (req: Request, res: Response) => {
  try {
    const podcast = await podcastService.createPodcast(
      req.user.agentId,
      req.body
    );
    res.status(201).json(podcast);
  } catch (err) {
    handleError(err, res);
  }
});

export default router;
```

**Checklist:**
- [ ] POST /podcasts — Create
- [ ] GET /podcasts/:id — Read
- [ ] GET /agents/:id/podcasts — List by agent
- [ ] POST /podcasts/:id/episodes — Generate
- [ ] GET /podcasts/:id/episodes — List episodes
- [ ] GET /trending — Discovery
- [ ] Auth middleware applied
- [ ] Error handlers added
- [ ] Logging added

---

### Task 2.2: Orchestrator Client (Day 1-2)

**Goal:** Create RPC methods to call Python orchestrator

**Files to Update:**
```
backend/src/services/orchestrator-client.ts (ADD methods)
```

**New Methods Needed:**
```typescript
async generatePodcastEpisode(request: {
  podcastId: string;
  episodeId: string;
  title: string;
  sourceUrls?: string[];
  voicePreferences?: {
    primaryVoiceId?: string;
    secondaryVoiceId?: string;
  };
}): Promise<{
  episodeId: string;
  status: 'generating';
  estimatedDurationSeconds: number;
  estimatedCostUsdc: number;
  estimatedTimeSeconds: number;
}>

async getPodcastEpisodeStatus(episodeId: string): Promise<{
  status: 'draft' | 'generating' | 'ready' | 'failed';
  audioUrl?: string;
  transcript?: string;
  durationSeconds?: number;
  errorMessage?: string;
}>
```

**Implementation Pattern:**
```typescript
async generatePodcastEpisode(request: PodcastGenerationRequest): Promise<any> {
  const url = `${this.orchestratorUrl}/api/v1/podcasts/generate-episode`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.orchestratorToken}`,
      },
      body: JSON.stringify(request),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Orchestrator error: ${error.message}`);
    }
    
    return response.json();
  } catch (err) {
    logger.error('Orchestrator RPC failed', { method: 'generatePodcastEpisode', error: err });
    throw err;
  }
}
```

**Checklist:**
- [ ] generatePodcastEpisode() method
- [ ] getPodcastEpisodeStatus() method
- [ ] Error handling + retries
- [ ] Request timeout (30s default)
- [ ] Logging + monitoring

---

### Task 2.3: Payment Service Extension (Day 2-3)

**Goal:** Support podcast generation costs via x402

**Files to Update:**
```
backend/src/services/payment-service.ts (ADD method)
```

**New Method:**
```typescript
async chargeGenerationCost(
  agentId: string,
  episodeId: string,
  costUsdc: number,
  description?: string,
): Promise<{ transactionId: string; status: 'pending' | 'success' }> {
  // 1. Validate agent has sufficient balance
  // 2. Create payment record (status: pending)
  // 3. Call x402 API to charge
  // 4. Update payment record (status: success/failed)
  // 5. Return transaction ID
}
```

**Integration with PodcastService:**
```typescript
// In generateEpisode():
const result = await this.orchestrator.generatePodcastEpisode({...});
await this.payment.chargeGenerationCost(
  podcast.agentId,
  episodeId,
  result.estimatedCostUsdc,
  `Episode generation: "${req.title}"`
);
```

**Checklist:**
- [ ] chargeGenerationCost() method
- [ ] Payment record created in DB
- [ ] x402 API integration
- [ ] Charge reversal on error
- [ ] Error handling (insufficient balance, API failure)

---

### Task 2.4: Unit Tests (Day 3-4)

**Goal:** 80%+ coverage for PodcastService

**Files to Create:**
```
tests/unit/services/podcast-service.test.ts (~400 lines)
```

**Test Scenarios:**
```typescript
describe('PodcastService', () => {
  describe('createPodcast', () => {
    it('should create a podcast and return with correct fields', async () => {
      // Arrange
      const agent = createMockAgent();
      const req = { title: 'My Podcast', category: 'tech' };

      // Act
      const podcast = await service.createPodcast(agent.id, req);

      // Assert
      expect(podcast.title).toBe('My Podcast');
      expect(podcast.category).toBe('tech');
      expect(podcast.status).toBe('active');
    });

    it('should reject podcast without title', async () => {
      const req = { title: '', category: 'tech' };
      await expect(() => service.createPodcast(agent.id, req))
        .rejects.toThrow(ValidationError);
    });

    it('should reject invalid category', async () => {
      const req = { title: 'My Podcast', category: 'invalid' };
      await expect(() => service.createPodcast(agent.id, req))
        .rejects.toThrow(ValidationError);
    });
  });

  describe('generateEpisode', () => {
    it('should trigger orchestrator and charge cost', async () => {
      // Arrange
      const podcast = createMockPodcast();
      const req = { title: 'Episode 1' };
      jest.spyOn(orchestrator, 'generatePodcastEpisode')
        .mockResolvedValue({ estimatedCostUsdc: 0.50 });
      jest.spyOn(payment, 'chargeGenerationCost')
        .mockResolvedValue({ transactionId: 'tx-1' });

      // Act
      const episode = await service.generateEpisode(podcast.id, req);

      // Assert
      expect(episode.status).toBe('generating');
      expect(orchestrator.generatePodcastEpisode).toHaveBeenCalled();
      expect(payment.chargeGenerationCost).toHaveBeenCalledWith(
        podcast.agentId,
        expect.any(String),
        0.50,
      );
    });

    it('should fail if payment fails', async () => {
      jest.spyOn(payment, 'chargeGenerationCost')
        .mockRejectedValue(new PaymentError('Insufficient balance', {}));

      await expect(() => service.generateEpisode(podcast.id, req))
        .rejects.toThrow(PaymentError);
    });
  });

  describe('getTrendingPodcasts', () => {
    it('should filter by category', async () => {
      const trending = await service.getTrendingPodcasts(20, 'tech');
      
      expect(trending.length).toBeLessThanOrEqual(20);
      expect(trending.every(p => p.category === 'tech')).toBe(true);
    });
  });
});
```

**Test Coverage Targets:**
- createPodcast: 5 tests
- generateEpisode: 4 tests
- getEpisodes: 3 tests
- updateEpisodeStatus: 3 tests
- distributeEpisode: 3 tests
- getTrendingPodcasts: 3 tests
- **Total: 21 tests**

**Checklist:**
- [ ] Mock setup (db, orchestrator, payment)
- [ ] Happy path tests (4+ per method)
- [ ] Error cases (validation, not found)
- [ ] Integration scenarios (charge on generate)
- [ ] Run jest: `npm test -- podcast-service`
- [ ] Coverage >= 80%

---

### Task 2.5: Integration Tests (Day 4-5)

**Goal:** Full API → Database flow

**Files to Create:**
```
tests/integration/api/podcasts.test.ts (~500 lines)
```

**Integration Test Scenarios:**
```typescript
describe('Podcasts API Integration', () => {
  describe('POST /api/v1/podcasts', () => {
    it('should create podcast and store in database', async () => {
      const auth = await loginAgent(mockAgent);
      
      const response = await request(app)
        .post('/api/v1/podcasts')
        .set('Authorization', `Bearer ${auth.token}`)
        .send({
          title: 'Test Podcast',
          description: 'A test',
          category: 'tech',
        });

      expect(response.status).toBe(201);
      expect(response.body.id).toBeDefined();
      
      // Verify in database
      const podcast = await db.query(
        'SELECT * FROM podcast WHERE id = $1',
        [response.body.id]
      );
      expect(podcast.rows).toHaveLength(1);
    });

    it('should reject without auth', async () => {
      const response = await request(app)
        .post('/api/v1/podcasts')
        .send({ title: 'Test', category: 'tech' });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid input', async () => {
      const auth = await loginAgent(mockAgent);
      
      const response = await request(app)
        .post('/api/v1/podcasts')
        .set('Authorization', `Bearer ${auth.token}`)
        .send({ title: '', category: 'tech' });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('TITLE_REQUIRED');
    });
  });

  describe('POST /api/v1/podcasts/:id/episodes (full flow)', () => {
    it('should generate episode, charge payment, and create record', async () => {
      // Setup
      const podcast = await createPodcast(mockAgent);
      const auth = await loginAgent(mockAgent);
      
      // Act
      const response = await request(app)
        .post(`/api/v1/podcasts/${podcast.id}/episodes`)
        .set('Authorization', `Bearer ${auth.token}`)
        .send({
          title: 'Episode 1',
          sourceUrls: ['https://example.com/article'],
        });

      // Assert
      expect(response.status).toBe(201);
      expect(response.body.status).toBe('generating');

      // Verify payment record
      const payment = await db.query(
        'SELECT * FROM payment WHERE podcast_episode_id = $1',
        [response.body.id]
      );
      expect(payment.rows).toHaveLength(1);
      expect(payment.rows[0].status).toBe('pending');
    });
  });

  describe('GET /api/v1/podcasts/trending', () => {
    it('should return trending podcasts sorted by listens', async () => {
      const response = await request(app)
        .get('/api/v1/podcasts/trending');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      
      // Verify sorted by listens
      for (let i = 0; i < response.body.length - 1; i++) {
        expect(response.body[i].totalListens)
          .toBeGreaterThanOrEqual(response.body[i + 1].totalListens);
      }
    });
  });
});
```

**Test Scenarios:**
- Create podcast (auth, validation)
- Generate episode (orchestrator, payment, database)
- Distribute episode (platform records created)
- Get podcasts (by agent, trending, filtered)
- Error cases (not found, unauthorized, payment failure)

**Checklist:**
- [ ] Test database setup/teardown
- [ ] Authentication mocking
- [ ] Payment service mocking (or testnet)
- [ ] Orchestrator mocking
- [ ] All endpoints tested (7+ endpoints)
- [ ] Error cases covered
- [ ] Run: `npm test -- integration`

---

## File Checklist (Week 2)

**To Create:**
- [ ] `backend/src/api/routes/podcasts.ts`
- [ ] `backend/src/api/routes/podcast-episodes.ts` (optional split)
- [ ] `tests/unit/services/podcast-service.test.ts`
- [ ] `tests/integration/api/podcasts.test.ts`

**To Update:**
- [ ] `backend/src/services/orchestrator-client.ts` (add RPC methods)
- [ ] `backend/src/services/payment-service.ts` (add chargeGenerationCost)
- [ ] `backend/src/server.ts` (register podcast routes)
- [ ] `API_REFERENCE.md` (document endpoints)

**Total Files:** 4 new, 4 updated

---

## Dependencies & Assumptions

**Assumes Week 1 Complete:**
- ✅ Database schema migrated (podcast tables exist)
- ✅ PodcastService functional
- ✅ Environment variables set

**Requires:**
- Orchestrator service running (mock OK for testing)
- PostgreSQL with migrations applied
- x402 API key (testnet)
- Jest + Supertest configured

**Setup Steps:**
```bash
# 1. Apply database migration
cd migrations
psql -U clawhouse -d clawhouse < 003_add_podcast_tables.sql

# 2. Install dependencies (if needed)
cd backend
npm install

# 3. Run existing tests to verify setup
npm test

# 4. Start orchestrator (in separate terminal)
cd orchestrator
uvicorn src.main:app --reload

# 5. Begin Week 2 tasks
```

---

## Success Criteria (Week 2 Complete)

**All Tasks Done:**
- [x] API routes created (7+ endpoints)
- [x] Orchestrator client methods added
- [x] Payment service extended
- [x] Unit tests written (80%+ coverage)
- [x] Integration tests written
- [x] All tests passing
- [x] Code review passed
- [x] Documentation updated

**Quality Gate:**
- ✅ 0 TypeScript errors (`npm run type-check`)
- ✅ 0 ESLint issues (`npm run lint`)
- ✅ 80%+ test coverage (`npm run test:coverage`)
- ✅ All endpoints documented (API_REFERENCE.md)

---

## Daily Standup Questions

Use this to track progress each session:

```markdown
### [DATE] - Week 2 Session

**What did you complete?**
- Task 2.X: [description]

**What are you working on next?**
- Task 2.X: [description]

**Any blockers?**
- [Issue]: [mitigation]

**Code changes:**
- [file]: [brief summary]

**Tests passing?**
- npm test: [# passing / # failing]

**Any questions for next session?**
```

---

## Reference: Routes Implementation Example

(From existing ClawHouse code for pattern reference)

```typescript
// backend/src/api/routes/rooms.ts (existing pattern)
import { Router } from 'express';
import { RoomService } from '@/services/room-service';
import { auth } from '@/middleware/auth';
import { validate } from '@/middleware/validate';
import logger from '@/utils/logger';
import { handleError } from '@/utils/error-handler';

const router = Router();
const roomService = new RoomService(db, orchestrator, payment);

// POST /api/v1/rooms
router.post(
  '/',
  auth,
  validate(CreateRoomSchema),
  async (req, res) => {
    try {
      const room = await roomService.createRoom(req.user.agentId, req.body);
      logger.info('Room created', { roomId: room.id, agentId: req.user.agentId });
      res.status(201).json(room);
    } catch (err) {
      handleError(err, res);
    }
  }
);

export default router;
```

**Use this pattern for podcast routes!**

---

## Next Week (Week 3) Preview

After Week 2, you'll have:
- ✅ Functional API endpoints
- ✅ Tests passing
- ✅ API documented

Week 3 will focus on:
- Frontend integration
- Real-time WebSocket updates
- Discovery page wired to API
- Component tests

---

**Week 2 Ready to Execute! 🚀**

**Start Date:** February 20, 2026  
**Estimated Duration:** 5 days  
**Status:** 📋 PLANNED (awaiting Week 1 completion)

---

**Generated:** February 13, 2026  
**Prepared for:** February 20 Session  
**Phase:** 1/4 (Strategic Pivot Integration)
