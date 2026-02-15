# Phase 5: Week 2 Execution Plan
**Redis Caching, WebSocket Updates, and Comprehensive Tests**

**Week:** 2 of 4 (Mar 8-14, 2026)  
**Status:** 🚀 IN EXECUTION  
**Goal:** Implement Redis caching (5-min TTL), WebSocket real-time updates, and 70+ comprehensive tests

---

## What We're Building (Week 2)

### 1. Redis Caching Layer (Day 6-7)
- Cache trending scores with 5-minute TTL
- Hot data caching for live now, categories
- Cache invalidation strategy
- Health check endpoints

### 2. WebSocket Real-Time Updates (Day 8)
- Broadcasting viewer count changes
- Room status updates (live → completed)
- Trending score updates
- Search/filter real-time sync

### 3. Comprehensive Testing (Day 9-10)
- 70+ tests total (targeting 85%+ coverage)
- Unit tests for trending service (20+ tests)
- Integration tests for caching (15+ tests)
- WebSocket integration tests (15+ tests)
- E2E tests for discovery flow (20+ tests)

---

## Execution Checklist

### Day 6: Redis Cache Infrastructure
- [ ] Create `cache-service.ts` (wrapper around Redis client)
- [ ] Implement cache key strategies
- [ ] Add cache invalidation handlers
- [ ] Add health check endpoints
- [ ] Deploy Redis in docker-compose

**Expected Output:**
```
✅ CacheService class with methods:
  - get(key): Promise<T>
  - set(key, value, ttl): Promise<void>
  - delete(key): Promise<void>
  - clear(): Promise<void>
  - getHealth(): Promise<HealthStatus>
```

### Day 7: Integrate Caching with Trending
- [ ] Update TrendingService to use CacheService
- [ ] Implement `getTrendingCached()` with 5-min TTL
- [ ] Add cache warming on startup
- [ ] Add metrics tracking (hit/miss rates)
- [ ] Cache invalidation on room updates

**Expected Output:**
```
✅ Trending cache working:
  - First request: calculates and caches
  - Subsequent requests (< 5 min): from cache
  - After 5 min: recalculates
  - On update: invalidates and recaches
```

### Day 8: WebSocket Real-Time Updates
- [ ] Create `websocket-handlers.ts` for discovery events
- [ ] Implement `broadcast-trending-update`
- [ ] Implement `broadcast-room-status-change`
- [ ] Implement `broadcast-viewer-count-update`
- [ ] Add client subscription management

**Expected Output:**
```
✅ WebSocket clients receive:
  - Trending updates every 5 minutes
  - Viewer count changes in real-time
  - Room status changes (live → completed)
  - Category trending within specific rooms
```

### Day 9: Testing - Unit & Integration
- [ ] TrendingService unit tests (12 tests)
  - Scoring calculation accuracy
  - Score normalization
  - Recency boost logic
  - Growth calculation

- [ ] CacheService unit tests (8 tests)
  - Set/get operations
  - TTL expiration
  - Cache invalidation
  - Concurrent access

- [ ] Discovery integration tests (15 tests)
  - Cache hit/miss scenarios
  - Performance benchmarks
  - Pagination with caching
  - Search result caching

- [ ] WebSocket integration tests (10 tests)
  - Real-time broadcasts
  - Client subscriptions
  - Message ordering
  - Connection handling

**Expected Output:**
- [ ] 45+ tests written and passing
- [ ] Coverage report generated
- [ ] Performance baseline established

### Day 10: Testing - E2E & Optimization
- [ ] E2E tests for full discovery flow (15+ tests)
  - Page load → see trending
  - WebSocket connect → receive updates
  - Room join flow
  - Search with real-time results

- [ ] Performance tests (10+ tests)
  - Cache warming time
  - Query response times
  - WebSocket message latency
  - Memory usage under load

- [ ] Documentation & cleanup
  - Test coverage report
  - Performance benchmarks
  - Known limitations
  - Future optimization notes

**Expected Output:**
- [ ] 70+ tests total, 85%+ coverage
- [ ] Performance baseline: < 200ms for cached requests
- [ ] WebSocket latency: < 100ms per update

---

## File Manifest (Week 2)

### New Files
```
backend/src/
├─ services/
│  ├─ cache-service.ts                    [NEW] 150 lines
│  ├─ websocket-handlers.ts               [NEW] 200 lines
│  └─ trending-service.ts                 [UPDATED] +Redis integration
├─ utils/
│  └─ cache-keys.ts                       [NEW] Cache key constants
└─ config/
   └─ redis.ts                            [NEW] Redis client config

tests/
├─ unit/services/
│  ├─ trending-service.test.ts            [NEW] 300 lines (12 tests)
│  └─ cache-service.test.ts               [NEW] 250 lines (8 tests)
├─ integration/
│  ├─ discovery-cache.test.ts             [NEW] 400 lines (15 tests)
│  ├─ websocket-discovery.test.ts         [NEW] 350 lines (10 tests)
│  └─ trending-cache.test.ts              [NEW] 300 lines (15 tests)
└─ e2e/
   ├─ discovery-flow.test.ts              [NEW] 500 lines (15+ tests)
   └─ performance.test.ts                 [NEW] 300 lines (10+ tests)

docker-compose.yml                        [UPDATED] Add Redis service
```

### Modified Files
```
backend/src/
├─ server.ts                              [UPDATED] Initialize cache service
├─ services/index.ts                      [UPDATED] Export cache/websocket services
├─ services/trending-service.ts           [UPDATED] Add caching methods
├─ api/routes/discovery.ts                [UPDATED] Use cached queries
├─ api/routes/room.ts                     [UPDATED] Broadcast on viewer/status change
└─ utils/logger.ts                        [UPDATED] Add cache metrics logging

.env.example                              [UPDATED] Add REDIS_URL, CACHE_TTL
```

---

## Test Structure

### Scoring Tests (TrendingService)
```typescript
describe('TrendingService', () => {
  describe('calculateTrendingScore', () => {
    it('should return 0 for room with no metrics', ...)
    it('should normalize popularity to max 35 points', ...)
    it('should apply growth bonus correctly', ...)
    it('should apply recency boost for new rooms', ...)
    it('should apply recency decay for old rooms', ...)
    it('should handle edge cases (NaN, Infinity)', ...)
    it('should score consistently across calls', ...)
  })
  describe('updateAllTrendingScores', () => {
    it('should calculate scores for all active rooms', ...)
    it('should update database with new scores', ...)
    it('should handle database errors gracefully', ...)
  })
})
```

### Caching Tests (CacheService)
```typescript
describe('CacheService', () => {
  describe('set/get', () => {
    it('should store and retrieve values', ...)
    it('should respect TTL expiration', ...)
    it('should handle expired keys', ...)
  })
  describe('delete', () => {
    it('should remove cached keys', ...)
    it('should not throw if key missing', ...)
  })
  describe('concurrent access', () => {
    it('should handle race conditions', ...)
    it('should serialize concurrent writes', ...)
  })
})
```

### Integration Tests
```typescript
describe('Discovery with Caching', () => {
  it('should cache trending results', ...)
  it('should return cached results within TTL', ...)
  it('should invalidate cache on room update', ...)
  it('should handle cache miss gracefully', ...)
  it('should support pagination with cache', ...)
})

describe('WebSocket Real-Time', () => {
  it('should broadcast trending updates', ...)
  it('should handle client subscriptions', ...)
  it('should deliver messages in order', ...)
  it('should clean up disconnected clients', ...)
})
```

---

## Performance Targets

| Metric | Target | Testing |
|--------|--------|---------|
| Cached trending request | < 50ms | Mock cache, measure |
| Cache refresh (5-min) | < 2s | Full calculation, batch |
| WebSocket message latency | < 100ms | Socket.io timing |
| Memory (Redis + cache) | < 500MB | Monitor under load |
| Coverage | 85%+ | vitest --coverage |

---

## Dependency Map

```
TrendingService
  ├─ CacheService (NEW)
  ├─ Database (existing)
  └─ Logger (existing)

DiscoveryService
  ├─ TrendingService (updated)
  ├─ CacheService (NEW)
  └─ Database (existing)

WebSocketHandlers (NEW)
  ├─ CacheService (NEW)
  ├─ TrendingService (updated)
  ├─ Socket.io (existing)
  └─ Logger (existing)

Redis Client (NEW)
  ├─ redis package (installed)
  └─ Environment config (existing)
```

---

## Redis Configuration

### Environment Variables
```bash
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=          # Optional
REDIS_URL=redis://redis:6379
TRENDING_CACHE_TTL=300   # 5 minutes
LIVE_NOW_CACHE_TTL=60    # 1 minute
SEARCH_CACHE_TTL=300     # 5 minutes
CATEGORY_CACHE_TTL=3600  # 1 hour
```

### docker-compose.yml Update
```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  redis_data:
```

---

## Cache Keys Strategy

```typescript
// Key patterns
const CACHE_KEYS = {
  // Trending
  'trending:global': { ttl: 300 },        // 5 min
  'trending:category:{id}': { ttl: 300 },
  
  // Live now
  'live-now:page:{page}': { ttl: 60 },    // 1 min
  
  // Search
  'search:{query}:{page}': { ttl: 300 },
  
  // Categories
  'categories:list': { ttl: 3600 },       // 1 hour
  'category:{id}': { ttl: 3600 },
  
  // Room details
  'room:{id}': { ttl: 120 },              // 2 min
  'room:{id}:participants': { ttl: 60 },
  
  // Health
  'cache:health': { ttl: 5 }
}
```

---

## Success Criteria

✅ **Week 2 Complete When:**

1. **Redis Integration**
   - Redis service running in docker-compose
   - CacheService implemented and tested
   - Trending data cached with 5-min TTL

2. **WebSocket Updates**
   - Trending updates broadcast every 5 min
   - Room status changes broadcast in real-time
   - Viewer count updates broadcast live

3. **Testing**
   - 70+ tests passing
   - 85%+ coverage on critical paths
   - Performance benchmarks documented
   - E2E discovery flow tests passing

4. **Performance**
   - Cached requests: < 50ms
   - Cache refresh: < 2s
   - WebSocket latency: < 100ms

5. **Documentation**
   - Cache strategy documented
   - WebSocket event spec documented
   - Performance baseline established

---

## Commit Message Template

```
Phase 5 Week 2 Day X: [Task]

- [Feature/fix]
- [Tests added]
- [Performance metric]

Closes: [issue/task]
```

Example:
```
Phase 5 Week 2 Day 6: Redis cache infrastructure

- Implemented CacheService with get/set/delete/clear
- Added TTL expiration and health checks
- Configured docker-compose Redis service
- 8 unit tests, all passing

Cache hit latency: 12ms
Cache miss latency: 2100ms
```

---

## Daily Standup Template

### Example Day 6 Standup
```
✅ Completed:
  - CacheService class (get/set/delete)
  - Redis health check endpoint
  - docker-compose Redis service
  - 8 unit tests

🚧 In Progress:
  - Cache TTL validation
  - Concurrent access handling

🔴 Blockers:
  - None

📊 Metrics:
  - Tests: 8/70 passing
  - Coverage: 35%
  - Cache hit latency: 12ms
```

---

## Rolling Back Safely

If issues arise:

1. **Cache failures:** Falls back to direct database queries (no cascading failures)
2. **WebSocket issues:** Clients can still poll discovery API
3. **Redis down:** Service continues with slower performance but no data loss

---

## Next Phase Preview (Week 3)

Week 3 focuses on **Frontend Discovery Page**:
- React component implementations
- Consuming cached discovery API
- Subscribing to WebSocket updates
- 30+ frontend component tests

**Dependencies on Week 2:**
- Cache hit latency < 50ms (needed for snappy UI)
- WebSocket updates flowing (real-time UI sync)
- Reliable API contracts (documented in tests)

---

## Quick Links

- [Phase 5 Kickoff](./PHASE_5_KICKOFF.md)
- [Week 1 API Implementation](./PHASE_5_WEEK1_DISCOVERY_API.md)
- [Architecture Guide](./AGENTS.md#architecture)
- [API Reference](./API_REFERENCE.md)
- [Redis Documentation](https://redis.io/docs/)
- [Socket.io Guide](https://socket.io/docs/)

---

**Week 2 Status:** Ready for Execution ✅  
**Last Updated:** March 8, 2026  
**Lead:** Architecture Team
