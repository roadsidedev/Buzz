# Phase 5: Days 2-5 Execution Plan

## Overview
Executing remaining Days 2-5 of Discovery & Trending implementation with focus on:
- Day 2: Live Now & Trending Sections with WebSocket
- Day 3: Search & Filtering with persistence
- Day 4: Optimization (lazy loading, code splitting, performance)
- Day 5: Testing & Documentation

---

## Day 2: Live Now & Trending Sections (Wed Feb 19)

### Components to Build

#### 1. LiveNowSection Component (~180 lines)
**File:** `frontend/src/components/discovery/live-now-section.tsx`
**Purpose:** Carousel-style display of currently live rooms with real-time viewer count updates
**Features:**
- Real-time WebSocket subscription to viewer count changes
- Horizontal scroll carousel layout
- Live indicator badge with pulsing animation
- Quick join button
- Responsive: 6 cards on desktop, 3 on tablet, 1 on mobile
- Error handling for WebSocket disconnection

#### 2. TrendingSection Component (~150 lines)
**File:** `frontend/src/components/discovery/trending-section.tsx`
**Purpose:** Grid-based display of trending rooms with scoring visualization
**Features:**
- Display trending score (0-100) as visual bar
- Category tags
- Growth indicator (↑/↓ with percentage)
- Engagement metrics (message count)
- Recency indicator (time-relative badge)
- Responsive grid: 4 cols desktop, 2 cols tablet, 1 col mobile
- Hover effects for engagement

#### 3. RoomMetricsCard Component (~100 lines)
**File:** `frontend/src/components/discovery/room-metrics-card.tsx`
**Purpose:** Shared component for displaying room metrics in both sections
**Features:**
- Trending score visualization (horizontal bar)
- Viewer count display
- Message count
- Time since started
- Real-time updates via props

#### 4. WebSocketRoomSubscriber Hook (~120 lines)
**File:** `frontend/src/hooks/use-websocket-room.ts`
**Purpose:** Custom hook for real-time room data updates
**Features:**
- Subscribe to specific room metrics
- Auto-unsubscribe on unmount
- Error handling and reconnection
- Batch updates to avoid excessive re-renders
- Return viewer count, trending score, status

### Testing (8+ tests)
```typescript
// Tests for LiveNowSection
- renders live rooms carousel
- subscribes to WebSocket on mount
- unsubscribes on unmount
- handles WebSocket disconnection gracefully
- updates viewer counts in real-time
- displays live indicator badge

// Tests for TrendingSection
- renders trending rooms grid
- displays trending score bar correctly
- shows growth indicator
- responsive grid layout

// Tests for RoomMetricsCard
- displays metrics correctly
- updates on props change
```

---

## Day 3: Search & Filtering (Thu Feb 20)

### Backend Routes (if missing)
**File:** `backend/src/routes/discovery.ts`
**Ensure endpoints exist:**
- `GET /discovery/search` - Full-text search with filters
- `GET /discovery/categories/:categoryId` - Category rooms
- `GET /discovery/trending` - Trending with cache
- `GET /discovery/live-now` - Live rooms
- `GET /discovery` - Main discovery page (aggregated)

### Frontend Components

#### 1. AdvancedSearchModal (~200 lines)
**File:** `frontend/src/components/discovery/advanced-search-modal.tsx`
**Purpose:** Full-featured search with filters
**Features:**
- Search input with debounce (300ms)
- Filters:
  - By category (multi-select dropdown)
  - By room type (debate, coding, etc.)
  - By status (live, upcoming, archived)
  - By sort (trending, newest, most viewers)
- Recent searches (localStorage, last 5)
- Search suggestions (autocomplete from backend)
- Clear all filters button
- Save search preference

#### 2. FilterPersistence Hook (~80 lines)
**File:** `frontend/src/hooks/use-filter-persistence.ts`
**Purpose:** Persist filter selections to localStorage
**Features:**
- Save selected filters to localStorage
- Load filters on component mount
- Clear filters option
- Export current filters as shareable URL params
- Restore filters from URL params

#### 3. SearchAnalytics Hook (~100 lines)
**File:** `frontend/src/hooks/use-search-analytics.ts`
**Purpose:** Track search behavior for analytics
**Features:**
- Track search queries
- Track filter usage
- Track result clicks
- Send events to analytics service
- Debounce analytics calls

### Testing (10+ tests)
```typescript
// Advanced Search Modal
- renders search input
- debounces search input correctly
- displays filter options
- multi-select category filter works
- saves recent searches to localStorage
- clears recent searches
- displays search suggestions
- applies all filters correctly

// Filter Persistence
- persists filters to localStorage
- loads filters from localStorage
- exports filters as URL params
- restores filters from URL params
- clears all filters

// Search Analytics
- tracks search queries
- tracks filter usage
- tracks result clicks
- debounces analytics calls
```

---

## Day 4: Optimization (Fri Feb 21)

### Code Splitting & Lazy Loading

#### 1. Route-based Code Splitting
**File:** `frontend/src/router/index.tsx`
```typescript
// Lazy load DiscoveryPage only when route is accessed
const DiscoveryPage = lazy(() => import('../pages/discovery-page'));
```

#### 2. Component-level Lazy Loading
**Files:** Update discovery-page.tsx to lazy load heavy components
```typescript
const LiveNowSection = lazy(() => import('../components/discovery/live-now-section'));
const TrendingSection = lazy(() => import('../components/discovery/trending-section'));
const AdvancedSearchModal = lazy(() => import('../components/discovery/advanced-search-modal'));
```

#### 3. Image Optimization
- Use Next-gen formats (WebP) for room avatars
- Implement lazy loading for images below fold
- Add blur placeholder for images

### Bundle Analysis

#### 1. Implement Bundle Analyzer
**File:** `frontend/vite.config.ts`
- Add `vite-plugin-visualizer` to analyze bundle size
- Generate bundle report in build process

#### 2. Performance Metrics
- Measure LCP (Largest Contentful Paint)
- Measure FID (First Input Delay)
- Measure CLS (Cumulative Layout Shift)
- Set performance budgets

### Performance Improvements

#### 1. Virtual Scrolling for Large Lists
**File:** `frontend/src/components/discovery/virtual-room-grid.tsx`
- Use `react-window` for virtualized grid
- Only render visible items
- Expected: 50% memory reduction for 1000+ rooms

#### 2. Memoization
- Memoize RoomCard components
- Memoize section components
- Use `useMemo` for expensive calculations
- Use `useCallback` for event handlers

#### 3. Request Batching
- Batch trending and live-now requests
- Reduce API calls by combining endpoints

### Testing (6+ performance tests)
```typescript
- Lazy loading reduces initial bundle by 30%+
- Virtual scrolling renders only visible items
- Memoization prevents unnecessary re-renders
- Images load with lazy-loading
- Lighthouse score >= 80 on discovery page
- Time to Interactive <= 2.5s
```

---

## Day 5: Testing & Documentation (Mon Feb 24)

### E2E Tests (15+)

#### 1. Discovery Page E2E
```typescript
// Cypress tests
- User navigates to discovery page
- Loads trending rooms
- Displays live now section
- Shows categories
- User can filter by category
- User can search for rooms
- User can view room details
- User can join a room
- Real-time updates work (viewer counts)
- Pagination works correctly
```

#### 2. Search & Filter E2E
```typescript
- User opens advanced search
- Applies category filter
- Applies room type filter
- Sees filtered results
- Clears filters
- Recently searched items appear
- Search suggestions work
- URL params update correctly
```

#### 3. Performance E2E
```typescript
- Page loads within 2.5s (Time to Interactive)
- Lighthouse score >= 80
- No layout shift during loading
- Scroll performance smooth (60fps)
```

### Component Storybook
**File:** `frontend/src/components/discovery/**/*.stories.tsx`

Create stories for:
- RoomCard (multiple states: loading, live, completed)
- LiveNowSection (with/without data)
- TrendingSection (with/without trends)
- RoomMetricsCard (various score ranges)
- AdvancedSearchModal (open/closed states)
- LoadingState, EmptyState, ErrorBoundary

### API Integration Guide
**File:** `docs/DISCOVERY_API_INTEGRATION.md`
- Document all discovery endpoints
- Include request/response examples
- Document WebSocket events
- Cache strategy explanation
- Rate limiting policy
- Error codes reference

### Documentation Updates
1. Update `DEVELOPMENT_CHECKPOINT.md`
2. Add performance metrics
3. Document caching strategy
4. Document WebSocket event types
5. Add troubleshooting guide

### Final Polish
- Code cleanup and review
- Fix any linting errors
- Ensure all TypeScript types are strict
- Remove console logs in production code
- Add error boundaries everywhere
- Ensure accessibility (a11y) compliance

---

## Dependency Map

```
Day 2 (Live Now & Trending)
├─ LiveNowSection
│  └─ useWebsocketRoom (new hook)
├─ TrendingSection
│  └─ RoomMetricsCard (new component)
└─ WebSocket handlers (backend - verify)

Day 3 (Search & Filtering)
├─ AdvancedSearchModal
├─ useFilterPersistence (new hook)
├─ useSearchAnalytics (new hook)
└─ Backend discovery endpoints (verify)

Day 4 (Optimization)
├─ Code splitting (router, components)
├─ VirtualRoomGrid (new component)
├─ Bundle analyzer config
└─ Performance monitoring

Day 5 (Testing & Docs)
├─ E2E tests (Cypress)
├─ Storybook stories
├─ API documentation
└─ Performance audit
```

---

## Success Criteria

### Day 2
- [ ] LiveNowSection renders and updates in real-time
- [ ] TrendingSection displays all metrics correctly
- [ ] WebSocket subscriptions work end-to-end
- [ ] 8+ tests passing
- [ ] No TypeScript errors

### Day 3
- [ ] Advanced search modal fully functional
- [ ] Filters persist across page reloads
- [ ] Search analytics tracking events
- [ ] 10+ tests passing
- [ ] Search results match backend data

### Day 4
- [ ] Bundle size reduced by 30%+ via code splitting
- [ ] Lazy loading works for all sections
- [ ] Virtual scrolling reduces memory usage
- [ ] Lighthouse score >= 80
- [ ] 6+ performance tests passing

### Day 5
- [ ] 15+ E2E tests passing
- [ ] Storybook running with all components
- [ ] API documentation complete
- [ ] All accessibility (a11y) checks pass
- [ ] Ready for production deployment

---

## Time Estimates

| Day | Task | Est. Hours | Buffer |
|-----|------|-----------|--------|
| 2 | LiveNow + Trending Components | 6 | 1 |
| 3 | Search & Filtering | 5 | 1 |
| 4 | Optimization & Performance | 5 | 1 |
| 5 | E2E Tests & Documentation | 4 | 1 |
| **Total** | | **20** | **4** |

---

## Next Steps

1. [ ] Start with LiveNowSection on Day 2
2. [ ] Build RoomMetricsCard as shared component
3. [ ] Implement WebSocket hook for real-time updates
4. [ ] Build TrendingSection using RoomMetricsCard
5. [ ] Add all tests progressively
6. [ ] Continue with Day 3 Search implementation
7. [ ] Performance optimization in Day 4
8. [ ] E2E testing and polish in Day 5

---

## Notes

- All components must follow existing patterns (TypeScript strict, full types, proper error handling)
- WebSocket reconnection logic is critical for real-time features
- Performance tests are required before Day 5
- Ensure mobile responsiveness for all new components
- Update AGENTS.md with any new patterns or conventions discovered
