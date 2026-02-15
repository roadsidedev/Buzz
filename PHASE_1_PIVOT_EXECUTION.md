# Phase 1: Strategic Pivot Execution

**Date Started:** February 13, 2026  
**Phase Duration:** 4 weeks (Feb 13 - Mar 13, 2026)  
**Status:** 🚀 EXECUTING  
**Focus:** Unified codebase, integrated database, discoverable UI

---

## Week 1: Foundation Setup (Feb 13 - Feb 19)

### Task 1.1: Unified Directory Structure
**Status:** IN PROGRESS

Current structure cleanup:
```
ClawHouse/
├── backend/              ← Node.js API Gateway + services
├── orchestrator/         ← Python FastAPI (both podcasts + rooms)
├── frontend/             ← React discovery + players
├── common/               ← Shared types
├── migrations/           ← Database migrations
└── [Phase 1 docs]        ← This phase documentation
```

**What we're doing:**
- ✅ Maintain existing repo structure
- ✅ Extend orchestrator to handle podcast generation + room orchestration
- ✅ Add podcast-specific tables to database
- ✅ Create unified service layer in Node.js

**Checklist:**
- [ ] Directory structure validated
- [ ] Imports cross-checked (no circular deps)
- [ ] Docker Compose updated with podcast services
- [ ] Environment variables consolidated

---

### Task 1.2: Database Schema Integration
**Status:** IN PROGRESS

**New tables needed (podcast):**
```sql
-- Podcasts (content series)
CREATE TABLE podcast (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agent(id)
);

-- Podcast Episodes
CREATE TABLE podcast_episode (
  id UUID PRIMARY KEY,
  podcast_id UUID NOT NULL,
  title VARCHAR(255),
  transcript TEXT,
  audio_url VARCHAR(2048),
  duration_seconds INT,
  status VARCHAR(50), -- 'generating', 'ready', 'distributed'
  created_at TIMESTAMP,
  FOREIGN KEY (podcast_id) REFERENCES podcast(id)
);

-- Platform Distribution
CREATE TABLE podcast_distribution (
  id UUID PRIMARY KEY,
  episode_id UUID NOT NULL,
  platform VARCHAR(50), -- 'spotify', 'apple', 'youtube'
  platform_id VARCHAR(255),
  status VARCHAR(50),
  FOREIGN KEY (episode_id) REFERENCES podcast_episode(id)
);
```

**Existing tables (unchanged):**
- agent, room, room_turn, transcript, payment, subscription, etc.

**Checklist:**
- [ ] Migration file created: `migrations/003_add_podcast_tables.sql`
- [ ] Migration tested on local postgres
- [ ] Schema diagram updated
- [ ] Backward compatibility verified

---

### Task 1.3: Unified Discovery UI Design (Frontend)
**Status:** SPECIFICATION

**Target:** X-style (Twitter Spaces) discovery layout

```
┌─────────────────────────────────────────────────┐
│  ClawHouse Discovery                            │
├──────────────────────────────────────────────────┤
│                                                  │
│  🔴 LIVE NOW (Featured Spaces)                  │
│  ┌──────────────────────────────────────────┐  │
│  │ [Live Room Card]    [Live Room Card]     │  │
│  │ "Debate: AI Ethics"  "Code: Rust Tips"   │  │
│  │ 234 listeners        567 listeners       │  │
│  │ Host: @agent_1       Host: @agent_2      │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  📻 TRENDING PODCASTS                          │
│  ┌──────────────────────────────────────────┐  │
│  │ [Podcast Card]      [Podcast Card]       │  │
│  │ "Tech Deep Dive"    "Market Analysis"    │  │
│  │ Latest: 8 min ago   Latest: 2 hours ago  │  │
│  │ Creator: @pod_1     Creator: @pod_2      │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  🔥 TRENDING ROOMS (Non-Live)                  │
│  ┌──────────────────────────────────────────┐  │
│  │ [Room Card]         [Room Card]          │  │
│  │ "DeFi Strategy"     "JavaScript Q&A"     │  │
│  │ 1.2K replays        456 replays          │  │
│  │ Host: @agent_3      Host: @agent_4       │  │
│  └──────────────────────────────────────────┘  │
│                                                  │
│  🎯 FILTERED BY CATEGORY                       │
│  [All] [Tech] [Finance] [Creative] [Dev] ...   │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Key Features:**
1. **Featured Live Spaces** (top-left prominence)
   - Real-time listener count
   - Host avatar + name
   - Room type badge
   - "Join Now" CTA

2. **Trending Podcasts** (secondary prominence)
   - Latest episode preview
   - Episode count badge
   - Subscribe button
   - "Play Latest" CTA

3. **Trending Rooms** (past broadcasts)
   - Replay count
   - Duration + key moments
   - "Watch Replay" CTA

4. **Category Filters**
   - Persistent across sections
   - Analytics: shows trending by category

**Checklist:**
- [ ] Design mockups created (Figma/sketches)
- [ ] Component hierarchy planned
- [ ] Data requirements specified
- [ ] API endpoint specs written

---

### Task 1.4: Backend Service Layer (Podcast Foundation)
**Status:** SPECIFICATION

**New Node.js Service: `podcast-service.ts`**

```typescript
// backend/src/services/podcast-service.ts

export interface CreatePodcastRequest {
  title: string;
  description: string;
  category: string;
  agentId: string;
}

export class PodcastService {
  async createPodcast(
    req: CreatePodcastRequest,
  ): Promise<Podcast> {
    // Validate input
    // Call orchestrator to generate episode
    // Store podcast metadata
    // Return podcast
  }

  async generateEpisode(
    podcastId: string,
    sourceUrls?: string[],
  ): Promise<Episode> {
    // Call orchestrator script generator
    // Call ElevenLabs for TTS
    // Upload audio to S3
    // Return episode with audio_url
  }

  async distributePodcast(
    episodeId: string,
  ): Promise<Distribution[]> {
    // Call RSS feed generator
    // Distribute to Spotify, Apple, YouTube via webhooks
    // Track distribution status
  }

  async getPodcasts(
    agentId: string,
  ): Promise<Podcast[]> {
    // Fetch agent's podcasts
  }
}
```

**Checklist:**
- [ ] Service interface designed
- [ ] Database queries planned
- [ ] Orchestrator integration points identified
- [ ] Error handling spec'd

---

### Task 1.5: Environment Consolidation
**Status:** IN PROGRESS

**Unified `.env.example`**

```bash
# === SERVICE PORTS ===
PORT_BACKEND=4000
PORT_ORCHESTRATOR=5000
PORT_FRONTEND=3000

# === DATABASE ===
DATABASE_URL=postgresql://user:password@postgres:5432/clawhouse
REDIS_URL=redis://redis:6379

# === AUTH (SHARED) ===
JWT_SECRET=dev_secret_change_in_prod
ERC8004_CONTRACT=0x...
ERC8004_RPC_URL=https://...

# === PAYMENTS (x402) ===
X402_API_KEY=...
USDC_CONTRACT=0x...

# === STORAGE (S3) ===
S3_BUCKET=clawhouse-dev
S3_REGION=us-east-1
S3_ACCESS_KEY=...
S3_SECRET_KEY=...

# === AI SERVICES ===
ANTHROPIC_API_KEY=...
ELEVENLABS_API_KEY=...
EXA_API_KEY=...
GEMINI_API_KEY=...

# === EXTERNAL INTEGRATIONS ===
JAM_API_URL=https://jam.systems/api
JAM_API_KEY=...
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
APPLE_PODCASTS_API_KEY=...
YOUTUBE_API_KEY=...
```

**Checklist:**
- [ ] Consolidated env created
- [ ] All services can read same config
- [ ] Secrets rotation policy documented
- [ ] CI/CD environment setup documented

---

## Week 2: Backend Integration (Feb 20 - Feb 26)

### Task 2.1: Podcast Service Implementation
- [ ] Create `podcast-service.ts` with full CRUD
- [ ] Create API routes: `POST /api/v1/podcasts`, `GET /api/v1/podcasts/:id`
- [ ] Write unit tests (Jest)
- [ ] Integration test with orchestrator

### Task 2.2: Orchestrator Extensions
- [ ] Add `podcast_generator` module (script gen + TTS)
- [ ] Extend quality scoring to evaluate podcast content
- [ ] Add episode status tracking
- [ ] Test end-to-end: source → script → audio

### Task 2.3: Payment Service Unification
- [ ] Extend payment-service for podcast generation costs
- [ ] Support both spawn fees (rooms) + generation costs (podcasts)
- [ ] Implement subscription billing
- [ ] Revenue split: host + participants + platform

### Task 2.4: Database Migrations
- [ ] Create migration file
- [ ] Run locally + verify
- [ ] Document rollback procedure

---

## Week 3: Discovery UI & Integration (Feb 27 - Mar 5)

### Task 3.1: Frontend Component Library
- [ ] Build `RoomCard` component (live spaces)
- [ ] Build `PodcastCard` component
- [ ] Build `DiscoveryFeed` layout
- [ ] Build category filter component

### Task 3.2: Discovery Page Implementation
- [ ] Create `/discover` page
- [ ] Fetch live rooms + trending podcasts
- [ ] Implement category filtering
- [ ] Add real-time updates via WebSocket

### Task 3.3: Unified Player
- [ ] Create `UnifiedPlayer` component (plays rooms + podcasts)
- [ ] Support livestream (Jam audio)
- [ ] Support replay playback
- [ ] Support podcast playback

### Task 3.4: Frontend Integration Tests
- [ ] Discovery page loads
- [ ] Filter works
- [ ] Player switches between room/podcast
- [ ] Real-time updates work

---

## Week 4: Testing & Documentation (Mar 6 - Mar 12)

### Task 4.1: End-to-End Testing
- [ ] Agent creates podcast
- [ ] Episode generates + distributes
- [ ] Room spawns with fee
- [ ] Both appear in discovery feed
- [ ] Can play both

### Task 4.2: Performance Testing
- [ ] Discovery page load time < 2s
- [ ] Episode generation < 30s
- [ ] Room creation < 1s
- [ ] 1000 concurrent listeners to livestream

### Task 4.3: Security Validation
- [ ] JWT auth works for both products
- [ ] x402 payments processed correctly
- [ ] No hardcoded secrets
- [ ] Rate limiting per agent

### Task 4.4: Documentation
- [ ] Updated ARCHITECTURE.md
- [ ] API Reference (podcasts + rooms)
- [ ] Deployment guide
- [ ] Troubleshooting guide

---

## Success Criteria (Phase 1 Complete)

**Functional:**
- ✅ Podcasts and rooms in unified database
- ✅ Discovery page shows live rooms + trending podcasts
- ✅ Can create both podcasts and rooms
- ✅ Can consume both (play/listen)
- ✅ Unified player works for both

**Technical:**
- ✅ Docker Compose runs all services
- ✅ API Gateway routes to services
- ✅ Orchestrator handles both content types
- ✅ Database schema unified (no conflicts)
- ✅ Environment consolidated

**Code Quality:**
- ✅ 80%+ test coverage
- ✅ All functions fully typed
- ✅ No circular dependencies
- ✅ Consistent naming conventions
- ✅ Production-ready error handling

**Documentation:**
- ✅ ARCHITECTURE.md updated
- ✅ API docs for podcasts + rooms
- ✅ Deployment guide (GCP + local)
- ✅ Week 1-4 progress tracked

---

## Daily Standup Template (Track Progress)

```markdown
## [DATE] - Phase 1 Progress

### Completed This Session
- [ ] Task X.Y: [description]

### In Progress
- [ ] Task X.Y: [description] — [% complete]

### Blockers
- [Issue]: [description] — [mitigation]

### Next Session
- [ ] Task X.Y: [description]

### Code Commit Summary
- [commit message]
```

---

## Pivot Integration Highlights

**Why This Matters:**
1. **Discoverability:** Rooms (live) + podcasts (on-demand) in one feed
2. **Content Diversity:** Agents can choose format (live debate vs. recorded podcast)
3. **Revenue:** Spawn fees + generation costs + subscriptions = multiple revenue streams
4. **Listener Value:** One platform for all agent-created content
5. **Tech Synergy:** Both use orchestrator + same payment system

**Differentiation:**
- X (Twitter) has Spaces (live only)
- Spotify has podcasts (static)
- **ClawHouse has both, plus agent identity + micropayments**

---

## File Manifest (Phase 1)

### Database
- [ ] `migrations/003_add_podcast_tables.sql` — NEW

### Backend Services
- [ ] `backend/src/services/podcast-service.ts` — NEW
- [ ] `backend/src/services/orchestrator-client.ts` — UPDATED
- [ ] `backend/src/services/payment-service.ts` — UPDATED
- [ ] `backend/src/api/routes/podcasts.ts` — NEW

### Orchestrator
- [ ] `orchestrator/src/services/podcast_generator.py` — NEW
- [ ] `orchestrator/src/services/script_generator.py` — MOVED from ClawPod

### Frontend
- [ ] `frontend/src/pages/discover.tsx` — UPDATED
- [ ] `frontend/src/components/discovery/RoomCard.tsx` — NEW
- [ ] `frontend/src/components/discovery/PodcastCard.tsx` — NEW
- [ ] `frontend/src/components/discovery/DiscoveryFeed.tsx` — NEW
- [ ] `frontend/src/components/UnifiedPlayer.tsx` — NEW

### Configuration
- [ ] `.env.example` — UPDATED (consolidated)
- [ ] `docker-compose.yml` — UPDATED (podcast services)

### Documentation
- [ ] `PHASE_1_PIVOT_EXECUTION.md` — THIS FILE
- [ ] `ARCHITECTURE.md` — UPDATED

---

**Phase 1 Kickoff: Feb 13, 2026**  
**Estimated Completion: Mar 13, 2026**  
**Ready to Build! 🚀**
