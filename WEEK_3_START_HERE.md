# Week 3: START HERE 🚀

**You are here:** Frontend Integration Phase  
**Date:** February 20, 2026  
**Team:** 1 Frontend Engineer  
**Duration:** 5 days (Feb 20-24)  

---

## What Happened in Weeks 1-2?

✅ **Backend API Gateway** (Week 1) — Complete with 9 endpoints  
✅ **Podcast Services** (Week 2) — Full integration with Orchestrator  
✅ **Database Migrations** (Week 1-2) — All tables created  
✅ **Tests** (Week 1-2) — 36+ unit & integration tests  

**Status:** Backend is ready. You can start building React components.

---

## What You'll Build This Week

| Day | What | How Many | Lines |
|-----|------|---------|-------|
| 1 | Services + Types | 2+1 | 930 |
| 2 | Forms | 2 | 290 |
| 3 | Cards + Player | 3 | 400 |
| 4 | Discovery Page | 4 | 300 |
| 5 | Full Pages | 2 | 450 |
| — | **Tests** | **30+** | **1000+** |

**Total:** 2+ pages, 11+ components, 30+ tests

---

## Documents to Read (In Order)

### 1. Overview (Start with THIS)
📖 **[WEEK_3_KICKOFF.md](./WEEK_3_KICKOFF.md)** (15 min)
- Executive summary
- Week timeline
- Success criteria
- Quick start checklist

### 2. Detailed Plan (Then read THIS)
📖 **[WEEK_3_FRONTEND_LAUNCH.md](./WEEK_3_FRONTEND_LAUNCH.md)** (30 min)
- Component specifications
- Daily breakdown with exact tasks
- Testing strategy
- File structure
- Code patterns

### 3. Today's Checklist (Then DO THIS)
📖 **[WEEK_3_DAY1_CHECKLIST.md](./WEEK_3_DAY1_CHECKLIST.md)** (6 hours)
- Step-by-step setup
- Dependency installation
- Environment configuration
- Git commit guide

### 4. Quick Reference (Keep THIS handy)
📖 **[WEEK_3_QUICK_REFERENCE.md](./WEEK_3_QUICK_REFERENCE.md)** (bookmark)
- API client methods
- WebSocket events
- Component template
- Testing template
- Common patterns

### 5. API Documentation (Reference THIS)
📖 **[API_REFERENCE.md](./API_REFERENCE.md)**
- All 9 backend endpoints
- Request/response examples
- Error codes
- Status codes

---

## The Files I Created for You (Day 1)

### Services (2 files created)

**📁 `frontend/src/types/index.ts`** (250 lines)
- 20+ TypeScript interfaces for all domain models
- Podcast, Episode, Room, Agent, Message types
- WebSocket event payloads
- Request/response types

**📁 `frontend/src/services/api.ts`** (480 lines)
- ApiClient class with 15+ REST methods
- Error handling and retry logic
- Token management
- Request building and response parsing

**📁 `frontend/src/services/websocket.ts`** (200 lines)
- WebSocketService for real-time events
- Connection lifecycle management
- Event listener registration
- Room join/leave methods

### Documentation (4 files created)

**📁 `WEEK_3_FRONTEND_LAUNCH.md`** — Complete week plan  
**📁 `WEEK_3_DAY1_CHECKLIST.md`** — Today's checklist  
**📁 `WEEK_3_KICKOFF.md`** — Week overview  
**📁 `WEEK_3_QUICK_REFERENCE.md`** — Quick reference card  

---

## Get Started Right Now (Next 30 Minutes)

### Step 1: Read Overview (15 min)
Open and read: **`WEEK_3_KICKOFF.md`**
- Understand what you're building
- Check off the quick start checklist
- Note the backend health check

### Step 2: Verify Backend is Running (5 min)
```bash
# Open terminal/PowerShell
curl http://localhost:4000/health

# You should see:
# {
#   "status": "ok",
#   "timestamp": "2026-02-20T...",
#   "orchestrator": true
# }
```

If that doesn't work:
- [ ] Verify backend is running: `cd backend && npm run dev`
- [ ] Check port 4000: `netstat -ano | findstr :4000` (Windows)

### Step 3: Follow Day 1 Checklist (6 hours)
Open: **`WEEK_3_DAY1_CHECKLIST.md`**

Follow it step-by-step:
1. Install dependencies
2. Create environment variables
3. Verify TypeScript compilation
4. Verify backend API works
5. Commit to git

---

## Daily Schedule

### Days 1-5 (This Week)

**Day 1 (Today): Foundation Setup** ✅
- Duration: 6 hours
- Task: Follow `WEEK_3_DAY1_CHECKLIST.md`
- Commit: "Week 3 Day 1: Setup foundation with types and services"

**Day 2: Form Components**
- Duration: 4 hours
- Task: Follow `WEEK_3_FRONTEND_LAUNCH.md` Days 2-3 section
- Build: CreatePodcastForm, CreateRoomForm
- Commit: "Week 3 Day 2: Add form components with validation"

**Day 3: Content Components**
- Duration: 4 hours
- Task: Follow `WEEK_3_FRONTEND_LAUNCH.md` Days 3-4 section
- Build: EpisodeCard, RoomCard, EpisodePlayer
- Commit: "Week 3 Day 3: Add episode and room components"

**Day 4: Discovery Page**
- Duration: 4 hours
- Task: Follow `WEEK_3_FRONTEND_LAUNCH.md` Days 4-5 section
- Build: DiscoveryPage scaffold, SearchBar, CategoryFilter
- Commit: "Week 3 Day 4: Build discovery page structure"

**Day 5: Full Integration**
- Duration: 5 hours
- Task: Follow `WEEK_3_FRONTEND_LAUNCH.md` Day 5 section
- Build: Complete DiscoveryPage, PodcastDetailPage
- Test: Run full test suite (30+ tests)
- Commit: "Week 3 Complete: Frontend integration with 30+ tests"

---

## Key Files You'll Work With

### Write Code Here
```
frontend/
├── src/
│   ├── components/
│   │   ├── forms/              ← Create forms here
│   │   ├── cards/              ← Create cards here
│   │   ├── players/            ← Create player here
│   │   ├── discovery/          ← Create discovery components here
│   │   └── layout/             ← Layout components
│   │
│   ├── pages/                  ← Create pages here
│   │   ├── DiscoveryPage.tsx   ← NEW
│   │   └── PodcastDetailPage.tsx ← NEW
│   │
│   ├── services/               ← Already created
│   │   ├── api.ts              ✅ Done
│   │   ├── websocket.ts        ✅ Done
│   │   └── auth.ts
│   │
│   ├── types/
│   │   └── index.ts            ✅ Done
│   │
│   └── hooks/                  ← May create custom hooks
```

### Write Tests Here
```
tests/
├── unit/
│   ├── components/
│   │   ├── EpisodeCard.test.tsx
│   │   ├── RoomCard.test.tsx
│   │   ├── EpisodePlayer.test.tsx
│   │   ├── CreatePodcastForm.test.tsx
│   │   └── CreateRoomForm.test.tsx
│   │
│   └── services/
│       ├── api.test.ts
│       └── websocket.test.ts
│
└── integration/
    ├── pages/
    │   ├── DiscoveryPage.test.tsx
    │   └── PodcastDetailPage.test.tsx
    │
    └── flows/
        ├── create-podcast-flow.test.tsx
        └── discover-and-play.test.tsx
```

---

## What to Do Right Now

### ✅ Phase 1: Read (30 minutes)
1. [ ] Read `WEEK_3_KICKOFF.md`
2. [ ] Skim `WEEK_3_FRONTEND_LAUNCH.md` (overview only)
3. [ ] Bookmark `WEEK_3_QUICK_REFERENCE.md`

### ⏳ Phase 2: Setup (1-2 hours)
1. [ ] Open terminal in `frontend/` directory
2. [ ] Follow `WEEK_3_DAY1_CHECKLIST.md` exactly
3. [ ] Verify: `npx tsc --noEmit` (zero errors)
4. [ ] Commit: `git commit -m "Week 3 Day 1: ..."`

### 🚀 Phase 3: Start Building (Tomorrow)
1. [ ] Read Days 2-3 section of `WEEK_3_FRONTEND_LAUNCH.md`
2. [ ] Start with CreatePodcastForm component
3. [ ] Write tests for form
4. [ ] Commit daily

---

## Success Looks Like This

### By End of Day 1 (Today)
✅ Backend health check responds  
✅ All dependencies installed  
✅ TypeScript compilation passes  
✅ Services can be imported  
✅ Work committed to git  

### By End of Day 2
✅ 2 form components created  
✅ Form validation works  
✅ 10+ tests passing  
✅ Can create podcasts and rooms via forms  

### By End of Day 5
✅ 11 components + 2 pages built  
✅ 30+ tests passing (80%+ coverage)  
✅ Full discovery experience works  
✅ Real-time WebSocket events working  
✅ Audio playback functional  

---

## Common Questions

**Q: What if the backend isn't running?**  
A: Start it first: `cd backend && npm run dev`

**Q: Can I skip the tests?**  
A: No. Tests are part of the definition of "done." Target 30+ tests this week.

**Q: What if I get TypeScript errors?**  
A: Never use `any`. Add proper types. See `WEEK_3_QUICK_REFERENCE.md` for patterns.

**Q: How do I know what component to build tomorrow?**  
A: Follow `WEEK_3_FRONTEND_LAUNCH.md` day by day. Don't skip ahead.

**Q: Can I modify the API client?**  
A: Only if backend APIs change. Otherwise, use it as-is.

**Q: What if I finish early?**  
A: Improve test coverage, add error states, optimize performance, or improve UI.

---

## Reference Documents

Keep these open in your editor:

1. **`WEEK_3_QUICK_REFERENCE.md`** — Copy-paste templates and patterns
2. **`API_REFERENCE.md`** — API endpoint specifications
3. **`AGENTS.md`** — Code standards and naming conventions

---

## You're Ready 🎯

You have:
✅ Backend running with all endpoints  
✅ Services created (ApiClient, WebSocket)  
✅ Types defined  
✅ Complete documentation  
✅ Day-by-day checklist  

**Now:** Follow `WEEK_3_DAY1_CHECKLIST.md` and start building.

---

**Generated:** February 20, 2026  
**Week:** 3 of 10  
**Phase:** MVP Frontend Integration  
**Status:** 🟢 Ready to Start  

**Let's ship this! 🚀**
