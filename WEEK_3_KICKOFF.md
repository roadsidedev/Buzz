# Week 3 Kickoff: Frontend Integration & Discovery Launch

**Date:** February 20, 2026  
**Phase:** Post-Backend (Week 1-2 Backend Complete)  
**Status:** 🟢 **READY TO START**  
**Duration:** 5 days (Feb 20-24)  
**Team:** 1 Frontend Engineer

---

## Executive Summary

Week 3 transitions the project from backend-focused (podcast API + orchestrator) to frontend-focused. You'll build React components for podcast discovery, creation, episode playback, and live room participation. The backend (Week 1-2) is complete and fully tested—this week is about connecting it to the UI.

**Backend Prerequisites (All Met ✅):**
- ✅ 9 REST endpoints deployed
- ✅ Orchestrator service integrated
- ✅ Payment system ready
- ✅ Running on `localhost:4000`
- ✅ Full test coverage

**What You'll Build This Week:**
- 5 React components (forms + cards + player)
- 2 service layers (API client + WebSocket)
- 1 discovery page with search/filter
- 1 podcast detail page
- 25+ component tests
- Real-time event handling

---

## Start Here

### 1. Read These Documents (In Order)
1. **`WEEK_3_FRONTEND_LAUNCH.md`** (30 min)
   - Complete breakdown of deliverables
   - Daily task list
   - Component hierarchy
   - File structure

2. **`WEEK_3_DAY1_CHECKLIST.md`** (Start now)
   - Step-by-step for today
   - Environment setup
   - Dependency installation
   - Verification steps

3. **`API_REFERENCE.md`** (10 min)
   - All backend endpoints
   - Request/response examples
   - Error codes

### 2. Pre-flight Checklist
```bash
# Verify backend is running
curl http://localhost:4000/health

# You should see:
# {
#   "status": "ok",
#   "timestamp": "...",
#   "orchestrator": true
# }
```

- [ ] Backend responds to health check
- [ ] Orchestrator connection confirmed

### 3. Files Already Created (Day 1)
✅ **Week 3 Foundation Complete**

**Services (2 files):**
- `frontend/src/services/api.ts` (480 lines)
  - 15+ REST methods
  - Error handling
  - Token management
  - Retry logic

- `frontend/src/services/websocket.ts` (200 lines)
  - Real-time events
  - Connection lifecycle
  - Room join/leave

**Types (1 file):**
- `frontend/src/types/index.ts` (250 lines)
  - 20+ TypeScript interfaces
  - Request/response types
  - WebSocket event payloads

**All files:** Fully documented, fully typed, zero errors

---

## Week Overview

```
┌─ DAY 1 (Done) ────────────────────────────┐
│ Setup Services & Types                     │
│ - ApiClient service                        │
│ - WebSocket service                        │
│ - TypeScript definitions                   │
│ ✅ COMPLETE                                │
└────────────────────────────────────────────┘

┌─ DAY 2 ────────────────────────────────────┐
│ Build Form Components                      │
│ - CreatePodcastForm                        │
│ - CreateRoomForm                           │
│ - 5+ tests per form                        │
│ Estimated: 4 hours                         │
└────────────────────────────────────────────┘

┌─ DAY 3 ────────────────────────────────────┐
│ Build Content Cards & Player               │
│ - EpisodeCard                              │
│ - RoomCard                                 │
│ - EpisodePlayer                            │
│ - 8+ tests                                 │
│ Estimated: 4 hours                         │
└────────────────────────────────────────────┘

┌─ DAY 4 ────────────────────────────────────┐
│ Build Discovery & Details Page             │
│ - DiscoveryPage (scaffold)                 │
│ - SearchBar & CategoryFilter               │
│ - TrendingSection                          │
│ - 5+ tests                                 │
│ Estimated: 4 hours                         │
└────────────────────────────────────────────┘

┌─ DAY 5 ────────────────────────────────────┐
│ Complete Pages & Integration Tests         │
│ - DiscoveryPage (complete with pagination) │
│ - PodcastDetailPage                        │
│ - 4+ integration tests                     │
│ - Full test run (25+ tests)                │
│ - Coverage report (80%+ target)            │
│ Estimated: 5 hours                         │
└────────────────────────────────────────────┘

TOTAL: ~22 hours over 5 days (4-5 hrs/day)
```

---

## What's Already Done

### Week 1 (Backend API Gateway)
✅ 9 REST endpoints
✅ JWT authentication
✅ Request validation
✅ Error handling
✅ Rate limiting skeleton
✅ Full test coverage

### Week 2 (Backend Podcast Integration)
✅ PodcastService implementation
✅ OrchestratorClient integration
✅ Payment charging
✅ 21 unit tests
✅ 15+ integration tests
✅ Database migrations

### Week 3 Day 1 (Frontend Foundation)
✅ ApiClient service (15+ methods)
✅ WebSocketService (event handling)
✅ TypeScript types (20+ interfaces)
✅ Dependencies installed
✅ Environment configured
✅ Zero errors

---

## Architecture This Week

```
Frontend Layer (React Components)
│
├─ Pages/
│  ├─ DiscoveryPage (search, trending, live)
│  ├─ PodcastDetailPage (episodes, metadata)
│  ├─ CreatePodcastPage (form)
│  └─ CreateRoomPage (form)
│
├─ Components/
│  ├─ EpisodeCard (display episode)
│  ├─ RoomCard (display live room)
│  ├─ EpisodePlayer (play audio)
│  ├─ CreatePodcastForm (create)
│  └─ CreateRoomForm (create)
│
├─ Services/
│  ├─ apiClient (REST API calls)
│  └─ wsService (WebSocket events)
│
└─ Types/
   └─ Domain types (Podcast, Episode, Room, etc.)

          ↓ HTTP ↓ WebSocket ↓

Backend API Gateway (Node.js)
│
├─ Routes/
│  ├─ /api/v1/podcasts/* (podcast CRUD)
│  ├─ /api/v1/episodes/* (episode lifecycle)
│  └─ /api/v1/rooms/* (room management)
│
├─ Services/
│  ├─ PodcastService
│  ├─ OrchestratorClient
│  └─ PaymentService
│
└─ Database/
   └─ PostgreSQL (podcast, episode, room data)

          ↓ HTTP ↓

Orchestrator Service (Python)
│
├─ Scoring Engine (5 dimensions)
├─ Moderation Agent
├─ Turn Management
└─ Output Contracts
```

---

## Daily Deliverables

### Day 1: Foundation ✅
**Status:** COMPLETE
- Types file (250 lines)
- ApiClient service (480 lines)
- WebSocketService (200 lines)
- Dependencies installed
- Environment configured

### Day 2: Forms
**Expected:** 2 components, 10+ tests
- CreatePodcastForm with validation
- CreateRoomForm with type selector
- 5+ tests per form
- Form error handling

### Day 3: Cards & Player
**Expected:** 3 components, 8+ tests
- EpisodeCard with status badges
- RoomCard with join button
- EpisodePlayer with controls
- 2-3 tests per component

### Day 4: Discovery Page
**Expected:** 1 page, 5+ tests
- DiscoveryPage scaffold
- SearchBar with debounce
- CategoryFilter component
- TrendingSection component

### Day 5: Integration & Testing
**Expected:** 1 complete page, 4+ integration tests
- DiscoveryPage fully functional
- PodcastDetailPage with episodes
- Infinite scroll pagination
- Full test suite (25+ tests)

---

## Success Metrics (End of Week)

### Functional ✅
- All 5 core components render
- Forms validate and submit
- Audio player plays episodes
- Discovery page loads trending
- WebSocket receives real-time events
- Search debounces and filters
- Pagination works

### Quality ✅
- 25+ tests passing
- 80%+ code coverage
- Zero TypeScript errors
- ESLint passing
- All functions documented

### Performance ✅
- Discovery page loads < 1s
- Audio player starts < 500ms
- Form submission < 2s
- WebSocket connects < 1s

### UX ✅
- Loading states visible
- Error messages clear
- Mobile responsive (375px)
- Dark mode support
- Keyboard navigation

---

## How to Proceed

### Right Now (Next 5 minutes)
1. Read `WEEK_3_FRONTEND_LAUNCH.md`
2. Review `WEEK_3_DAY1_CHECKLIST.md`
3. Ensure backend is running: `curl http://localhost:4000/health`

### Next (Today, 1-2 hours)
1. Follow `WEEK_3_DAY1_CHECKLIST.md` step-by-step
2. Verify TypeScript compilation passes
3. Test that API client can be imported
4. Commit foundation work to git

### Tomorrow (Day 2)
1. Read the first section of `WEEK_3_FRONTEND_LAUNCH.md` (Days 2-3)
2. Create CreatePodcastForm component
3. Write form tests
4. Follow the same pattern for CreateRoomForm

---

## Important Notes

### 1. Follow the Pattern
Each component will follow this pattern:
```typescript
// 1. Define component props (TypeScript interface)
// 2. Export component function
// 3. Implement JSDoc comments
// 4. Use hooks for state/side effects
// 5. Validate inputs with Zod
// 6. Call API client for server operations
// 7. Handle errors with try/catch
// 8. Return JSX using Tailwind + shadcn/ui
```

### 2. No Reinventing
Before creating anything new:
- Check if similar component exists in `frontend/src/components/`
- Look at existing patterns in `App.tsx` or other pages
- Use the API client (don't call fetch directly)
- Use the WebSocket service (don't create socket connections)

### 3. Testing First Where Possible
For each component:
1. Write test cases first (list in checklist)
2. Render component with mock props
3. Write assertions for expected behavior
4. Implement component to pass tests

### 4. Types Are Required
Every component, function, and service method must be fully typed:
```typescript
// ❌ BAD
const handleClick = (e) => { ... }

// ✅ GOOD
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => { ... }
```

### 5. One Task at a Time
- Don't jump to Day 3 components on Day 2
- Complete tests before moving to next component
- Commit and document daily

---

## Git Workflow

### Daily Commits
```bash
# Day 1 (already done)
git commit -m "Week 3 Day 1: Setup foundation with types and services"

# Day 2 example
git commit -m "Week 3 Day 2: Add form components with validation

- Create CreatePodcastForm component
- Create CreateRoomForm component
- Add Zod validation schemas
- Write 10+ component tests
- Test coverage: 85%+"

# Day 5 final
git commit -m "Week 3 Complete: Frontend integration and discovery

- 5 components (forms, cards, player)
- 2 discovery pages
- 25+ tests with 80%+ coverage
- Real-time WebSocket integration
- Production-ready UI"
```

### Branch Strategy
```bash
# Create feature branch for week
git checkout -b week/3-frontend-integration

# Work on this branch all week
git add ...
git commit ...

# At end of week, merge to main
git checkout main
git merge week/3-frontend-integration
```

---

## Questions?

### Before You Start
- Backend running? → `curl http://localhost:4000/health`
- Dependencies installed? → `cd frontend && npm install`
- TypeScript passes? → `npx tsc --noEmit`
- Can you import api client? → `import { apiClient } from './services/api'`

### During Development
- Stuck on component? → Check `WEEK_3_FRONTEND_LAUNCH.md` component spec
- Not sure about API? → Check `API_REFERENCE.md` endpoint docs
- Test not passing? → Check test pattern in `WEEK_3_FRONTEND_LAUNCH.md`
- TypeScript error? → Add type annotation (never use `any`)

### Code Review
All code should:
- ✅ Use TypeScript strict mode
- ✅ Have JSDoc comments
- ✅ Include unit tests
- ✅ Follow naming conventions (camelCase for functions, PascalCase for components)
- ✅ Use existing patterns (api client, error handling)
- ✅ Have zero ESLint errors

---

## References

📚 **Read These First:**
1. `WEEK_3_FRONTEND_LAUNCH.md` — Complete week plan
2. `WEEK_3_DAY1_CHECKLIST.md` — Today's checklist
3. `API_REFERENCE.md` — Backend API docs

📚 **During Development:**
1. `AGENTS.md` — Code standards & naming conventions
2. `ARCHITECTURE_DECISIONS.md` — Why things are designed this way
3. `API_REFERENCE.md` — Endpoint specs and examples

📚 **For Context:**
1. `WEEK_2_COMPLETE.md` — What backend delivered
2. `PHASE_3_STATUS.md` — Overall phase planning

---

## Quick Start Checklist

- [ ] Read this document
- [ ] Read `WEEK_3_FRONTEND_LAUNCH.md`
- [ ] Start `WEEK_3_DAY1_CHECKLIST.md`
- [ ] Follow Day 1 checklist (3-6 hours)
- [ ] Commit foundation work
- [ ] Ready for Day 2 tomorrow

---

**Week 3 Ready to Launch! 🚀**

**Phase:** 1/4 (Strategic Pivot - Frontend Integration)  
**Status:** 🟢 Ready to start  
**Estimated Completion:** Feb 24, 2026  
**Team:** 1 Frontend Engineer  
**Time Budget:** ~22 hours  

**Go forth and build amazing React components!**

---

*Last Updated: February 20, 2026*  
*Generated by: Amp*  
*Phase 3 Kickoff*
