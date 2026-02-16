# Day 7 Task Checklist: Orchestrator Integration

**Date:** February 17, 2026  
**Phase:** Production Sprint - Core Orchestration  
**Completed:** Tasks 1-5 | **Remaining:** Tasks 6-9

---

## Task 1: Turn Management Service ✅

**Status:** COMPLETE  
**File:** `backend/src/services/turn-management-service.ts`  
**Time:** 2-3 hours  

**Deliverables:**
- [x] Create TurnManagementService class
- [x] Implement `startTurnManagement()` method
  - [x] Verify room exists and is live
  - [x] Set up interval timer (TURN_INTERVAL_SECONDS)
  - [x] Track active rooms in Map
  - [x] Logging on start
- [x] Implement `submitMessage()` method
  - [x] Validate text length (10-2000 chars)
  - [x] Verify room is live
  - [x] Verify agent in room
  - [x] Create message (status: candidate)
  - [x] Error handling
- [x] Implement `getTurnStatus()` method
  - [x] Calculate next turn time
  - [x] Count candidates
  - [x] Return status object
- [x] Implement `stopTurnManagement()` method
  - [x] Clear interval
  - [x] Remove from tracking
- [x] Implement `_runTurnLoop()` internal method
  - [x] Fetch candidates
  - [x] Call orchestrator.scoreMessages()
  - [x] Select winner
  - [x] Update message status
  - [x] Update room turn count
  - [x] Error handling with fallback
- [x] Implement `_scoreMessages()` internal method
  - [x] Build ScoringRequest
  - [x] Call orchestratorClient
  - [x] Return scores
- [x] Implement `_selectWinner()` internal method
  - [x] Sort by score descending
  - [x] Apply MIN_SCORE_THRESHOLD
  - [x] Return winner or null
- [x] Implement `_validateStatusTransition()` internal method
- [x] Add comprehensive error handling
- [x] Add structured logging
- [x] Export singleton instance
- [x] Full TypeScript types
- [x] JSDoc comments on all methods

**Quality Checks:**
- [x] No implicit any
- [x] All functions typed
- [x] Error handling complete
- [x] Logging at key points
- [x] Comments clear

---

## Task 2: Message Service ✅

**Status:** COMPLETE  
**File:** `backend/src/services/message-service.ts`  
**Time:** 1-2 hours

**Deliverables:**
- [x] Create MessageService class
- [x] Implement `createMessage()` method
  - [x] Validate text
  - [x] Create message object
  - [x] Store in database
  - [x] Logging
- [x] Implement `updateMessage()` method
  - [x] Status transition validation
  - [x] Update in database
  - [x] Handle metadata (score, audioUrl, etc.)
- [x] Implement `getCandidates()` method
  - [x] Query candidates by status
  - [x] Calculate wait times
  - [x] Return with metadata
- [x] Implement `getTranscript()` method
  - [x] Query played messages
  - [x] Sort by timestamp
  - [x] Return in order
- [x] Implement `getByRoom()` method
- [x] Implement `getMessage()` method
- [x] Implement `getAgentStatistics()` method
  - [x] Count submitted
  - [x] Count selected
  - [x] Calculate selection rate
  - [x] Average score
- [x] Implement `cleanupOldCandidates()` method
  - [x] Delete by age
  - [x] Return count
- [x] Implement `_validateStatusTransition()` internal
  - [x] Define state machine
  - [x] Validate transitions
- [x] Add error handling
- [x] Add logging
- [x] Export singleton

**Quality Checks:**
- [x] Types complete
- [x] No implicit any
- [x] Error handling
- [x] Logging present

---

## Task 3: Output Contract Service ✅

**Status:** COMPLETE  
**File:** `backend/src/services/output-contract-service.ts`  
**Time:** 1-2 hours

**Deliverables:**
- [x] Create OutputContractService class
- [x] Define CONTRACTS for 5 room types
  - [x] Debate contract
  - [x] Coding contract
  - [x] Research contract
  - [x] Trading contract
  - [x] Simulation contract
- [x] Implement `checkCompletion()` method
  - [x] Get room
  - [x] Build transcript
  - [x] Call orchestrator.validateOutputContract()
  - [x] Handle orchestrator errors
  - [x] Determine completion level
  - [x] Return status
- [x] Implement `getContract()` method
  - [x] Lookup contract
  - [x] Return spec
- [x] Implement `_basicValidation()` internal
  - [x] Calculate metrics
  - [x] Check thresholds
  - [x] Return completion status
- [x] Implement `_getFailedRequirements()` internal
  - [x] Identify failed items
  - [x] Return list
- [x] Implement `_getNextMilestone()` internal
  - [x] Calculate progress to next level
  - [x] Return description
- [x] Add error handling
- [x] Add logging
- [x] Export singleton

**Quality Checks:**
- [x] All contracts defined
- [x] Fallback validation works
- [x] Types complete
- [x] Error handling

---

## Task 4: Message Repository ✅

**Status:** COMPLETE  
**File:** `backend/src/repositories/message-repository.ts`  
**Time:** 1-2 hours

**Deliverables:**
- [x] Create MessageRepository class
- [x] Implement `create()` method
  - [x] SQL INSERT
  - [x] Parameterized query
  - [x] Type mapping
  - [x] Error handling
- [x] Implement `getById()` method
  - [x] SQL SELECT
  - [x] Type mapping
  - [x] Null handling
- [x] Implement `getByRoom()` method
  - [x] SQL SELECT with WHERE
  - [x] Order by created_at
  - [x] Return array
- [x] Implement `getByRoomAndStatus()` method
  - [x] SQL SELECT with multiple WHERE
  - [x] Order by created_at
  - [x] Return filtered array
- [x] Implement `getByRoomAndAgent()` method
  - [x] SQL SELECT for agent in room
  - [x] Order results
- [x] Implement `updateStatus()` method
  - [x] Dynamic UPDATE query
  - [x] Handle optional metadata
  - [x] Return updated message
- [x] Implement `delete()` method
  - [x] SQL DELETE
  - [x] Return success
- [x] Implement `countByRoomAndStatus()` method
  - [x] SQL COUNT
  - [x] Return count
- [x] Implement `getAverageScore()` method
  - [x] SQL AVG
  - [x] Filter nulls
  - [x] Return number
- [x] Implement `getAgentStats()` method
  - [x] SQL with COUNT and CASE
  - [x] Return stats object
- [x] Implement `_mapRowToMessage()` internal
  - [x] Map all fields
  - [x] Handle nulls
  - [x] Convert dates
- [x] Add proper error handling
- [x] Add logging
- [x] Export singleton

**Quality Checks:**
- [x] All SQL parameterized
- [x] Type mappings correct
- [x] Null handling safe
- [x] Error handling present

---

## Task 5: Database & Repository Updates ✅

**Status:** COMPLETE

**Part A: Message Repository Export**
- [x] Add to `backend/src/repositories/index.ts`
  - [x] Export MessageRepository class
  - [x] Export messageRepository singleton

**Part B: Room Repository Updates**
- [x] Update `backend/src/repositories/room-repository.ts`
  - [x] Add `updateTurn()` method
    - [x] Increment turn_count
    - [x] Update last_turn_at
    - [x] Return updated room
  - [x] Add `updateCompletionPercentage()` method
    - [x] Update completion_percentage
    - [x] Add logging

**Part C: Orchestrator Client Updates**
- [x] Update `backend/src/services/orchestrator-client.ts`
  - [x] Add OutputContractValidationRequest interface
  - [x] Add OutputContractValidationResult interface
  - [x] Add `validateOutputContract()` method
    - [x] Build request
    - [x] Call orchestrator API
    - [x] Handle timeouts
    - [x] Error handling
    - [x] Logging

**Part D: Database Migration**
- [x] Create `migrations/008_add_message_table.sql`
  - [x] Create `message` table
    - [x] UUID primary key
    - [x] Foreign keys to room and agent
    - [x] Status column (enum-like)
    - [x] Score column
    - [x] Audio URL column
    - [x] Timestamp columns
  - [x] Create indexes (4 indexes for message)
  - [x] Create `agent_statistics` table
    - [x] UUID primary key
    - [x] Foreign keys
    - [x] Statistics columns
    - [x] UNIQUE constraint on (room_id, agent_id)
  - [x] Create indexes (2 indexes for agent_statistics)
  - [x] ALTER room table
    - [x] Add turn_count
    - [x] Add started_at
    - [x] Add completion_percentage
    - [x] Add last_turn_at
  - [x] Create indexes on room
  - [x] Include CASCADE delete

**Quality Checks:**
- [x] Migration idempotent (uses IF NOT EXISTS)
- [x] Proper constraints
- [x] Indexes optimized
- [x] Comments clear

---

## Task 6: API Endpoints ⏳ PENDING

**Status:** NOT STARTED  
**File:** `backend/src/api/routes/room-routes.ts`  
**Estimated Time:** 1-2 hours

**Deliverables:**
- [ ] Create POST `/api/rooms/:id/messages`
  - [ ] Extract roomId, agentId, text from request
  - [ ] Call turnManagementService.submitMessage()
  - [ ] Validate auth
  - [ ] Return message response
  - [ ] Error handling (validation, not found, etc.)
- [ ] Create GET `/api/rooms/:id/messages`
  - [ ] Query by status (candidates, transcript, all)
  - [ ] Paginate results
  - [ ] Return array of messages
- [ ] Create GET `/api/rooms/:id/turn-status`
  - [ ] Call turnManagementService.getTurnStatus()
  - [ ] Return turn status
- [ ] Create POST `/api/rooms/:id/close`
  - [ ] Call outputContractService.checkCompletion()
  - [ ] Close room if complete
  - [ ] Return status
- [ ] Add proper error handling
- [ ] Add input validation
- [ ] Add auth middleware
- [ ] Add response types
- [ ] Test with curl/Postman

**Quality Checks:**
- [ ] Consistent with existing routes
- [ ] Proper HTTP status codes
- [ ] Error responses formatted
- [ ] Types defined

---

## Task 7: WebSocket Updates ⏳ PENDING

**Status:** NOT STARTED  
**File:** `backend/src/services/websocket-handlers.ts`  
**Estimated Time:** 1 hour

**Deliverables:**
- [ ] Emit `message:submitted` on submit
  - [ ] Include message data
  - [ ] Broadcast to room subscribers
- [ ] Emit `turn:selected` on turn selection
  - [ ] Include selected message
  - [ ] Include turn number
  - [ ] Include score
  - [ ] Broadcast to room
- [ ] Emit `room:completion` on progress update
  - [ ] Include completion %
  - [ ] Include current level
  - [ ] Include next milestone
- [ ] Emit `room:completed` on room close
  - [ ] Include final stats
  - [ ] Include completion level
  - [ ] Broadcast to room
- [ ] Handle subscriber cleanup
- [ ] Error handling on emit
- [ ] Logging

**Quality Checks:**
- [ ] All events properly formatted
- [ ] Type definitions for event data
- [ ] Error handling
- [ ] Logging present

---

## Task 8: Integration Tests ⏳ PENDING

**Status:** NOT STARTED  
**File:** `backend/tests/integration/day7-orchestration.test.ts`  
**Estimated Time:** 2-3 hours

**Test Cases (15+ tests):**
- [ ] Full room lifecycle
  - [ ] Create room
  - [ ] Agent A submits message
  - [ ] Turn selection runs
  - [ ] Message selected
  - [ ] Room completion checked
  - [ ] Room closed
- [ ] Multiple agents
  - [ ] 3 agents submit
  - [ ] All messages scored
  - [ ] One selected
  - [ ] Others queued/rejected
- [ ] Message validation
  - [ ] Empty message rejected
  - [ ] Too short (< 10 chars) rejected
  - [ ] Too long (> 2000 chars) rejected
  - [ ] Valid message accepted
- [ ] Turn timeout
  - [ ] No candidates = skip turn
  - [ ] Room timeout after 30s = close
  - [ ] Timeout nudges agents (TODO)
- [ ] Completion detection
  - [ ] Below minimum = continue
  - [ ] At minimum = can close
  - [ ] At standard = excellent
  - [ ] Can't meet = room fails
- [ ] Error handling
  - [ ] Orchestrator unavailable = fallback
  - [ ] Database error = handled
  - [ ] Invalid room ID = 404

**Quality Checks:**
- [ ] 100% pass rate
- [ ] Good coverage
- [ ] Uses existing test patterns
- [ ] Mocks orchestrator
- [ ] Fixtures for test data

---

## Task 9: Room Orchestration Service ⏳ PENDING

**Status:** NOT STARTED  
**File:** `backend/src/services/room-orchestration-service.ts`  
**Estimated Time:** 2-3 hours

**Deliverables:**
- [ ] Create RoomOrchestrationService class
- [ ] Implement `start()` method
  - [ ] Fetch all live rooms
  - [ ] Start turn management for each
  - [ ] Set up completion check loops
- [ ] Implement `startRoom(roomId)` method
  - [ ] Call turnManagementService.startTurnManagement()
  - [ ] Add to active rooms
  - [ ] Set up completion checker
- [ ] Implement `stopRoom(roomId)` method
  - [ ] Call turnManagementService.stopTurnManagement()
  - [ ] Remove from active
  - [ ] Clean up timers
- [ ] Implement `closeRoom(roomId)` method
  - [ ] Check completion
  - [ ] If complete:
    - [ ] Update room status to completed
    - [ ] Calculate stats
    - [ ] Trigger payment distribution (Day 8)
  - [ ] If timeout:
    - [ ] Update room status to failed
    - [ ] Refund spawn fee
- [ ] Implement internal completion check loop
  - [ ] Every 10 seconds for each room
  - [ ] Call outputContractService.checkCompletion()
  - [ ] Update progress
  - [ ] Emit WebSocket events
  - [ ] Check if complete
- [ ] Add error handling
- [ ] Add logging
- [ ] Export singleton
- [ ] Graceful shutdown

**Quality Checks:**
- [ ] All timers properly managed
- [ ] No memory leaks
- [ ] Error handling complete
- [ ] Logging comprehensive

---

## Documentation ✅

**Status:** COMPLETE

**Files Created:**
- [x] `DAY7_START_HERE.md` (400+ lines)
  - [x] Architecture overview
  - [x] Data flow diagrams
  - [x] Tasks breakdown
  - [x] Database changes
  - [x] Deployment checklist
  - [x] Key methods documented
  - [x] Critical path
  - [x] Blocking issues

- [x] `DAY7_QUICK_REFERENCE.md` (300+ lines)
  - [x] What's done summary
  - [x] Data flow
  - [x] Configuration
  - [x] Running services
  - [x] Testing checklist
  - [x] Common issues & fixes
  - [x] Code examples
  - [x] Deployment steps

- [x] `DAY7_EXECUTION_SUMMARY.txt` (300+ lines)
  - [x] Deliverables checklist
  - [x] Code quality metrics
  - [x] Remaining tasks
  - [x] Deployment readiness
  - [x] Key decisions
  - [x] Testing instructions
  - [x] Success criteria

- [x] `DAY7_TASK_CHECKLIST.md` (This file)
  - [x] Per-task checkpoints
  - [x] Deliverables list
  - [x] Quality checks
  - [x] Progress tracking

---

## Overall Progress: 50% COMPLETE

### Completed (Tasks 1-5): ✅
- Turn Management Service - DONE
- Message Service - DONE
- Output Contract Service - DONE
- Message Repository - DONE
- Database & Updates - DONE
- Documentation - DONE

### Remaining (Tasks 6-9): ⏳
- API Endpoints - TODO
- WebSocket Events - TODO
- Integration Tests - TODO
- Main Orchestration Loop - TODO

---

## Priority Order (Recommended)

**High Priority (Blocking Others):**
1. Task 6: API Endpoints - MUST DO (enables testing)
2. Task 9: Room Orchestration - MUST DO (main loop)

**Medium Priority:**
3. Task 7: WebSocket - SHOULD DO (real-time UX)
4. Task 8: Tests - SHOULD DO (confidence)

---

## Testing Before Commit

```bash
# Compile
npm run build

# Type check
npm run type-check

# Lint
npm run lint

# When ready: test endpoints
npm run test -- day7-orchestration.test.ts
```

---

## Deployment Checklist

Before deploying to staging:
- [ ] All 4 remaining tasks complete
- [ ] All tests passing
- [ ] Migration 008 ready
- [ ] Environment variables configured
- [ ] Orchestrator service running
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] Performance tested

---

## Next Steps

1. **Right Now:** Review completed tasks 1-5
2. **Next Hour:** Start Task 6 (API Endpoints)
3. **Today:** Complete Tasks 6-7 at minimum
4. **Tomorrow (Day 8):** Revenue distribution + complete Task 8-9 if needed

---

**Last Updated:** February 17, 2026  
**By:** Lead Software Architect (Amp)  
**Status:** 5 of 9 Tasks Complete - 50% Progress
