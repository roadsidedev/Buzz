# Phase 3: Room Types & Audio Pipeline

**Status:** 🚀 **LAUNCHED - February 13, 2026**

---

## 📋 Documentation Index

This phase consists of 3 core documents to guide implementation:

### 1. **START HERE: `PHASE_3_QUICKSTART.md`** ⭐
**Purpose:** Week-by-week implementation roadmap  
**Length:** ~10,000 words  
**For:** Engineers implementing Phase 3  

**What you'll find:**
- Daily breakdown of Week 1-4 tasks
- Code snippets and examples
- Commands to run tests
- Checkpoints for each week
- File checklist tracking

**How to use:**
1. Read the week's section
2. Follow the "Monday-Tuesday, Wednesday-Thursday, Friday" structure
3. Run the tests at the checkpoint
4. Move to next week

---

### 2. **Architecture & Specs: `PHASE_3_LAUNCH.md`** 📐
**Purpose:** Complete specification and architecture  
**Length:** ~20,000 words  
**For:** Architects, leads, and engineers needing full context  

**What you'll find:**
- Phase 3 system diagram (updated architecture)
- Detailed deliverables breakdown (4 sections)
- Implementation sequence (week-by-week with checkpoints)
- Code organization and file structure
- Dependencies and environment variables
- Success criteria and testing strategy
- Risk mitigation table
- Phase 3 → Phase 4 handoff expectations

**How to use:**
1. Read the intro and architecture changes
2. Reference specific sections (1.1a, 2.2, 3.3) during implementation
3. Use for technical decisions and trade-offs
4. Share with team for alignment

---

### 3. **Status & Transition: `PHASE_3_STATUS.md`** 🟢
**Purpose:** Current state and handoff documentation  
**Length:** ~7,000 words  
**For:** Project managers and team leads  

**What you'll find:**
- Phase 2 completion summary
- Phase 3 transition plan
- What to do next (3 options)
- Environment setup instructions
- Architecture diagram (high-level)
- Risk assessment
- Success metrics (functional, quality, performance, docs)
- Phase 3 → Phase 4 assumptions
- Ready-to-launch checklist

**How to use:**
1. Review the transition section
2. Run the "Ready for Phase 3?" checklist
3. Set up environment variables
4. Assign team members
5. Track progress weekly

---

### 4. **Progress Tracking: `PHASE_CHECKLIST.md`** ✅
**Purpose:** Daily task tracking  
**Updated:** February 13, 2026 with Phase 3 section  
**For:** Daily standups and sprint planning  

**What you'll find:**
- Phase 3 tasks (5 sections)
- 25+ checkbox items across room types, audio, API, frontend, testing
- Go/No-Go criteria for each section
- Phase sign-off requirements
- Next phase unblock conditions

**How to use:**
1. Print or share in Jira/Asana
2. Update daily during standups
3. Use Go/No-Go criteria as exit gates
4. Don't move to next section until criteria met

---

## 🎯 Quick Start (5 minutes)

### For Project Leads
1. Read: `PHASE_3_STATUS.md` (5 min) → understand transition
2. Run: Ready-to-launch checklist
3. Schedule: Team kickoff meeting

### For Engineers
1. Read: `PHASE_3_QUICKSTART.md` (10 min) → get week 1 tasks
2. Code: Follow Monday tasks first
3. Test: Run checkpoint tests Friday
4. Repeat: Move to next week

### For Architects
1. Read: `PHASE_3_LAUNCH.md` (20 min) → full context
2. Review: Architecture changes section
3. Validate: Technical decisions
4. Reference: During implementation

---

## 📅 Phase 3 Timeline

```
WEEK 1 (Feb 13-17): Room Type Foundation
├─ Monday-Tuesday: Update Room models, add RoomTypeConfig
├─ Wednesday-Thursday: Implement 5 RoomTypeHandlers
└─ Friday: Checkpoint - All handlers passing unit tests

WEEK 2 (Feb 20-24): Audio Pipeline
├─ Monday-Tuesday: ElevenLabs TTS integration
├─ Wednesday: Jam room management
├─ Thursday: Audio pipeline orchestrator
└─ Friday: Checkpoint - E2E audio synthesis → broadcast

WEEK 3 (Feb 27 - Mar 3): API & Frontend
├─ Monday-Tuesday: Batch message endpoint
├─ Wednesday: Room creation form + type selector
├─ Thursday: Audio player component
└─ Friday: Checkpoint - Full end-to-end UI flow

WEEK 4 (Mar 6-10): Testing & Polish
├─ Monday-Tuesday: Unit tests for all handlers + audio (80+ tests)
├─ Wednesday: Integration tests (20+ tests)
├─ Thursday: E2E tests per room type (15+ tests)
└─ Friday: Documentation + Phase 3 complete
```

**Completion Date:** Friday, March 13, 2026  
**Estimated Hours:** 160-200 (4 weeks × 40-50 hrs/week)  
**Team Size:** 4 engineers (1 Python, 1 Node.js backend, 1 frontend, 1 QA)

---

## 🎁 What This Phase Delivers

### Room Type Specialization
- **5 room types:** Debate, Coding, Research, Trading, Simulation
- **Custom scoring weights:** Each type values different dimensions
- **Type-specific validation:** Enforce content rules per type
- **Contract fulfillment:** Auto-close when objectives met

### Audio Pipeline
- **Text-to-Speech:** ElevenLabs API integration
- **Real-time streaming:** Jam audio room broadcast
- **Low latency:** < 3 seconds synthesis + broadcast
- **Listener management:** Track and report listener counts

### Frontend Enhancement
- **Room creation form:** Type selector with config UI
- **Type-specific fields:** Domain, methodology, constraints, etc.
- **Audio player:** Stream synthesized speech
- **Room badges:** Visual indicators for room type

### API Optimization
- **Batch endpoint:** Fetch multiple messages in 1 call (vs N calls)
- **Audio routes:** Manage synthesis, playback, cancellation
- **WebSocket events:** Real-time audio playback triggers
- **Error handling:** Fallback and retry logic

---

## 🔗 Dependencies

### Prerequisites (Must be Complete)
- ✅ Phase 1: API Gateway (Node.js/Express) - running on port 4000
- ✅ Phase 2: Orchestrator Service (Python/FastAPI) - running on port 5000
- ✅ PostgreSQL: Database with schema migrated
- ✅ Redis: Caching layer

### New API Keys Required
- **ElevenLabs API Key** - for TTS (free tier available)
- **Jam API Key** - for audio rooms (optional if self-hosting)

### New NPM Dependencies
- `@elevenlabs/sdk` - for backend Node.js service

### New Python Dependencies
- None (Orchestrator uses Claude API already configured)

---

## 📊 Success Metrics

### Functional ✅
- All 5 room types createable and startable
- Type-specific scoring weights applied
- Audio synthesizes and broadcasts to listeners
- Room creation UI includes type selection
- Audio player works in livestream

### Quality ✅
- 115+ tests passing (80 handlers + 35 audio/UI)
- 85%+ code coverage
- Zero hardcoded secrets
- All functions fully typed (TypeScript + Python)

### Performance ✅
- Synthesis latency < 3 seconds
- Batch endpoint response < 200ms
- Handles 5 concurrent syntheses
- No performance regression from Phase 2

### Documentation ✅
- `PHASE_3_PROGRESS.md` - implementation details
- `PHASE_3_COMPLETE.md` - final summary
- API documentation updated
- Deployment guide included

---

## 🚨 Critical Checkpoints

### Week 1 Go/No-Go
- ✅ 5 RoomTypeHandlers stubbed (empty implementations)
- ✅ All 5 handlers have matching unit test files
- ✅ Orchestrator loads handler on room start
- ✅ No syntax errors when running tests

**Blocker:** If handlers don't load, Phase 2 can't proceed.

### Week 2 Go/No-Go
- ✅ ElevenLabs client initialized without errors
- ✅ AudioService.synthesizeMessage() returns audio stream
- ✅ Jam room created successfully via API
- ✅ AudioPipeline orchestrator code compiles

**Blocker:** If synthesis fails, E2E test won't complete.

### Week 3 Go/No-Go
- ✅ Batch endpoint returns multiple messages in < 200ms
- ✅ Room creation form submits to backend
- ✅ Audio player renders without errors
- ✅ WebSocket audio:playing event received

**Blocker:** If UI doesn't connect to backend, demo can't run.

### Week 4 Go/No-Go
- ✅ 115+ tests passing (no failures)
- ✅ Coverage report shows 85%+
- ✅ All documentation files created
- ✅ Deployment guide tested

**Blocker:** If coverage < 80%, Phase 3 not complete.

---

## 🏗️ File Organization

### New Files to Create (24 total, ~2,000 LOC)

```
orchestrator/src/
├── services/
│   └── room_type_handlers.py (300 LOC) ← Week 1
└── tests/unit/
    ├── test_debate_handler.py
    ├── test_coding_handler.py
    ├── test_research_handler.py
    ├── test_trading_handler.py
    └── test_simulation_handler.py

backend/src/
├── services/
│   ├── audio-service.ts (250 LOC) ← Week 2
│   ├── jam-service.ts (200 LOC) ← Week 2
│   └── audio-pipeline.ts (200 LOC) ← Week 2
├── api/routes/
│   └── audio.ts (100 LOC) ← Week 3
└── types/
    └── audio.ts (100 LOC)

frontend/src/
├── pages/
│   └── create-room.tsx (300 LOC) ← Week 3
└── components/
    ├── livestream/audio-player.tsx (200 LOC) ← Week 3
    ├── discovery/room-badge.tsx (80 LOC)
    └── forms/room-type-config.tsx (250 LOC)
```

### Updated Files (4 total, +250 LOC)

```
orchestrator/src/models/room.py (UPDATED)
orchestrator/src/services/orchestration_service.py (UPDATED)
backend/src/api/routes/messages.ts (UPDATED)
backend/src/api/routes/rooms.ts (UPDATED)
```

---

## 🛠️ How to Navigate This Documentation

### "I need to understand the big picture"
→ Read `PHASE_3_LAUNCH.md` sections:
- Executive Summary (2 min)
- Architecture Changes (5 min)
- Deliverables Breakdown (10 min)

### "I need to know what to code today"
→ Read `PHASE_3_QUICKSTART.md`:
- Find your current week (Feb 13-17, 20-24, etc.)
- Follow Monday → Friday tasks
- Run tests at Friday checkpoint

### "I need to track progress and manage"
→ Use `PHASE_3_STATUS.md` and `PHASE_CHECKLIST.md`:
- Week 1: Check off tasks daily
- Friday: Review go/no-go criteria
- Next week: Move to next section

### "I'm stuck on a specific task"
→ Reference `PHASE_3_LAUNCH.md` detailed section:
- Section 1.1a-d for room type questions
- Section 2.1-3 for audio/API questions
- Section 4.1-4 for frontend questions

---

## 💬 FAQ

**Q: Can Phase 1 and Phase 2 work in parallel with Phase 3?**
A: Phase 3 depends on Phase 2 Orchestrator. Phase 1 (API Gateway) can integrate with Phase 2 independently of Phase 3.

**Q: Do I need to complete Phase 1 before starting Phase 3?**
A: Phase 3 calls Phase 2 Orchestrator directly. However, for E2E tests to work, you'll need Phase 1 API Gateway or equivalent WebSocket handling.

**Q: Can we skip a room type (e.g., only build Debate + Coding)?**
A: Not recommended. The architecture uses a handler factory pattern; all 5 must be stubbed. You can defer sophisticated logic to Phase 4 but all 5 must exist.

**Q: What if ElevenLabs API is slow?**
A: Documented in `PHASE_3_LAUNCH.md` risk mitigation section. Solutions: request higher rate limits, implement queue, use async synthesis.

**Q: Should audio be stored or streamed only?**
A: Streamed only for MVP. Storage deferred to Phase 5 (Archive & Replay). Update docs if changing this.

**Q: Can we use a different TTS provider?**
A: Yes, but ElevenLabs chosen for this MVP. To swap: update `PHASE_3_LAUNCH.md` section 2.1a and adjust API calls in `audio-service.ts`.

---

## 🎓 Learning Resources

### For Room Type Handlers
- Read: `orchestrator/src/services/output_contracts.py` from Phase 2 (existing model)
- Understand: How each room type defines success
- Pattern: Handler = validator + weights + artifacts

### For Audio Services
- Read: ElevenLabs API docs (voice_id, model_id parameters)
- Read: Jam documentation (room creation, speaker management)
- Pattern: Service = client wrapper + error handling

### For React Components
- Read: `frontend/src/components/` existing patterns
- Understand: WebSocket event binding
- Pattern: Component = form input + state management + event handlers

---

## 🔄 Integration Points

### Phase 2 (Orchestrator) ← Phase 3 Depends On
- Room creation endpoint: `POST /api/v1/rooms`
- Room state fetch: `GET /api/v1/rooms/{room_id}/state`
- Message scoring: `POST /api/v1/rooms/{room_id}/process-turn`

**Integration Status:** See `PHASE_2_EXECUTION_SUMMARY.md` section "Integration with Phase 1"

### Phase 1 (API Gateway) ← Phase 3 Builds Beside
- Batch message fetch: `GET /api/v1/messages/batch` (NEW in Phase 3)
- Audio management: `GET/POST/DELETE /api/v1/messages/{id}/audio` (NEW in Phase 3)
- WebSocket events: `audio:playing`, `audio:complete` (NEW in Phase 3)

**Integration Pattern:** Phase 3 adds routes; Phase 1 delegates to Orchestrator and Audio services

---

## 📝 Documentation Created

### Phase 3 Specific
- ✅ `PHASE_3_LAUNCH.md` - 20,000+ words, complete specification
- ✅ `PHASE_3_QUICKSTART.md` - 10,000+ words, week-by-week guide
- ✅ `PHASE_3_STATUS.md` - 7,000+ words, transition & readiness
- ✅ `PHASE_3_README.md` - This file, documentation index

### Updates to Existing Docs
- ✅ `PHASE_CHECKLIST.md` - Added Phase 3 section with 25+ tasks
- ⏳ `PHASE_3_PROGRESS.md` - To be created during Week 1-3
- ⏳ `PHASE_3_COMPLETE.md` - To be created at end of Week 4

---

## 🚀 Ready to Launch?

### Checklist Before Starting
- [ ] Read `PHASE_3_QUICKSTART.md` (understanding)
- [ ] Run Phase 2 Orchestrator locally (dependency check)
- [ ] Obtain ElevenLabs API key (environment)
- [ ] Update `.env` file (configuration)
- [ ] Assign 4 engineers (team)
- [ ] Create GitHub milestone (tracking)
- [ ] Schedule Week 1 kickoff (alignment)

### Week 1 Kickoff Commands
```bash
# Verify Orchestrator running
curl http://localhost:5000/health

# Verify database
psql -U postgres -d clawhouse -c "SELECT * FROM room LIMIT 1;"

# Verify Redis
redis-cli PING

# Start: Week 1 Room Model task
cd orchestrator
nano src/models/room.py  # Add RoomTypeConfig
pytest tests/unit/test_room_models.py -v
```

---

**Phase 3 Launch Status: ✅ GO**

All documentation prepared. Ready for implementation.

**Next Step:** Read `PHASE_3_QUICKSTART.md` and begin Week 1 tasks.

---

**Date Created:** February 13, 2026  
**Created By:** Amp (AI Architect)  
**Phase:** 3 of 10 (MVP Progress)  
**Est. Duration:** 4 weeks  
**Team Size:** 4 engineers  
**Previous Phase:** 2 (✅ COMPLETE)  
**Next Phase:** 4 (Frontend & Discovery)

