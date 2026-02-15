# Phase 5: Discovery & Trending - START HERE

**Status:** 🚀 PHASE 5 KICKOFF  
**Date:** March 1, 2026  
**Duration:** 4 weeks (March 1-29, 2026)  
**Phase Objective:** Build discovery page for browsing live rooms, searching, and trending algorithm

---

## Quick Navigation

| Want to... | Read... | Time |
|-----------|---------|------|
| **Understand Phase 5** | PHASE_5_KICKOFF.md | 15 min |
| **Implement Week 1 (Backend)** | PHASE_5_WEEK1_DISCOVERY_API.md | Start now |
| **Implement Week 2** | PHASE_5_WEEK2_TRENDING_ALGORITHM.md | Next week |
| **Implement Week 3 (Frontend)** | PHASE_5_WEEK3_FRONTEND.md | Week 3 |
| **Implement Week 4 (Integration)** | PHASE_5_WEEK4_INTEGRATION.md | Week 4 |

---

## What is Phase 5?

With **Phase 4 complete** (authentication + routing), users are logged in and protected. Now they need a way to **discover and join rooms**.

**Phase 5 builds:**
1. **Discovery Page** - Shows live rooms, trending, categories
2. **Trending Algorithm** - Scores rooms by engagement + growth
3. **Search** - Find rooms by title, agent, topic
4. **Categories** - Filter by interest (debate, coding, trading, etc)
5. **Room Details** - View participants, engagement before joining

**Result:** Authenticated users can browse, search, and join public rooms.

---

## Architecture Overview

### What Exists (Phase 4)
```
User logged in ✅
Bearer token auto-injected ✅
Protected routes enforce auth ✅
```

### What Phase 5 Builds
```
GET /discovery                 ← Main discovery page
  ├─ Live Now (rooms with status='live')
  ├─ Trending (rooms with high scoring)
  └─ Categories (10 core categories: debate, coding, trading, etc)

GET /discovery/search?q=term  ← Full-text search
GET /room/:id                 ← Room details + participants
POST /room/:id/join           ← Join room
```

### Data Flow
```
Frontend                  →    API Gateway (Express)   →    Database (PostgreSQL)
Discovery Page                /api/discovery               room table (updated)
  ↓                          ↓                              + category_id
  Show Live Rooms    →    DiscoveryService           →    + visibility
  Show Trending      →    TrendingService            →    + viewer metrics
  Show Categories    →    10 seeded categories       →    + engagement metrics
  Search             →    Full-text search           →    new tables:
  Room Details       →    room_viewers (real-time)      - room_viewers
  Join Room          →    room_engagement (scoring)     - room_engagement
                          room_participant (updated)      - category
```

---

## Week-by-Week Plan

### Week 1: Backend Discovery Service (Mar 1-7)
**Goal:** Build discovery API endpoints

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Database schema for trending | 4 new tables, 10 categories seeded |
| 2 | DiscoveryService (fetch live, search, filter) | 6 methods |
| 3 | TrendingService (scoring foundation) | Scoring algorithm |
| 4 | API routes (/discovery, /search, /categories, /room) | 8 routes |
| 5 | Integration tests | 20+ tests passing |

**After Week 1:**
- ✅ GET /api/discovery returns live + trending + categories
- ✅ GET /api/discovery/search?q=term returns results
- ✅ GET /room/:id returns room details
- ✅ POST /room/:id/join works

---

### Week 2: Trending Algorithm & Caching (Mar 8-14)
**Goal:** Implement intelligent trending scoring

- Day 6-7: Trending scoring formula (5 dimensions)
- Day 8: Redis caching (5-minute TTL)
- Day 9-10: Real-time score updates

**After Week 2:**
- ✅ Trending rooms ranked by engagement
- ✅ Scores cached for performance
- ✅ Scores update in real-time

---

### Week 3: Frontend Discovery Page (Mar 15-21)
**Goal:** Build React UI

| Component | Lines | Purpose |
|-----------|-------|---------|
| DiscoveryPage | 300 | Main page layout |
| LiveNowSection | 200 | Carousel of live rooms |
| TrendingSection | 180 | Trending list |
| RoomCard | 150 | Individual room preview |
| SearchBar | 120 | Search input |
| CategoryFilter | 100 | Category tabs |
| Pagination | 100 | Page controls |

**After Week 3:**
- ✅ Discovery page renders
- ✅ Live rooms carousel scrollable
- ✅ Trending list visible
- ✅ Category filter works
- ✅ Search bar functional
- ✅ 30+ component tests passing

---

### Week 4: Integration & Polish (Mar 22-29)
**Goal:** Complete room joining and E2E flows

- Day 16: Room details page
- Day 17: Join flow (validation + redirect to livestream)
- Day 18: Search integration
- Day 19: Performance optimization (lazy loading, virtual lists)
- Day 20: E2E tests, final polish

**After Week 4:**
- ✅ Full discovery → room details → join flow works
- ✅ Search returns relevant results
- ✅ Performance optimized (< 2 sec page load)
- ✅ All tests passing (70+)
- ✅ Ready for Phase 6 (Orchestrator integration)

---

## Success Criteria

### Functional
- ✅ Discovery page shows live rooms, trending, categories
- ✅ Search works (full-text on title, description)
- ✅ Category filter works
- ✅ Pagination handles 1000+ rooms
- ✅ Room details show participants
- ✅ Join room button works
- ✅ Only authenticated users can view/join

### Quality
- ✅ 70+ tests (backend + frontend)
- ✅ 85%+ code coverage
- ✅ 0 TypeScript errors
- ✅ All endpoints documented (JSDoc)
- ✅ Proper error handling

### Performance
- ✅ Discovery page < 2 sec load
- ✅ Search < 500ms response
- ✅ Trending cache updates every 5 min
- ✅ Room details < 1 sec
- ✅ Pagination handles large datasets

---

## Getting Started Right Now

### Step 1: Read Architecture (15 min)
```
1. Open PHASE_5_KICKOFF.md
2. Read "Architecture Context" section
3. Understand the data flow
```

### Step 2: Review Phase 4 (10 min)
```
1. Open PHASE_4_COMPLETE.md
2. Understand what auth guarantees
3. Review database schema (agent, room, room_participant)
```

### Step 3: Start Week 1 (Start Now!)
```
1. Open PHASE_5_WEEK1_DISCOVERY_API.md
2. Begin "Day 1: Database Schema & Migration"
3. Create migrations/002_discovery_schema.sql
4. Run migration and verify
```

---

## Key Concepts

### Trending Score (0-100)
```
Score = (
  0.35 * popularity_score +     // Viewer count
  0.25 * growth_score +         // Viewer growth rate
  0.20 * engagement_score +     // Messages per viewer
  0.15 * recency_boost +        // New rooms get boost
  0.05 * category_affinity      // Category match
)
```

Example:
- Room with 500 viewers, high growth, 10 comments per viewer → Score ~75
- New room with 50 viewers, 2 comments per viewer → Score ~45
- Old room with 1000 viewers but no growth → Score ~30

### Full-Text Search
PostgreSQL `tsvector` enables fast searching on title + description:
```
SELECT * FROM room WHERE search_vector @@ plainto_tsquery('english', 'debate')
```

Automatically updated on insert/update via trigger.

### Categories (Seeded)
10 core categories:
1. Debate
2. Coding
3. Trading
4. Research
5. Education
6. Entertainment
7. Music
8. Gaming
9. Science
10. Sports

Future: Admin can add more (Phase 5+)

---

## File Structure

### Backend (15 new files)
```
migrations/
  └─ 002_discovery_schema.sql

backend/src/
  ├─ services/
  │  ├─ discovery-service.ts          [getLiveNow, getTrending, search, etc]
  │  ├─ trending-service.ts           [calculateScore, cache updates]
  │  └─ room-service.ts               [UPDATED with viewer/engagement tracking]
  ├─ api/routes/
  │  └─ discovery.ts                  [8 endpoints]
  └─ config/
     └─ trending.ts                   [Scoring weights]

common/types/
  └─ discovery.ts                     [Room, Category, DiscoveryPage interfaces]

tests/
  ├─ integration/
  │  ├─ discovery.test.ts             [20+ tests]
  │  └─ trending.test.ts              [Scoring tests]
  └─ services/
     └─ trending-service.test.ts
```

### Frontend (12 new files)
```
frontend/src/
  ├─ pages/
  │  └─ discovery-page.tsx
  ├─ components/discovery/
  │  ├─ discovery-hero.tsx
  │  ├─ live-now-section.tsx
  │  ├─ trending-section.tsx
  │  ├─ category-filter.tsx
  │  ├─ room-card.tsx
  │  ├─ search-bar.tsx
  │  └─ pagination.tsx
  ├─ services/
  │  └─ discovery.ts
  └─ hooks/
     └─ use-discovery.ts

tests/
  ├─ pages/
  │  └─ discovery-page.test.tsx
  ├─ components/discovery/
  │  ├─ room-card.test.tsx
  │  ├─ category-filter.test.tsx
  │  ├─ search-bar.test.tsx
  │  └─ pagination.test.tsx
  └─ services/
     └─ discovery.test.ts
```

---

## Deployment Checklist (After Phase 5)

Before going live with Phase 5:

- [ ] All 70+ tests passing
- [ ] Coverage > 85%
- [ ] TypeScript strict: 0 errors
- [ ] Trending cache strategy tested
- [ ] Search performance verified (< 500ms for 1M rooms)
- [ ] Pagination handles large datasets
- [ ] Category icons/colors set
- [ ] Error messages helpful
- [ ] Logging in place
- [ ] Database indexes optimized

---

## Technical Decisions

### Why Full-Text Search?
- Native PostgreSQL support
- Fast (B-tree index on search_vector)
- Handles typos, stemming, phrase search
- Avoids Elasticsearch complexity for MVP

### Why Redis Cache for Trending?
- Trending changes frequently (every 5 min)
- Recalculating all scores is expensive
- Cache reduces database hits
- TTL prevents stale data

### Why Weighted Scoring?
- Popularity alone favors old content
- Growth alone favors new content
- Balance ensures diverse trending list
- Weights tunable based on user feedback

### Why Room Join as Simple POST?
- MVP: No payment logic yet (that's Phase 6)
- Just tracks participation (room_participant table)
- Orchestrator validates eligibility later
- Enables simple "add me to this room" flow

---

## Common Pitfalls to Avoid

1. **N+1 Queries:** Always JOIN agent + category in one query (not loop)
2. **Stale Cache:** Update trending scores every 5 min, not on every view
3. **Missing Indexes:** Index on (status, visibility, category_id, viewer_count)
4. **Pagination Off-by-One:** Use LIMIT + OFFSET correctly
5. **Search Too Broad:** Rank results by relevance (ts_rank), not just match

---

## Questions Before Starting?

Check the docs:
- Architecture flow → PHASE_5_KICKOFF.md
- Day-by-day tasks → PHASE_5_WEEK1_DISCOVERY_API.md
- Code standards → AGENTS.md
- Phase 4 foundation → PHASE_4_COMPLETE.md

---

## Next Steps

1. **Right now:** Open PHASE_5_KICKOFF.md and read architecture
2. **Next 15 min:** Review Phase 4 COMPLETE doc
3. **Next 30 min:** Open PHASE_5_WEEK1_DISCOVERY_API.md, Day 1
4. **By end of today:** Finish migration, start services
5. **By end of week:** All Week 1 deliverables complete

---

## Let's Go 🚀

**Status:** Phase 5 Kickoff Complete  
**Next:** Begin Week 1, Day 1 (Database Schema)

Open **PHASE_5_WEEK1_DISCOVERY_API.md** and get started.

---

Generated: March 1, 2026  
Lead: Architecture Team  
Status: READY FOR EXECUTION
