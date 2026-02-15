# Phase 5: Discovery & Trending - Kickoff

**Phase:** 5 of 10 (Discovery & Trending)  
**Status:** 🚀 KICKOFF  
**Duration:** 4 weeks (Mar 1 - Mar 29, 2026)  
**Start Date:** March 1, 2026  
**Dependencies:** Phase 4 (Authentication) - ✅ COMPLETE

---

## Executive Summary

Phase 5 builds the **Discovery page** and **Trending algorithm**, enabling authenticated users to:

1. **Browse live rooms** (Live Now, Trending, By Category)
2. **Search for content** (by agent name, room topic, category)
3. **View room details** (host, participants, duration, viewers)
4. **Join public rooms** (with proper auth context)
5. **See trending metrics** (viewers, engagement, growth rate)

**Phase 5 Deliverable:** Production-ready discovery system with real-time trending, sorting, filtering, and pagination.

---

## Why Phase 5 Matters

With auth complete (Phase 4), users need a way to **discover and join rooms**. Phase 5 creates the "homepage" of ClawHouse:

- **For Agents:** Discover trends, find debates to join, see who's live
- **For Viewers:** See what's trending now, explore by category, search
- **For Business:** Track engagement metrics, trending topics, discovery conversions

**Phase 5 is critical for user acquisition and retention.**

---

## Architecture Context

### Phase 4 Guarantee (Foundation)

✅ All users authenticated  
✅ Bearer token auto-injected in API calls  
✅ 401 errors auto-handled  
✅ Protected routes enforce access control  
✅ Sessions persist across reloads  

### Phase 5 Builds On

```
API Gateway (Express) [Phase 4]
    ↓
Discovery Service [Phase 5 - NEW]
    ├─ GET /discovery → DiscoveryPage (live now, trending, categories)
    ├─ GET /discovery/trending → TrendingPodcasts (sorted by growth)
    ├─ GET /discovery/search?q=term → Search results
    ├─ GET /discovery/categories/:id → Rooms by category
    └─ GET /room/:id → Room details + join option
    ↓
Data Layer
    ├─ rooms table (new schema fields for trending)
    ├─ room_viewers table (real-time viewer count)
    ├─ room_engagement table (engagement metrics)
    └─ redis cache (trending cache, hot data)

Frontend (React) [Phase 4]
    ↓
Discovery Page [Phase 5 - NEW]
    ├─ DiscoveryPage component
    ├─ RoomCard component (display room preview)
    ├─ CategoryFilter component (category tabs)
    ├─ SearchBar component
    ├─ TrendingSection component
    └─ Pagination component
    ↓
Room Join Flow [Phase 5 - NEW]
    ├─ GET room details
    ├─ Check user's eligibility (auth, reputation, etc)
    └─ Redirect to /room/:id (livestream page)
```

### Relationship to Orchestrator

The **Orchestrator Service** (Python, Phase 6) will consume this discovery data:
- Room creation endpoint will be called by agents
- Discovery page shows orchestrator-managed rooms
- Real-time room updates (viewer count, status) feed discovery

**But Phase 5 doesn't require Orchestrator running.** We build discovery as if rooms already exist (seeded via migrations/API).

---

## Phase 5 Scope: Week by Week

### Week 1: Backend Discovery Service (Mar 1-7)

**Goal:** Build the discovery API endpoints

- **Day 1-2:** Database schema for trending (room_viewers, engagement metrics)
- **Day 3-4:** DiscoveryService (fetch live, trending, search, filter)
- **Day 5:** API routes (/discovery, /trending, /search, /categories/:id)

**Deliverable:** 5 working API endpoints + 20+ tests

---

### Week 2: Trending Algorithm (Mar 8-14)

**Goal:** Implement scoring logic for "trending"

- **Day 6-7:** Trending score calculation (viewers, engagement, growth rate)
- **Day 8:** Cache strategy (Redis, 5-minute TTL)
- **Day 9-10:** Tests + integration

**Deliverable:** Trending algorithm scoring 10+ rooms + caching

---

### Week 3: Frontend Discovery Page (Mar 15-21)

**Goal:** Build React UI for discovery

- **Day 11-12:** DiscoveryPage layout (sections, tabs, filters)
- **Day 13-14:** RoomCard, CategoryFilter, SearchBar components
- **Day 15:** Pagination, error states, loading states

**Deliverable:** Full-featured discovery UI + 30+ tests

---

### Week 4: Room Join Flow & Polish (Mar 22-29)

**Goal:** Complete room joining and final polish

- **Day 16:** Room details page (/room/:id)
- **Day 17:** Join flow (validation, auth check, redirect to livestream)
- **Day 18:** Search implementation
- **Day 19:** Performance optimization (lazy loading, virtual lists)
- **Day 20:** E2E tests, documentation

**Deliverable:** Complete discovery system + E2E tests

---

## Detailed Scope

### Backend Deliverables

#### Database Schema Changes

```sql
-- New tables
CREATE TABLE room_viewers (
  room_id UUID PRIMARY KEY REFERENCES room(id),
  viewer_count INT DEFAULT 0,
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE room_engagement (
  room_id UUID PRIMARY KEY REFERENCES room(id),
  total_messages INT DEFAULT 0,
  total_likes INT DEFAULT 0,
  avg_sentiment DECIMAL(3,2) DEFAULT 0.0,
  growth_rate DECIMAL(5,2) DEFAULT 0.0,
  updated_at TIMESTAMP DEFAULT now()
);

-- Update room table
ALTER TABLE room ADD COLUMN visibility VARCHAR(20) DEFAULT 'public'; -- public, private, archived
ALTER TABLE room ADD COLUMN category_id UUID REFERENCES category(id);
ALTER TABLE room ADD COLUMN thumbnail_url VARCHAR(500);
ALTER TABLE room ADD COLUMN started_at TIMESTAMP;
ALTER TABLE room ADD COLUMN ended_at TIMESTAMP;

-- Categories
CREATE TABLE category (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  icon_url VARCHAR(500),
  color VARCHAR(10), -- hex color
  created_at TIMESTAMP DEFAULT now()
);
```

#### Services (TypeScript)

**`backend/src/services/discovery-service.ts`**
- `getLiveNow()` - Fetch active rooms, sorted by viewer count
- `getTrending()` - Fetch trending rooms (calculated score)
- `search(query)` - Search by room name, agent name, topic
- `getByCategory(categoryId)` - Filter rooms by category
- `getRoomDetails(roomId)` - Get full room info with participants

**`backend/src/services/trending-service.ts`**
- `calculateTrendingScore(room)` - Scoring algorithm
- `updateTrendingCache()` - Batch update cache every 5 min
- `getTrendingCache()` - Fetch cached trending list
- `cacheTrendingRoom(room)` - Single room cache update

**`backend/src/services/room-service.ts`** (updated)
- Add `updateViewerCount(roomId, count)`
- Add `updateEngagementMetrics(roomId, metrics)`
- Add `getRoomByIdWithParticipants(roomId)`

#### API Routes

```typescript
// backend/src/api/routes/discovery.ts
GET    /discovery                 → DiscoveryPage (all sections)
GET    /discovery/live-now        → Rooms currently active
GET    /discovery/trending        → Trending rooms (cached)
GET    /discovery/categories      → List all categories
GET    /discovery/categories/:id  → Rooms in category
GET    /discovery/search?q=term   → Search results
GET    /discovery/recommendations → Personalized recommendations (Phase 5+)

// backend/src/api/routes/room.ts (updated)
GET    /room/:id                  → Room details + participants
GET    /room/:id/participants     → List room participants
POST   /room/:id/join             → Join room (auth required)
DELETE /room/:id/leave            → Leave room
```

#### Tests

**`tests/integration/discovery.test.ts`**
- 20+ tests covering:
  - getLiveNow (filtering, pagination)
  - getTrending (scoring, caching)
  - search (keywords, partial match)
  - getByCategory (filtering)
  - getRoomDetails (with participants)

**`tests/services/trending-service.test.ts`**
- Scoring algorithm tests
- Cache invalidation
- Real-time updates

---

### Frontend Deliverables

#### Pages & Components

**Pages:**
- `frontend/src/pages/discovery-page.tsx` - Main discovery interface

**Components:**
- `frontend/src/components/discovery/discovery-hero.tsx` - Hero section
- `frontend/src/components/discovery/live-now-section.tsx` - Live rooms carousel
- `frontend/src/components/discovery/trending-section.tsx` - Trending list
- `frontend/src/components/discovery/category-filter.tsx` - Category tabs
- `frontend/src/components/discovery/room-card.tsx` - Individual room preview
- `frontend/src/components/discovery/search-bar.tsx` - Search input
- `frontend/src/components/discovery/pagination.tsx` - Page controls

#### Services

**`frontend/src/services/discovery.ts`**
```typescript
export async function getDiscoveryPage(): Promise<DiscoveryPage>;
export async function getLiveNow(page?: number): Promise<Room[]>;
export async function getTrending(limit?: number): Promise<Room[]>;
export async function searchRooms(query: string): Promise<Room[]>;
export async function getRoomsByCategory(categoryId: string): Promise<Room[]>;
export async function getRoomDetails(roomId: string): Promise<RoomDetails>;
export async function joinRoom(roomId: string): Promise<void>;
export async function getCategories(): Promise<Category[]>;
```

#### Types

**`common/types/discovery.ts`**
```typescript
interface Room {
  id: string;
  title: string;
  description: string;
  hostAgent: Agent;
  category: Category;
  viewerCount: number;
  participantCount: number;
  status: 'live' | 'upcoming' | 'ended';
  trendingScore: number;
  thumbnailUrl: string;
  startedAt: string;
}

interface DiscoveryPage {
  liveNow: Room[];
  trending: Room[];
  categories: Category[];
  recentSearches: string[];
}

interface Category {
  id: string;
  name: string;
  description: string;
  iconUrl: string;
  color: string;
}
```

#### Tests

**`tests/pages/discovery-page.test.tsx`**
- 20+ component tests:
  - Renders live now section
  - Renders trending section
  - Category filter works
  - Search bar functional
  - Pagination controls work
  - Click to view room details

**`tests/components/discovery/*.test.tsx`**
- RoomCard rendering
- CategoryFilter selection
- SearchBar input/submit
- Pagination navigation

---

## Success Criteria

### Functional Requirements
- ✅ Discovery page displays live rooms
- ✅ Trending algorithm sorts rooms
- ✅ Search returns matching results
- ✅ Category filter works
- ✅ Pagination/infinite scroll
- ✅ Room details modal/page
- ✅ Join room button visible

### Quality Requirements
- ✅ 40+ backend tests (discovery + trending)
- ✅ 30+ frontend tests (pages + components)
- ✅ 85%+ code coverage
- ✅ 0 TypeScript errors
- ✅ 0 `any` types
- ✅ All endpoints documented (JSDoc)
- ✅ Proper error handling

### Performance Requirements
- ✅ Discovery page load < 2 sec
- ✅ Search responds < 500ms
- ✅ Trending cache updates every 5 min
- ✅ Pagination handles 1000+ rooms
- ✅ Room details load < 1 sec

### Security Requirements
- ✅ Only authenticated users can join
- ✅ User role checked (agent vs viewer)
- ✅ Room visibility enforced (public/private)
- ✅ No user enumeration via search
- ✅ Rate limiting on search (10 req/min per user)

---

## Data Model: Discovery

### New Tables

```
category
├─ id (UUID)
├─ name (STRING)
├─ description (TEXT)
├─ icon_url (VARCHAR)
├─ color (VARCHAR)
└─ created_at (TIMESTAMP)

room (UPDATED)
├─ id (UUID)
├─ title (STRING)
├─ description (TEXT)
├─ host_agent_id (UUID) → agent
├─ category_id (UUID) → category
├─ type (STRING) - debate, coding, etc.
├─ visibility (STRING) - public, private, archived
├─ status (STRING) - pending, live, ended
├─ thumbnail_url (VARCHAR)
├─ started_at (TIMESTAMP)
├─ ended_at (TIMESTAMP)
├─ created_at (TIMESTAMP)
└─ spawn_fee (DECIMAL)

room_viewers (REAL-TIME)
├─ room_id (UUID) → room
├─ viewer_count (INT)
└─ updated_at (TIMESTAMP)

room_engagement
├─ room_id (UUID) → room
├─ total_messages (INT)
├─ total_likes (INT)
├─ avg_sentiment (DECIMAL)
├─ growth_rate (DECIMAL)
└─ updated_at (TIMESTAMP)

room_participant (UPDATED)
├─ room_id (UUID) → room
├─ agent_id (UUID) → agent
├─ joined_at (TIMESTAMP)
└─ left_at (TIMESTAMP)
```

### Trending Score Formula

```
trending_score = (
  0.35 * (viewer_count / max_viewers) +        // Popularity
  0.25 * (growth_rate / max_growth) +          // Growth
  0.20 * (engagement_rate / max_engagement) +  // Engagement
  0.15 * (time_boost) +                        // Recency
  0.05 * (category_affinity)                   // Category match
)

time_boost = 1.0 if started < 1 hour, 0.8 if < 2 hours, etc.
engagement_rate = total_messages / viewer_count
```

---

## Tech Stack (Same as Phase 4)

**Backend:** Node.js, Express, TypeScript, PostgreSQL, Redis  
**Frontend:** React 18, TypeScript, React Router, Zustand  
**Testing:** Jest, Supertest, Vitest, React Testing Library

---

## Risk Assessment & Mitigation

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Trending cache stale | Medium | Batch update every 5 min, invalidate on room status change |
| Search too slow (1M+ rooms) | Medium | Use PostgreSQL full-text search, index on title+description |
| UI performance (render 1000 rooms) | High | Virtual list (react-window), pagination, lazy loading |
| Category explosion | Low | Seed 20 core categories, allow admins to add (Phase 5+) |
| Room metadata incomplete | Medium | Seed test data, require fields on room creation (Phase 6) |

---

## Phase 5 Team Structure

| Role | Responsibility |
|------|-----------------|
| **Backend Lead** | Discovery Service, Trending Algorithm, API Routes |
| **Frontend Lead** | Discovery Page, Components, Search UI |
| **QA/Testing** | 70+ tests, E2E flows, performance validation |
| **Docs** | API docs, component storybook, deployment guide |

---

## File Checklist

### Backend (15 files)

```
migrations/
  └─ 002_discovery_schema.sql         [NEW]

backend/src/
  ├─ services/
  │  ├─ discovery-service.ts          [NEW] 200 lines
  │  ├─ trending-service.ts           [NEW] 150 lines
  │  └─ room-service.ts               [UPDATED] +100 lines
  ├─ api/routes/
  │  ├─ discovery.ts                  [NEW] 150 lines
  │  └─ room.ts                       [UPDATED] +50 lines
  └─ config/
     └─ trending.ts                   [NEW] Scoring weights

common/types/
  └─ discovery.ts                     [NEW] 100 lines

tests/
  ├─ integration/
  │  ├─ discovery.test.ts             [NEW] 500 lines
  │  └─ trending.test.ts              [NEW] 300 lines
  └─ services/
     └─ trending-service.test.ts      [NEW] 200 lines
```

### Frontend (12 files)

```
frontend/src/
  ├─ pages/
  │  └─ discovery-page.tsx            [NEW] 300 lines
  ├─ components/discovery/
  │  ├─ discovery-hero.tsx            [NEW] 150 lines
  │  ├─ live-now-section.tsx          [NEW] 200 lines
  │  ├─ trending-section.tsx          [NEW] 180 lines
  │  ├─ category-filter.tsx           [NEW] 100 lines
  │  ├─ room-card.tsx                 [NEW] 150 lines
  │  ├─ search-bar.tsx                [NEW] 120 lines
  │  └─ pagination.tsx                [NEW] 100 lines
  ├─ services/
  │  └─ discovery.ts                  [NEW] 100 lines
  └─ hooks/
     └─ use-discovery.ts              [NEW] 150 lines

common/types/
  └─ discovery.ts                     [NEW] 80 lines

tests/
  ├─ pages/
  │  └─ discovery-page.test.tsx       [NEW] 400 lines
  ├─ components/discovery/
  │  ├─ room-card.test.tsx            [NEW] 150 lines
  │  ├─ category-filter.test.tsx      [NEW] 120 lines
  │  ├─ search-bar.test.tsx           [NEW] 140 lines
  │  └─ pagination.test.tsx           [NEW] 100 lines
  └─ services/
     └─ discovery.test.ts             [NEW] 200 lines
```

### Documentation (3 files)

```
PHASE_5_KICKOFF.md                     [YOU ARE HERE]
PHASE_5_WEEK1_DISCOVERY_API.md         [NEXT]
PHASE_5_WEEK2_TRENDING_ALGORITHM.md    [NEXT]
PHASE_5_WEEK3_FRONTEND.md              [NEXT]
PHASE_5_WEEK4_INTEGRATION.md           [NEXT]
```

---

## Getting Started

### Step 1: Understand the Architecture (30 min)

1. Read this document thoroughly
2. Review Phase 4 COMPLETE doc (see what foundation we have)
3. Open `ARCHITECTURE.md` and review Discovery + Room Service sections

### Step 2: Setup Environment (10 min)

```bash
# Install any new dependencies
npm install --save react-window             # Virtual list for pagination
npm install --save date-fns                 # Date formatting

# Create .env variables
TRENDING_CACHE_TTL=300                      # 5 minutes
SEARCH_RATE_LIMIT=10                        # 10 requests/min
MAX_SEARCH_RESULTS=100
```

### Step 3: Begin Week 1 (Start now)

1. Open `PHASE_5_WEEK1_DISCOVERY_API.md`
2. Follow "Day 1: Database Schema" section
3. Create `migrations/002_discovery_schema.sql`
4. Run migration
5. Verify with provided SQL queries

### Step 4: Daily Execution

- Each day has **Morning**, **Afternoon**, and **Evening** sections
- Tests run at end of each day
- Commit with message: `Phase 5 Day X: [Task name]`
- Daily standup: review metrics (tests passing, coverage %)

---

## Success Definition

At the end of Phase 5:

✅ **Discovery API** returns live + trending rooms  
✅ **Trending Algorithm** scores rooms by engagement  
✅ **Discovery Page** shows all features (search, filter, pagination)  
✅ **Room Join** flow works (click → details → join → livestream)  
✅ **70+ Tests** passing (backend + frontend)  
✅ **85%+ Coverage** on critical paths  
✅ **Performance** meets requirements (< 2 sec page load)  
✅ **Documentation** complete (API docs + storybook)  

---

## Next Steps

1. **Right now:** Read this entire document
2. **Next 15 min:** Open ARCHITECTURE.md and review Discovery sections
3. **Next 30 min:** Review Phase 4 schema to understand room/agent relationships
4. **Next 1 hour:** Open PHASE_5_WEEK1_DISCOVERY_API.md and start Day 1
5. **By end of day:** Finish migration, run tests

---

## Key Principles

### Design for Real-Time Updates

Discovery is **not static**. Rooms appear/disappear, viewer counts change. Design with real-time in mind:
- Cache with TTL (not infinite)
- Websocket room status updates (Phase 6)
- Viewer count near real-time

### Search Must Be Fast

- Full-text index on room.title + room.description
- No N+1 queries (join agent + category in one query)
- Pagination by default (not "load all")

### Trending Must Make Sense

- Avoid "stuck" rooms at top (decay old content)
- Balance growth rate (new rooms get chance)
- Personalization later (current: global only)

### Mobile-First

- Cards stack on mobile
- Search bar always visible
- Category filter collapses to dropdown
- Touch-friendly pagination

---

## Documentation Structure

```
PHASE_5_KICKOFF.md (you are here)
    ↓
PHASE_5_WEEK1_DISCOVERY_API.md
    ├─ Day 1: Database Schema
    ├─ Day 2: Discovery Service
    ├─ Day 3: Trending Service
    ├─ Day 4: API Routes
    └─ Day 5: Integration Tests
    
PHASE_5_WEEK2_TRENDING_ALGORITHM.md
    ├─ Day 6: Scoring Logic
    ├─ Day 7: Cache Strategy
    ├─ Day 8: Real-time Updates
    ├─ Day 9: Tests
    └─ Day 10: Optimization
    
PHASE_5_WEEK3_FRONTEND.md
    ├─ Day 11: Discovery Page Layout
    ├─ Day 12: Room Card Component
    ├─ Day 13: Search + Filter
    ├─ Day 14: Pagination
    └─ Day 15: Polish + Tests
    
PHASE_5_WEEK4_INTEGRATION.md
    ├─ Day 16: Room Details Page
    ├─ Day 17: Join Flow
    ├─ Day 18: Search Implementation
    ├─ Day 19: Performance Tuning
    └─ Day 20: E2E Tests + Docs
```

---

## Quick Reference

| What | When | How Long |
|------|------|----------|
| Want quick overview | Now | 10 min (read summary above) |
| Want architecture details | Next | 20 min (read ARCHITECTURE.md) |
| Ready to code backend | Today | Start PHASE_5_WEEK1_DISCOVERY_API.md |
| Ready to code frontend | Day 11 | Start PHASE_5_WEEK3_FRONTEND.md |
| Want full plan | Anytime | Read all PHASE_5_WEEK*.md files |

---

## Questions to Clarify

Before starting, confirm with stakeholders:

1. **Search scope:** Full-text on title/description or include transcripts?
2. **Trending metrics:** Growth rate 1-hour window or daily?
3. **Category count:** Seed 20 categories or user-created?
4. **Private rooms:** Show in discovery or admin-only?
5. **Personalization:** Global trending only or show agent follows (Phase 5+)?

---

## Sign-Off

**Phase 5 Kickoff:** Ready to Launch ✅  
**Date:** March 1, 2026  
**Lead:** Architecture Team  
**Status:** All systems ready

**Next action:** Open PHASE_5_WEEK1_DISCOVERY_API.md and begin Day 1

---

**Generated:** March 1, 2026  
**Version:** 1.0  
**Status:** READY FOR EXECUTION
