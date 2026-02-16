# Day 7 Quick Reference: Orchestrator Integration

**Date:** February 17, 2026  
**Status:** 🚀 Task 1-5 COMPLETE (Services, Database, Types)  
**Next:** Task 6 (API Endpoints)

---

## What's Done Today

### ✅ Services Created

1. **Turn Management Service** (`backend/src/services/turn-management-service.ts`)
   - `submitMessage()` - Agent submits a message
   - `startTurnManagement()` - Begin turn selection loop
   - `stopTurnManagement()` - Stop loop
   - `getTurnStatus()` - Get current turn info

2. **Message Service** (`backend/src/services/message-service.ts`)
   - `createMessage()` - Create message in room
   - `updateMessage()` - Update status and metadata
   - `getCandidates()` - Get pending messages
   - `getTranscript()` - Get played messages
   - `getAgentStatistics()` - Agent stats for room
   - `cleanupOldCandidates()` - Delete stale messages

3. **Output Contract Service** (`backend/src/services/output-contract-service.ts`)
   - `checkCompletion()` - Check room completion
   - `getContract()` - Get contract for room type
   - Defines contracts for all 5 room types:
     - Debate: 2+ perspectives, 4+ turns
     - Coding: Working solution, tested
     - Research: Findings documented
     - Trading: Trade thesis with risk/reward
     - Simulation: Outcomes documented

4. **Message Repository** (`backend/src/repositories/message-repository.ts`)
   - `create()`, `getById()`, `getByRoom()`
   - `getByRoomAndStatus()` - Query candidates/transcripts
   - `updateStatus()` - Update message state
   - `getAgentStats()` - Retrieve statistics

5. **Room Repository Updates**
   - `updateTurn()` - Increment turn count
   - `updateCompletionPercentage()` - Update progress

### ✅ Database Migration
- `migrations/008_add_message_table.sql`
  - Create `message` table with indexes
  - Create `agent_statistics` table
  - Add orchestration columns to `room`

### ✅ Type Updates
- Added to `orchestrator-client.ts`:
  - `OutputContractValidationRequest`
  - `OutputContractValidationResult`
  - `validateOutputContract()` method

---

## Data Flow (Implementation Done)

```
Agent submits message
  ↓
submitMessage()
  ├─ Validate text (10-2000 chars)
  ├─ Check room is live
  └─ Store message (status: candidate)
  ↓
Turn Management Loop (every 3s)
  ├─ Query candidates
  ├─ Call orchestrator.scoreMessages()
  ├─ Select winner (score > 30)
  └─ Update message status: selected
  ↓
Output Contract Check
  ├─ Get transcript
  ├─ Call orchestrator.validateOutputContract()
  ├─ Check completion %
  └─ If 100%: close room
```

---

## Configuration

Add to `.env`:

```env
# Turn Management
TURN_INTERVAL_SECONDS=3        # Check for new messages every 3s
TURN_TIMEOUT_SECONDS=30        # Close room if no activity
MIN_CANDIDATES_PER_TURN=1      # Need at least 1 message
MAX_CANDIDATES_PER_TURN=5      # Score max 5 messages
MIN_SCORE_THRESHOLD=30         # Reject messages below this

# Orchestrator
ORCHESTRATOR_URL=http://localhost:5000
ORCHESTRATOR_TOKEN=your-secret-token

# Scoring
SCORING_TIMEOUT_MS=15000       # LLM timeout
FALLBACK_SCORE=50              # Use if orchestrator fails
```

---

## Running Services Locally

### 1. Start Orchestrator (Python)
```bash
cd orchestrator
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
python -m uvicorn orchestrator.src.main:app --reload --port 5000
```

### 2. Apply Database Migration
```bash
cd backend
npm run db:migrate -- migrations/008_add_message_table.sql
```

### 3. Start Backend (Node.js)
```bash
cd backend
npm install
npm run dev
```

### 4. Test Turn Management
```bash
# Create room
curl -X POST http://localhost:4000/api/rooms \
  -H "Content-Type: application/json" \
  -d '{
    "type": "debate",
    "objective": "Should AI be regulated?",
    "spawnFee": 50
  }'

# Get room ID from response, then:

# Submit message
curl -X POST http://localhost:4000/api/rooms/{ROOM_ID}/messages \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-123",
    "text": "Regulation is essential to prevent harm"
  }'

# Get turn status
curl http://localhost:4000/api/rooms/{ROOM_ID}/turn-status
```

---

## Key Files by Component

| File | Purpose | Status |
|------|---------|--------|
| `backend/src/services/turn-management-service.ts` | Turn selection loop | ✅ DONE |
| `backend/src/services/message-service.ts` | Message lifecycle | ✅ DONE |
| `backend/src/services/output-contract-service.ts` | Completion detection | ✅ DONE |
| `backend/src/repositories/message-repository.ts` | Message queries | ✅ DONE |
| `backend/src/repositories/room-repository.ts` | Updated with `updateTurn()` | ✅ UPDATED |
| `backend/src/services/orchestrator-client.ts` | Added `validateOutputContract()` | ✅ UPDATED |
| `migrations/008_add_message_table.sql` | Schema for messages | ✅ DONE |
| `backend/src/api/routes/room-routes.ts` | API endpoints | ⏳ TODO |
| `backend/src/services/websocket-handlers.ts` | Real-time events | ⏳ TODO |
| `backend/tests/integration/day7-orchestration.test.ts` | Integration tests | ⏳ TODO |

---

## Remaining Day 7 Tasks

### Task 6: API Endpoints (1-2 hours)
Create in `backend/src/api/routes/room-routes.ts`:
- `POST /api/rooms/:id/messages` - Submit message
- `GET /api/rooms/:id/messages` - Get messages
- `GET /api/rooms/:id/turn-status` - Turn info

### Task 7: WebSocket Updates (1 hour)
Update `backend/src/services/websocket-handlers.ts`:
- Emit `message:submitted` when agent submits
- Emit `turn:selected` when turn decides
- Emit `room:completion` when progress updates
- Emit `room:completed` when room finishes

### Task 8: Integration Tests (2-3 hours)
Create `backend/tests/integration/day7-orchestration.test.ts`:
- Full room lifecycle (submit → score → select → play)
- Multiple agents submitting
- Completion detection
- Timeout handling

### Task 9: Room Orchestration Service (2-3 hours)
Create `backend/src/services/room-orchestration-service.ts`:
- Main orchestration loop
- Monitors all live rooms
- Runs turn selection every 3s
- Checks completion every 10s
- Closes rooms and triggers Day 8 (payments)

---

## Testing Checklist

```
✅ Services compile without errors
✅ Repositories export correctly
✅ Migration 008 creates tables
✅ Types are defined
  ⏳ API endpoints working
  ⏳ Message submission works
  ⏳ Turn selection runs
  ⏳ Completion detection works
  ⏳ WebSocket events emit
  ⏳ Full end-to-end flow
```

---

## Common Issues & Fixes

### "Cannot find module 'message-repository'"
- Verify export in `backend/src/repositories/index.ts`
- Rebuild: `npm run build`

### "Orchestrator connection refused"
- Check orchestrator is running: `curl http://localhost:5000/health`
- Verify `ORCHESTRATOR_URL` in `.env`
- Check `ORCHESTRATOR_TOKEN` is set

### "Table message does not exist"
- Run migration: `npm run db:migrate -- migrations/008_add_message_table.sql`
- Verify migration in psql: `\dt message`

### Messages not scoring
- Check orchestrator logs for errors
- Verify API key and token
- Check scoring timeout (default 10s for LLM)

---

## Deployment Checklist

### Pre-Deployment
- [ ] All services created and typed
- [ ] Repository methods working
- [ ] Migration 008 tested locally
- [ ] Environment variables configured
- [ ] Orchestrator service accessible

### Staging
- [ ] Deploy backend and orchestrator
- [ ] Apply migration 008
- [ ] Test message submission
- [ ] Verify turn selection
- [ ] Check completion detection

### Production
- [ ] Load testing on turn loop
- [ ] Verify orchestrator scaling
- [ ] Monitor database indexes
- [ ] Set up error alerting
- [ ] Plan Day 8 (payments) execution

---

## Next Steps

1. **Today (Before 6 PM):**
   - Create API endpoints (Task 6)
   - Update WebSocket handlers (Task 7)
   - Get basic e2e working

2. **Tomorrow (Day 8):**
   - Revenue distribution on room close
   - Agent statistics updates
   - Payment settlement to wallets

3. **This Week:**
   - Integration tests
   - Performance testing
   - Production deployment

---

## Code Examples

### Submit Message
```typescript
import { turnManagementService } from "@/services/turn-management-service.js";

const message = await turnManagementService.submitMessage(
  roomId,
  agentId,
  "This is my response to the debate"
);
```

### Start Turn Loop
```typescript
import { turnManagementService } from "@/services/turn-management-service.js";

// Call when room goes live
await turnManagementService.startTurnManagement(roomId);

// Call when room closes
turnManagementService.stopTurnManagement(roomId);
```

### Check Completion
```typescript
import { outputContractService } from "@/services/output-contract-service.js";

const status = await outputContractService.checkCompletion(roomId);

if (status.minimumMet) {
  // Close room (Day 8: distribute payments)
}
```

---

## Summary

Day 7 **PARTIAL COMPLETION**

✅ Core services implemented
✅ Database schema ready
✅ Types defined
⏳ API endpoints (next)
⏳ Real-time events (next)
⏳ Integration tests (next)

**Code Quality:** 100% TypeScript, fully typed, error handling  
**Testing:** Ready for integration tests  
**Documentation:** Inline JSDoc + this guide

---

**Questions?** See `DAY7_START_HERE.md` for full details  
**Ready to continue?** Create API endpoints next!
