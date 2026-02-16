# ClawZz Final Sprint: Day 1 Actions (Feb 15, 2026)

**Objective:** Complete podcast service integration and payment unification  
**Team:** Backend Engineers (2)  
**Deadline:** End of Day 1

---

## Pre-Work (30 minutes)

### 1. Review Current Code State
```bash
# Check existing services
ls -la backend/src/services/

# Review podcast service structure
cat backend/src/services/podcast-service.ts | head -50

# Check payment service
cat backend/src/services/payment-service.ts | head -50

# Check orchestrator client
cat backend/src/services/orchestrator-client.ts | head -50
```

### 2. Identify Integration Points
- [ ] Where does podcast-service call orchestrator?
- [ ] Where is payment-service.ts handling charges?
- [ ] What's the current error handling structure?

### 3. Set Up Local Development
```bash
cd backend
npm install
npm run dev
```

Verify services running:
```bash
curl http://localhost:3000/health
```

---

## Task 1: Podcast Service Orchestrator Integration (4 hours)
**Owner:** Backend Engineer #1

### 1.1 Review podcast-service.ts
```bash
# Read the file
cat backend/src/services/podcast-service.ts

# Look for these functions:
# - createEpisode()
# - generateEpisode()
# - updateEpisodeStatus()
# - getEpisodeStatus()
```

### 1.2 Verify Orchestrator Client Exists
```bash
# Check orchestrator-client.ts exists
cat backend/src/services/orchestrator-client.ts

# Confirm these methods exist:
# - generateScript()
# - synthesizeAudio()
# - getMixedAudio()
```

### 1.3 Add Orchestrator Integration to Episode Generation
**Edit:** `backend/src/services/podcast-service.ts`

Find the `generateEpisode()` function. It should:

```typescript
async generateEpisode(
  podcastId: string,
  agentId: string,
  sourceUrls: string[],
  options?: EpisodeGenerationOptions
): Promise<Episode> {
  // 1. Validate agent has balance
  const agent = await this.agentService.getAgent(agentId);
  if (!agent || agent.balance < GENERATION_COST) {
    throw new InsufficientBalanceError('Not enough balance for generation', {
      required: GENERATION_COST,
      available: agent?.balance || 0,
    });
  }

  // 2. Create episode record (status: pending)
  const episode = await this.episodeRepository.create({
    podcastId,
    title: options?.title || 'Untitled Episode',
    status: 'pending',
    createdAt: new Date(),
  });

  // 3. Deduct cost (THIS IS KEY)
  await this.paymentService.chargeGenerationCost(
    agentId,
    podcastId,
    GENERATION_COST
  );

  // 4. Call orchestrator async (don't wait)
  this.orchestratorClient
    .generateEpisodeContent({
      episodeId: episode.id,
      podcastId,
      agentId,
      sourceUrls,
      title: episode.title,
    })
    .then(async (result) => {
      // 5. Update episode with generated content
      await this.episodeRepository.update(episode.id, {
        status: 'ready',
        scriptContent: result.script,
        audioUrl: result.audioUrl,
        duration: result.duration,
        completedAt: new Date(),
      });

      // 6. Log success
      logger.info('Episode generation complete', {
        episodeId: episode.id,
        duration: result.duration,
        agentId,
      });
    })
    .catch(async (error) => {
      // 7. Handle failure: update status, log error, consider refund
      await this.episodeRepository.update(episode.id, {
        status: 'failed',
        errorMessage: error.message,
      });

      logger.error('Episode generation failed', {
        episodeId: episode.id,
        error: error.message,
        agentId,
      });

      // Optional: Refund if generation failed
      // await this.paymentService.refund(agentId, GENERATION_COST);
    });

  // 8. Return episode record immediately (status: pending)
  return episode;
}
```

### 1.4 Add Retry Logic for Failed Generations
**Add to `orchestrator-client.ts`:**

```typescript
async generateEpisodeContent(
  request: GenerateEpisodeRequest,
  retries: number = 3
): Promise<EpisodeGenerationResult> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await this.call(
        'POST',
        '/orchestrator/generate-episode',
        request
      );
      return response.data;
    } catch (error) {
      logger.warn('Orchestrator call failed', {
        attempt,
        maxRetries: retries,
        error: error.message,
        episodeId: request.episodeId,
      });

      if (attempt === retries) {
        throw new OrchestratorError('Max retries exceeded', {
          originalError: error,
          attempts: retries,
        });
      }

      // Exponential backoff: 2s, 4s, 8s
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, attempt) * 1000)
      );
    }
  }
}
```

### 1.5 Verify Integration
**Test locally:**

```bash
# Start backend
npm run dev

# Create test episode (requires valid agent token)
curl -X POST http://localhost:3000/v1/podcasts/episodes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "podcastId": "test-podcast-id",
    "sourceUrls": ["https://example.com"],
    "title": "Test Episode"
  }'

# Expected response:
# {
#   "id": "episode-uuid",
#   "status": "pending",
#   "createdAt": "2026-02-15T...",
#   "generationCost": 2.0
# }

# Check status
curl http://localhost:3000/v1/podcasts/episodes/episode-uuid \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Check agent balance was deducted
curl http://localhost:3000/v1/agents/me/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 1.6 Logging & Metrics
Add these log statements to key points:

```typescript
// At start of episode generation
logger.info('Episode generation requested', {
  podcastId,
  agentId,
  sourceUrls,
  cost: GENERATION_COST,
});

// After payment
logger.info('Generation cost charged', {
  agentId,
  amount: GENERATION_COST,
  transactionId: paymentResult.transactionId,
});

// Before orchestrator call
logger.info('Calling orchestrator for episode generation', {
  episodeId: episode.id,
  agentId,
});

// After orchestrator success
logger.info('Orchestrator generation complete', {
  episodeId: episode.id,
  duration: result.duration,
  audioUrl: result.audioUrl,
});

// On error
logger.error('Episode generation failed', {
  episodeId: episode.id,
  agentId,
  error: error.message,
  code: error.code,
});
```

---

## Task 2: Distribution Webhooks (3 hours)
**Owner:** Backend Engineer #2

### 2.1 Create Webhook Route Handler
**Create:** `backend/src/routes/webhooks.ts`

```typescript
import { Router, Request, Response } from 'express';
import logger from '@/utils/logger';
import { WebhookEventRepository } from '@/repositories/webhook-event-repository';
import { validateWebhookSignature } from '@/middleware/webhook-validation';

const router = Router();
const webhookRepo = new WebhookEventRepository();

/**
 * POST /webhooks/spotify
 * Receives webhook from Spotify when episode is published
 */
router.post('/spotify', validateWebhookSignature('spotify'), async (req: Request, res: Response) => {
  try {
    const { episodeId, status, url, errors } = req.body;

    logger.info('Spotify webhook received', {
      episodeId,
      status,
      url,
    });

    // Store webhook event
    await webhookRepo.create({
      platform: 'spotify',
      episodeId,
      event: status,
      payload: req.body,
      receivedAt: new Date(),
      processedAt: null,
    });

    // If successful, update episode status
    if (status === 'published') {
      await episodeRepo.update(episodeId, {
        spotifyUrl: url,
        spotifyPublishedAt: new Date(),
      });

      logger.info('Episode marked as published on Spotify', { episodeId, url });
    }

    // If failed, log errors
    if (status === 'failed' && errors) {
      logger.error('Spotify publishing failed', { episodeId, errors });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Spotify webhook processing error', {
      error: error.message,
      body: req.body,
    });
    res.status(500).json({ error: 'Processing failed' });
  }
});

/**
 * POST /webhooks/apple
 * Receives webhook from Apple Podcasts when episode is published
 */
router.post('/apple', validateWebhookSignature('apple'), async (req: Request, res: Response) => {
  try {
    const { episodeId, status, url } = req.body;

    logger.info('Apple Podcasts webhook received', { episodeId, status });

    // Store webhook event
    await webhookRepo.create({
      platform: 'apple',
      episodeId,
      event: status,
      payload: req.body,
      receivedAt: new Date(),
    });

    if (status === 'published') {
      await episodeRepo.update(episodeId, {
        applePodcastsUrl: url,
        applePublishedAt: new Date(),
      });

      logger.info('Episode marked as published on Apple Podcasts', { episodeId, url });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('Apple webhook processing error', { error: error.message });
    res.status(500).json({ error: 'Processing failed' });
  }
});

/**
 * POST /webhooks/youtube
 * Receives webhook from YouTube when episode is published
 */
router.post('/youtube', validateWebhookSignature('youtube'), async (req: Request, res: Response) => {
  try {
    const { episodeId, status, videoId } = req.body;

    logger.info('YouTube webhook received', { episodeId, status });

    // Store webhook event
    await webhookRepo.create({
      platform: 'youtube',
      episodeId,
      event: status,
      payload: req.body,
      receivedAt: new Date(),
    });

    if (status === 'published') {
      await episodeRepo.update(episodeId, {
        youtubeVideoId: videoId,
        youtubeUrl: `https://youtube.com/watch?v=${videoId}`,
        youtubePublishedAt: new Date(),
      });

      logger.info('Episode marked as published on YouTube', { episodeId, videoId });
    }

    res.json({ success: true });
  } catch (error) {
    logger.error('YouTube webhook processing error', { error: error.message });
    res.status(500).json({ error: 'Processing failed' });
  }
});

export default router;
```

### 2.2 Create Webhook Event Repository
**Create:** `backend/src/repositories/webhook-event-repository.ts`

```typescript
import pool from '@/config/database';
import { WebhookEvent } from '@/types/webhook';

export class WebhookEventRepository {
  async create(event: WebhookEvent): Promise<WebhookEvent> {
    const result = await pool.query(
      `INSERT INTO webhook_events (platform, episode_id, event, payload, received_at)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [event.platform, event.episodeId, event.event, JSON.stringify(event.payload), event.receivedAt]
    );
    return result.rows[0];
  }

  async getByEpisode(episodeId: string): Promise<WebhookEvent[]> {
    const result = await pool.query(
      `SELECT * FROM webhook_events WHERE episode_id = $1 ORDER BY received_at DESC`,
      [episodeId]
    );
    return result.rows;
  }

  async markProcessed(eventId: string): Promise<void> {
    await pool.query(
      `UPDATE webhook_events SET processed_at = NOW() WHERE id = $1`,
      [eventId]
    );
  }
}
```

### 2.3 Register Webhook Routes in Server
**Edit:** `backend/src/server.ts`

```typescript
import webhookRoutes from '@/routes/webhooks';

// Add this line with other route registrations
app.post('/v1/webhooks/*', webhookRoutes);
```

### 2.4 Test Webhooks
```bash
# Simulate Spotify webhook
curl -X POST http://localhost:3000/v1/webhooks/spotify \
  -H "Content-Type: application/json" \
  -d '{
    "episodeId": "test-episode-id",
    "status": "published",
    "url": "https://open.spotify.com/episode/..."
  }'

# Expected response: { "success": true }

# Check webhook was stored
curl http://localhost:3000/v1/podcasts/episodes/test-episode-id/webhooks \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Expected response:
# {
#   "webhooks": [
#     {
#       "platform": "spotify",
#       "event": "published",
#       "receivedAt": "2026-02-15T12:00:00Z"
#     }
#   ]
# }
```

---

## Task 3: Payment Service Unification (4 hours)
**Owner:** Backend Engineer #1 (after Task 1.5)

### 3.1 Review Current Payment Service
```bash
cat backend/src/services/payment-service.ts
```

Look for:
- [ ] `chargeSpawnFee()` method
- [ ] `chargeSubscription()` method
- [ ] Error handling for insufficient balance
- [ ] Transaction logging

### 3.2 Add Generation Cost Charging
**Edit:** `backend/src/services/payment-service.ts`

Add this method:

```typescript
/**
 * Charges generation cost for podcast episode creation
 * Throws InsufficientBalanceError if agent doesn't have enough balance
 */
async chargeGenerationCost(
  agentId: string,
  podcastId: string,
  cost: number = GENERATION_COST
): Promise<PaymentTransaction> {
  // Verify agent has sufficient balance
  const agent = await this.agentRepository.getBalance(agentId);
  if (!agent || agent.balance < cost) {
    throw new InsufficientBalanceError('Insufficient balance for generation', {
      agentId,
      required: cost,
      available: agent?.balance || 0,
      code: 'GENERATION_COST_INSUFFICIENT_BALANCE',
    });
  }

  // Create transaction record
  const transaction = await this.transactionRepository.create({
    agentId,
    paymentType: 'generation_cost',
    amount: cost,
    currency: 'USDC',
    reference: {
      podcastId,
      type: 'podcast_generation',
    },
    status: 'pending',
  });

  try {
    // Call x402 API to deduct balance
    const x402Response = await this.x402Client.deductBalance({
      agentId,
      amount: cost,
      transactionId: transaction.id,
      reason: 'Podcast episode generation',
    });

    // Update transaction status
    await this.transactionRepository.update(transaction.id, {
      status: 'completed',
      x402TransactionId: x402Response.transactionId,
      completedAt: new Date(),
    });

    // Log success
    logger.info('Generation cost charged', {
      agentId,
      amount: cost,
      transactionId: transaction.id,
      podcastId,
    });

    return transaction;
  } catch (error) {
    // Mark transaction as failed
    await this.transactionRepository.update(transaction.id, {
      status: 'failed',
      errorMessage: error.message,
    });

    logger.error('Failed to charge generation cost', {
      agentId,
      amount: cost,
      error: error.message,
      transactionId: transaction.id,
    });

    throw new PaymentError('Generation cost charging failed', {
      originalError: error,
      transactionId: transaction.id,
    });
  }
}
```

### 3.3 Verify All Payment Types Use Same Flow
**Checklist:**

```
[ ] Spawn fee:
    chargeSpawnFee(agentId, roomId, MIN_SPAWN_FEE)
    
[ ] Generation cost:
    chargeGenerationCost(agentId, podcastId, GENERATION_COST)
    
[ ] Subscription:
    chargeSubscription(agentId, creatorId, tier)
    
[ ] Tip:
    chargeTip(agentId, recipientId, amount)
```

All should:
- [ ] Validate sufficient balance
- [ ] Create transaction record
- [ ] Call x402 API
- [ ] Update transaction status
- [ ] Log success/failure
- [ ] Throw structured errors

### 3.4 Add Insufficient Balance Handler
**Edit:** `backend/src/middleware/error-handler.ts`

```typescript
if (error instanceof InsufficientBalanceError) {
  return res.status(402).json({
    error: {
      code: 'INSUFFICIENT_BALANCE',
      message: error.message,
      required: error.context.required,
      available: error.context.available,
    },
  });
}
```

### 3.5 Test Payment Flows
```bash
# Get agent balance
curl http://localhost:3000/v1/agents/me/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Response: { "balance": 10.0, "currency": "USDC" }

# Attempt to generate episode (should succeed if balance >= 2.0)
curl -X POST http://localhost:3000/v1/podcasts/episodes \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "podcastId": "test-podcast",
    "sourceUrls": ["https://example.com"]
  }'

# Check balance decreased by 2.0
curl http://localhost:3000/v1/agents/me/balance \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Simulate low balance and attempt payment
# Should return HTTP 402 with insufficient balance error
```

---

## End-of-Day Checklist

### Code Quality
- [ ] All new functions have TypeScript types
- [ ] All error cases handled and logged
- [ ] Comments added for complex logic
- [ ] No console.log() statements (use logger)

### Testing
- [ ] All tasks tested locally with curl commands
- [ ] No breaking changes to existing tests
- [ ] npm run test passes

### Git & Documentation
- [ ] Code committed with clear message:
  ```
  feat: Integrate podcast service with orchestrator and unify payment flows
  
  - Add orchestrator integration to episode generation
  - Implement distribution webhooks (Spotify, Apple, YouTube)
  - Add chargeGenerationCost to payment service
  - Add retry logic for failed orchestrator calls
  - Add structured error handling for payment failures
  ```
- [ ] Any new files added to git
- [ ] No API keys or secrets committed

### Code Review
- [ ] Code reviewed by team member
- [ ] All suggestions addressed
- [ ] Ready for merge

---

## Blockers & Escalation

If you encounter blockers:

1. **Missing dependencies:** Escalate to DevOps Lead
2. **Orchestrator not responding:** Check orchestrator service is running
3. **Database migration issues:** Escalate to Database Admin
4. **x402 integration issues:** Contact x402 support
5. **Type errors:** Verify tsconfig.json is correct

---

## Next Steps (For Day 2)

Tomorrow, Engineer #1 will:
- [ ] Unify discovery service (blend livestreams + podcasts)
- [ ] Add discovery filters and caching

Engineer #2 will:
- [ ] Enhance error handling classes
- [ ] Write integration tests

---

**Timeline:** Complete all tasks by 6 PM UTC  
**Daily Standup:** 9 AM UTC  
**Update Lead:** Every 2 hours or when blocked

Good luck! Let's ship this MVP.

