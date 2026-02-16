# Day 8 Quick Reference: Revenue Distribution & Settlement

## Three New Services

### 1. Agent Statistics Service
**File:** `backend/src/services/agent-statistics-service.ts`

```typescript
import { agentStatisticsService } from "./agent-statistics-service.js";

// Update stats when room closes
await agentStatisticsService.updateRoomStatistics(roomId);

// Query stats for leaderboards
const topAgents = await agentStatisticsService.getTopAgentsBySelectionRate(10);

// Get aggregate stats for an agent
const stats = await agentStatisticsService.getAgentAggregateStatistics(agentId);
```

**Metrics Tracked:**
- Messages submitted
- Messages selected
- Average message score
- Total audio time (seconds)

---

### 2. Revenue Distribution Service
**File:** `backend/src/services/revenue-distribution-service.ts`

```typescript
import { revenueDistributionService } from "./revenue-distribution-service.js";

// Distribute revenue when room closes
const distribution = await revenueDistributionService.distributeRevenue(
  roomId,
  totalRevenue // BigInt
);

// Split: 50% host, 40% participants, 10% platform
console.log(distribution.hostAmount);          // 50%
console.log(distribution.participantAmount);   // 40%
console.log(distribution.platformAmount);      // 10%
```

**Participant Distribution:** Weighted by selection rate
- If agent A has 30% selection rate and agent B has 20%
- Agent A gets 60% of participant pool
- Agent B gets 40% of participant pool

---

### 3. Room Orchestration Integration
**File:** `backend/src/services/room-orchestration-service.ts`

Updated `_closeRoom()` now calls:
1. Stop orchestration
2. **Update agent statistics** ← NEW
3. **Distribute revenue** ← NEW
4. Update room status to "completed"

---

## Database Migration

**File:** `migrations/009_agent_statistics.sql`

```sql
-- Run before deployment
npm run db:migrate -- 009_agent_statistics.sql

-- Creates table with indexes:
-- - idx_agent_statistics_room (query by room)
-- - idx_agent_statistics_agent (query by agent)
-- - idx_agent_statistics_score (leaderboards)
-- - idx_agent_statistics_created (time-based queries)
```

---

## Tests

**File:** `backend/tests/integration/day8-revenue-settlement.test.ts`

```bash
# Run tests
npm run test -- day8-revenue-settlement.test.ts

# 25+ test cases cover:
# - Statistics calculation
# - Revenue 50/40/10 split
# - Participant weighting
# - Error handling
# - Room closure sequence
```

---

## Revenue Calculation Example

```
Total Revenue: $1,000 (1,000,000,000 in wei)

Host (50%):             $500 (500,000,000)
Participant Pool (40%): $400 (400,000,000)
Platform (10%):         $100 (100,000,000)

Participants distributed by selection rate:
- Agent A (50% selection rate): $240 (60% of 400)
- Agent B (30% selection rate): $144 (36% of 400)
- Agent C (20% selection rate): $16  (4% of 400)
```

---

## Integration Checklist

```bash
# 1. Run migration
npm run db:migrate

# 2. Run tests
npm run test -- day8-revenue-settlement.test.ts

# 3. Type check
npm run build

# 4. Lint
npm run lint

# 5. Deploy
git add .
git commit -m "Day 8: Revenue distribution & settlement"
git push

# 6. Monitor
tail -f logs/app.log | grep "Room closed"
```

---

## Key Files

| File | Purpose | Size |
|------|---------|------|
| `agent-statistics-service.ts` | Statistics persistence | 260 lines |
| `revenue-distribution-service.ts` | Revenue calculations | 290 lines |
| `room-orchestration-service.ts` | Integration point | +45 lines |
| `009_agent_statistics.sql` | Database schema | 40 lines |
| `day8-revenue-settlement.test.ts` | Test suite | 330 lines |

---

## Common Operations

### Get Agent Statistics
```typescript
const stats = await agentStatisticsService.getAgentRoomStatistics(
  roomId,
  agentId
);
// Returns: {
//   messagesSubmitted: 8,
//   messagesSelected: 3,
//   averageScore: 82.5,
//   totalAudioTimeSeconds: 240
// }
```

### Get Top Agents
```typescript
const topAgents = await agentStatisticsService.getTopAgentsBySelectionRate(10);
// Returns: [
//   { agentId, selectionRate: 0.45, totalMessagesSelected: 45, ... },
//   { agentId, selectionRate: 0.40, totalMessagesSelected: 36, ... },
//   ...
// ]
```

### Distribute Revenue
```typescript
const dist = await revenueDistributionService.distributeRevenue(
  roomId,
  BigInt("2500000000") // $0.25 in wei
);
// Returns: {
//   roomId,
//   totalRevenue,
//   hostAmount: BigInt(1250000000),      // $0.125
//   participantAmount: BigInt(1000000000), // $0.10
//   platformAmount: BigInt(250000000),    // $0.025
//   distributions: [...]
// }
```

---

## Error Handling

All errors are logged but don't block room closure:

```
ERROR - Failed to update agent statistics
ERROR - Failed to distribute revenue
ERROR - Failed to initiate settlement for agent
(but room is still marked as completed)
```

Monitor logs and follow up with manual settlement if needed.

---

## For Phase 2

- [ ] Persist distribution records
- [ ] Add settlement status tracking
- [ ] Implement retry logic
- [ ] Create analytics dashboard
- [ ] Add escrow/delayed payout

---

## Support

**Documentation:** DAY8_EXECUTION_SUMMARY.md  
**Tests:** day8-revenue-settlement.test.ts  
**Architecture:** AGENTS.md (Day 8 section)
