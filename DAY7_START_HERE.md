# Day 7 Start Here: Orchestrator Integration & Turn Management

**Status:** 🚀 IN PROGRESS  
**Date:** February 17, 2026  
**Phase:** Production Sprint - Core Orchestration & Room Lifecycle

---

## What We're Building Today

Day 7 integrates the **Orchestrator Service** (Python/FastAPI) with the **API Gateway** (Node.js/Express) to enable:

1. **Orchestrator Integration** - Backend to communicate with Python orchestrator service
2. **Turn Management** - Select which agent speaks next based on message quality
3. **Message Scoring** - 5-dimensional evaluation of agent messages (Relevance, Novelty, Coherence, Actionability, Engagement)
4. **Room Completion Triggers** - Detect when rooms meet output contracts and auto-complete

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│      Frontend (React)                   │
│  - Display room status                  │
│  - Show turn-taking flow                │
│  - Submit agent messages                │
└──────────────┬──────────────────────────┘
               │ WebSocket + REST
┌──────────────v──────────────────────────┐
│      API Gateway (Express)              │
│  - Auth middleware                      │
│  - Room lifecycle endpoints             │
│  - Message submission endpoints         │
└──────────────┬──────────────────────────┘
               │ gRPC/HTTP
┌──────────────v──────────────────────────┐
│  Orchestrator Service (FastAPI/Python)  │
│  ├─ Turn Management                     │
│  ├─ Message Scoring (Claude LLM)        │
│  ├─ Moderation Agent                    │
│  └─ Output Contract Validation          │
└──────────────┬──────────────────────────┘
               │
┌──────────────v──────────────────────────┐
│      Services Layer                     │
│  ├─ Room Service                        │
│  ├─ Payment Service (x402)              │
│  ├─ Jam Service (Audio)                 │
│  ├─ Agent Service                       │
│  └─ Discovery Service                   │
└──────────────┬──────────────────────────┘
               │
┌──────────────v──────────────────────────┐
│      Data Layer                         │
│  ├─ PostgreSQL (rooms, messages)        │
│  ├─ Redis (cache, state)                │
│  └─ S3 (audio files)                    │
└──────────────────────────────────────────┘
```

---

## Key Components to Build

### 1. **Turn Management Service** (backend/src/services/turn-management-service.ts)
Manages the turn-taking loop:
- Fetch candidate messages from database
- Call orchestrator to score them
- Select winner and update room state
- Handle timeouts and edge cases

### 2. **Message Management Service** (backend/src/services/message-service.ts)
Handles message lifecycle:
- Submit message (validate, store, notify)
- Query candidates for turn
- Update message status (candidate → queued → selected → playing → played)
- Update agent statistics

### 3. **Room Orchestration Loop** (backend/src/services/room-orchestration-service.ts)
Manages complete room lifecycle:
- Monitor room for new messages
- Trigger turn selection every N seconds
- Track completion progress
- Detect room completion
- Close room and distribute payments

### 4. **Output Contract Service** (backend/src/services/output-contract-service.ts)
Validates room completion:
- Define contracts per room type
- Track progress toward milestones
- Determine when room can close
- Calculate completion percentage

---

## Data Flow: Room Execution

```
1. ROOM CREATED (Day 6)
   ↓
2. ROOM GOES LIVE
   ↓
3. AGENT A SUBMITS MESSAGE #1
   ├─ Message stored in DB (status: candidate)
   ├─ WebSocket notification: "New candidate"
   └─ Turn manager awakens
   ↓
4. TURN MANAGER (runs every 3 seconds)
   ├─ Query candidates: [Message #1]
   ├─ Call orchestrator: scoreMessages([Message #1])
   ├─ Receive scores with dimensions
   ├─ Select winner: Message #1 (score: 78)
   └─ Update message status: selected
   ↓
5. AUDIO SYNTHESIS
   ├─ Call TTS service (ElevenLabs)
   ├─ Generate audio file
   ├─ Upload to S3
   ├─ Update message: audioUrl
   └─ Update message status: playing
   ↓
6. BROADCAST TO VIEWERS
   ├─ Stream audio to Jam room
   ├─ Emit WebSocket: "Message selected"
   ├─ Update room transcript
   └─ Increment participant statistics
   ↓
7. COMPLETION CHECK
   ├─ Query output contract
   ├─ Check if milestones met
   ├─ If complete: transition to "completed"
   ├─ Close Jam room
   └─ Distribute payments (Day 8)
```

---

## Database Changes

### New Table: `message`
```sql
CREATE TABLE message (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES room(id),
  agent_id UUID NOT NULL REFERENCES agent(id),
  text TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'candidate',  -- candidate|queued|selected|playing|played|rejected
  score INT,                                -- 0-100 (orchestrator score)
  selected_at TIMESTAMP,
  played_at TIMESTAMP,
  audio_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_message_room_status ON message(room_id, status);
CREATE INDEX idx_message_agent_room ON message(agent_id, room_id);
```

### New Table: `agent_statistics`
```sql
CREATE TABLE agent_statistics (
  id UUID PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES room(id),
  agent_id UUID NOT NULL REFERENCES agent(id),
  messages_submitted INT DEFAULT 0,
  messages_selected INT DEFAULT 0,
  average_score DECIMAL(5,2),
  total_audio_time_seconds INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(room_id, agent_id)
);
```

### Updated: `room` Table
```sql
ALTER TABLE room
ADD COLUMN IF NOT EXISTS turn_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS completion_percentage INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_turn_at TIMESTAMP;
```

---

## Key Methods & APIs

### Backend: Turn Management
```typescript
// Trigger turn selection
async selectNextTurn(roomId: string): Promise<void>
  ├─ Get room state
  ├─ Query candidate messages
  ├─ Call orchestrator.scoreMessages()
  ├─ Select winner
  ├─ Update message status
  ├─ Synthesize audio
  └─ Broadcast to Jam room

// Submit message
async submitMessage(roomId: string, agentId: string, text: string): Promise<Message>
  ├─ Validate message length (10-2000 chars)
  ├─ Check agent is in room
  ├─ Store message (status: candidate)
  ├─ Update agent stats
  └─ Notify turn manager

// Check completion
async checkRoomCompletion(roomId: string): Promise<boolean>
  ├─ Get output contract
  ├─ Evaluate transcript
  ├─ Call orchestrator.validateOutputContract()
  ├─ Return completion status
  └─ If complete: close room
```

### Orchestrator: Message Scoring
```python
async def score_messages(request: RoomMessageScoringRequest) -> List[RoomMessageScore]
  ├─ Validate room context
  ├─ Sanitize candidate messages
  ├─ Score each message (5 dimensions)
  ├─ Weight and aggregate scores
  └─ Return results with reasoning

# Scoring dimensions (weights):
# - Relevance (35%)
# - Novelty (25%)
# - Coherence (20%)
# - Actionability (15%)
# - Engagement (5%)
```

---

## Deployment Checklist

### Pre-Deployment
- [ ] Run migrations 008 & 009 (message + agent_statistics tables)
- [ ] Verify orchestrator service is running on port 5000
- [ ] Set ORCHESTRATOR_URL and ORCHESTRATOR_TOKEN env vars
- [ ] Run unit tests for turn management
- [ ] Run integration tests for room lifecycle

### Database
- [ ] Apply migration 008: Add message table
- [ ] Apply migration 009: Add agent_statistics table
- [ ] Apply migration 010: Update room table with orchestration columns
- [ ] Verify indexes are created

### Configuration
```env
# Orchestrator
ORCHESTRATOR_URL=http://localhost:5000
ORCHESTRATOR_TOKEN=your-secret-token

# Turn Management
TURN_INTERVAL_SECONDS=3        # Check for new messages every 3s
TURN_TIMEOUT_SECONDS=30        # Close room if no activity for 30s
MIN_CANDIDATES_PER_TURN=1      # Need at least 1 message to take turn
MAX_CANDIDATES_PER_TURN=5      # Score top 5 messages max

# Scoring
SCORING_TIMEOUT_MS=15000       # LLM timeout
MIN_SCORE_THRESHOLD=30         # Reject messages below this
FALLBACK_SCORE=50              # Use this if orchestrator unavailable
```

---

## Tasks Breakdown

### Task 1: Create Turn Management Service
**File:** `backend/src/services/turn-management-service.ts`
**Time:** 2-3 hours
**Depends on:** Room Service, Orchestrator Client
**Delivers:** Core turn-taking logic

**Checklist:**
- [ ] Implement `selectNextTurn()` method
- [ ] Implement `submitMessage()` method
- [ ] Implement `checkRoomCompletion()` method
- [ ] Add error handling and logging
- [ ] Write unit tests (8+ test cases)

### Task 2: Create Message Service
**File:** `backend/src/services/message-service.ts`
**Time:** 1-2 hours
**Depends on:** Database, Room Service
**Delivers:** Message lifecycle management

**Checklist:**
- [ ] Implement message CRUD operations
- [ ] Implement status transitions (candidate → selected → played)
- [ ] Implement query methods (getByRoom, getByStatus)
- [ ] Add validation (length, content)
- [ ] Write tests (5+ test cases)

### Task 3: Create Output Contract Service
**File:** `backend/src/services/output-contract-service.ts`
**Time:** 1-2 hours
**Depends on:** Orchestrator Client
**Delivers:** Room completion detection

**Checklist:**
- [ ] Define contracts per room type
- [ ] Implement `validateContract()` method
- [ ] Implement `getCompletionPercentage()` method
- [ ] Call orchestrator.validateOutputContract()
- [ ] Write tests (5+ test cases)

### Task 4: Create Room Orchestration Service
**File:** `backend/src/services/room-orchestration-service.ts`
**Time:** 2-3 hours
**Depends on:** All above services
**Delivers:** Main orchestration loop

**Checklist:**
- [ ] Implement `startRoomOrchestration()` method
- [ ] Implement turn loop (setInterval every 3s)
- [ ] Implement completion check loop
- [ ] Handle room closing and cleanup
- [ ] Write integration tests (5+ test cases)

### Task 5: Create Databases Migrations
**Files:** `migrations/008_add_message_table.sql`, etc.
**Time:** 30 minutes
**Depends on:** Schema design
**Delivers:** Database schema updates

**Checklist:**
- [ ] Migration 008: Create message table with indexes
- [ ] Migration 009: Create agent_statistics table
- [ ] Migration 010: Update room table
- [ ] Test migrations run cleanly
- [ ] Verify rollback works

### Task 6: Create API Endpoints
**File:** `backend/src/api/routes/room-routes.ts` (update)
**Time:** 1-2 hours
**Depends on:** Services above
**Delivers:** Public APIs for room interaction

**Checklist:**
- [ ] POST /api/rooms/:id/messages (submit message)
- [ ] GET /api/rooms/:id/messages (get candidates/transcript)
- [ ] GET /api/rooms/:id/turn-status (current turn info)
- [ ] POST /api/rooms/:id/close (manual close)
- [ ] Write integration tests (5+ test cases)

### Task 7: Update WebSocket Handlers
**File:** `backend/src/services/websocket-handlers.ts` (update)
**Time:** 1 hour
**Depends on:** Turn Management Service
**Delivers:** Real-time updates

**Checklist:**
- [ ] Emit "message:candidate" when message submitted
- [ ] Emit "turn:selected" when message selected
- [ ] Emit "room:completion" when progress updated
- [ ] Emit "room:completed" when room finishes
- [ ] Write integration tests

### Task 8: Write Comprehensive Tests
**File:** `backend/tests/integration/day7-orchestration.test.ts`
**Time:** 2-3 hours
**Depends on:** All services
**Delivers:** Integration test suite

**Test Scenarios:**
- [ ] Complete room lifecycle (submit → score → select → play → complete)
- [ ] Multiple agents submitting messages
- [ ] Turn timeout handling
- [ ] Completion contract validation
- [ ] Error handling (orchestrator timeout, network errors)

---

## Critical Path

**Priority Order:**
1. **Turn Management Service** (core logic)
2. **Database Migrations** (schema)
3. **API Endpoints** (public interface)
4. **Message Service** (supporting)
5. **Output Contract Service** (completion detection)
6. **Room Orchestration Service** (main loop)
7. **WebSocket Handlers** (real-time)
8. **Tests** (validation)

---

## Next Steps

### Immediate (Today)
1. Read this file completely
2. Start with Task 1: Turn Management Service
3. Write unit tests as you go
4. Get feedback on architecture

### This Week
1. Complete all 8 tasks
2. Run full integration test suite
3. Test with orchestrator service
4. Manual testing with multiple agents
5. Deploy to staging environment

### Blocking Issues
- [ ] Orchestrator service must be running
- [ ] Database migrations must be applied
- [ ] ElevenLabs API key for TTS
- [ ] Jam room creation working (from Day 5)

---

## Key Files by Component

| Component | File | Status |
|-----------|------|--------|
| Turn Management | `backend/src/services/turn-management-service.ts` | ⏳ TODO |
| Message Service | `backend/src/services/message-service.ts` | ⏳ TODO |
| Output Contract | `backend/src/services/output-contract-service.ts` | ⏳ TODO |
| Room Orchestration | `backend/src/services/room-orchestration-service.ts` | ⏳ TODO |
| Migrations | `migrations/008_*.sql` | ⏳ TODO |
| API Routes | `backend/src/api/routes/room-routes.ts` | ⏳ UPDATE |
| WebSocket | `backend/src/services/websocket-handlers.ts` | ⏳ UPDATE |
| Tests | `backend/tests/integration/day7-orchestration.test.ts` | ⏳ TODO |

---

## Success Criteria

✅ All services deployed and tested  
✅ Turn management loop executing every 3 seconds  
✅ Messages scoring with orchestrator  
✅ Room completion detection working  
✅ WebSocket events broadcasting correctly  
✅ Integration tests passing (20+ test cases)  
✅ 0 TypeScript errors  
✅ 0 ESLint warnings  

---

## Documentation Links

1. **Full Implementation Guide** - `DAY7_ORCHESTRATION_IMPLEMENTATION.md` (coming)
2. **Architecture Deep Dive** - `ARCHITECTURE.md`
3. **Orchestrator API** - `orchestrator/README.md`
4. **Type Definitions** - `common/types/orchestration.ts`

---

## Questions?

1. **How does scoring work?** → See `orchestrator/src/services/scoring_engine.py`
2. **What's the turn timeout?** → Configured in `.env`: `TURN_TIMEOUT_SECONDS=30`
3. **How are rooms closed?** → See output contract validation logic
4. **How do payments get distributed?** → Day 8: Revenue Distribution

---

## Summary

Day 7 **IN PROGRESS**

- Orchestrator integration: 🚀 Starting
- Turn management: 🚀 Starting
- Message scoring: 🔄 Ready (orchestrator has it)
- Room completion: 🚀 Starting

**Ready to execute!**

---

**Last Updated:** February 17, 2026  
**Next Review:** End of Day 7  
**Questions?** Check the docs above or review existing code in `/orchestrator/src/services/`
