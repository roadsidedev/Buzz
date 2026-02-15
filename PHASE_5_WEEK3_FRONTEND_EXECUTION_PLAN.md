# Phase 5: Week 3 Execution Plan
**Frontend Discovery Page Components**

**Week:** 3 of 4 (Mar 15-21, 2026)  
**Status:** 🚀 IN EXECUTION  
**Goal:** Build complete React discovery UI with components, hooks, and 30+ tests

---

## What We're Building (Week 3)

### Frontend Deliverables

**Main Page Component:**
- DiscoveryPage - Full-page layout with all sections

**Feature Sections:**
- DiscoveryHero - Hero banner with search
- LiveNowSection - Carousel of active rooms
- TrendingSection - Grid of trending rooms
- CategoryFilter - Tab/dropdown category selector
- SearchResults - Result grid when searching

**Reusable Components:**
- RoomCard - Room preview card with metrics
- SearchBar - Search input with auto-complete
- Pagination - Page navigation with info
- LoadingState - Skeleton loaders
- EmptyState - No results messaging
- ErrorBoundary - Error handling

**Custom Hooks:**
- useDiscovery - Fetch discovery data with caching
- useSearch - Search with debounce
- useWebSocket - WebSocket subscription management
- useInfiniteScroll - Virtual list support

**Services:**
- discoveryService - API client
- WebSocket manager - Real-time updates

---

## Execution Breakdown

### Day 11: Discovery Page Layout & Hero
**Goal:** Page structure and hero component

**Morning:**
- [ ] Create DiscoveryPage component (main layout)
- [ ] Create DiscoveryHero component (banner + search)
- [ ] Define layout grid/sections structure
- [ ] Add navigation between Discovery/Search/Category modes

**Afternoon:**
- [ ] Implement responsive layout (mobile-first)
- [ ] Add loading states for page sections
- [ ] Test layout on mobile, tablet, desktop
- [ ] Basic styling with Tailwind + shadcn/ui

**Evening:**
- [ ] Create page tests (4+ tests)
- [ ] Verify responsive behavior
- [ ] Commit: "Phase 5 Week 3 Day 11: Discovery page layout & hero"

**Deliverables:**
```
✅ DiscoveryPage component (200 lines)
✅ DiscoveryHero component (150 lines)
✅ Responsive layout
✅ 4+ page tests
```

---

### Day 12: Room Card & Live Now Section
**Goal:** Reusable room card component and live carousel

**Morning:**
- [ ] Create RoomCard component (room preview)
- [ ] Display: thumbnail, title, host, viewer count, trending score
- [ ] Add hover effects and interactivity
- [ ] Include join button

**Afternoon:**
- [ ] Create LiveNowSection component
- [ ] Display rooms in carousel/grid
- [ ] Implement pagination within section
- [ ] Add WebSocket viewer count updates

**Evening:**
- [ ] Create component tests (8+ tests)
- [ ] Test interactions and updates
- [ ] Verify styling on all screen sizes
- [ ] Commit: "Phase 5 Week 3 Day 12: Room card & live now section"

**Deliverables:**
```
✅ RoomCard component (120 lines)
✅ LiveNowSection component (180 lines)
✅ 8+ component tests
✅ WebSocket integration
```

---

### Day 13: Search & Category Filter
**Goal:** Search functionality and category filtering

**Morning:**
- [ ] Create SearchBar component (input + debounce)
- [ ] Implement useSearch hook with API integration
- [ ] Add search suggestions/autocomplete
- [ ] Handle empty query, loading, error states

**Afternoon:**
- [ ] Create CategoryFilter component
- [ ] Display category tabs/dropdown
- [ ] Filter discovery by category
- [ ] Update trending for selected category

**Evening:**
- [ ] Create search/filter tests (10+ tests)
- [ ] Test debouncing and API calls
- [ ] Test category switching
- [ ] Commit: "Phase 5 Week 3 Day 13: Search & category filtering"

**Deliverables:**
```
✅ SearchBar component (100 lines)
✅ useSearch hook (80 lines)
✅ CategoryFilter component (100 lines)
✅ 10+ search/filter tests
```

---

### Day 14: Pagination & Trending Section
**Goal:** Pagination component and trending grid

**Morning:**
- [ ] Create Pagination component
- [ ] Display prev/next buttons + page indicators
- [ ] Calculate total pages and current position
- [ ] Handle page changes with API requests

**Afternoon:**
- [ ] Create TrendingSection component
- [ ] Display trending rooms in grid
- [ ] Add real-time trending updates via WebSocket
- [ ] Show trending score and metrics

**Evening:**
- [ ] Create pagination tests (6+ tests)
- [ ] Test page navigation and limits
- [ ] Verify trending score updates
- [ ] Commit: "Phase 5 Week 3 Day 14: Pagination & trending section"

**Deliverables:**
```
✅ Pagination component (100 lines)
✅ TrendingSection component (150 lines)
✅ 6+ pagination tests
✅ Real-time updates working
```

---

### Day 15: Polish & Comprehensive Tests
**Goal:** Error states, loading states, and full test coverage

**Morning:**
- [ ] Create LoadingState component (skeleton loaders)
- [ ] Create EmptyState component (no results)
- [ ] Create ErrorBoundary component (error handling)
- [ ] Implement error/loading states in all sections

**Afternoon:**
- [ ] Create comprehensive integration tests (10+ tests)
- [ ] Test discovery flow end-to-end
- [ ] Test error scenarios
- [ ] Test WebSocket connectivity

**Evening:**
- [ ] Performance testing and optimization
- [ ] Lighthouse audit
- [ ] Bundle size check
- [ ] Final polishing and documentation
- [ ] Commit: "Phase 5 Week 3 Day 15: Polish & comprehensive tests"

**Deliverables:**
```
✅ LoadingState component (80 lines)
✅ EmptyState component (80 lines)
✅ ErrorBoundary component (100 lines)
✅ 10+ integration tests
✅ 30+ total tests for Week 3
✅ Performance baseline
```

---

## File Manifest

### Components (10 files)

```
frontend/src/pages/
  └─ discovery-page.tsx                [NEW] 250 lines

frontend/src/components/discovery/
  ├─ discovery-hero.tsx                [NEW] 150 lines
  ├─ live-now-section.tsx              [NEW] 180 lines
  ├─ trending-section.tsx              [NEW] 150 lines
  ├─ room-card.tsx                     [NEW] 120 lines
  ├─ search-bar.tsx                    [NEW] 100 lines
  ├─ category-filter.tsx               [NEW] 100 lines
  ├─ pagination.tsx                    [NEW] 100 lines
  ├─ loading-state.tsx                 [NEW] 80 lines
  └─ error-boundary.tsx                [NEW] 100 lines

frontend/src/components/discovery/empty-state.tsx
  └─ empty-state.tsx                   [NEW] 80 lines
```

### Hooks (3 files)

```
frontend/src/hooks/
  ├─ use-discovery.ts                  [NEW] 150 lines
  ├─ use-search.ts                     [NEW] 100 lines
  └─ use-websocket.ts                  [NEW] 120 lines
```

### Services (1 file)

```
frontend/src/services/
  └─ discovery.ts                      [NEW] 120 lines
```

### Types (1 file)

```
common/types/
  └─ discovery.ts                      [NEW] 80 lines
```

### Tests (8 files)

```
tests/
├─ pages/discovery-page.test.tsx       [NEW] 300 lines
├─ components/discovery/
│  ├─ room-card.test.tsx               [NEW] 150 lines
│  ├─ search-bar.test.tsx              [NEW] 140 lines
│  ├─ category-filter.test.tsx         [NEW] 120 lines
│  ├─ pagination.test.tsx              [NEW] 100 lines
│  ├─ loading-state.test.tsx           [NEW] 80 lines
│  ├─ trending-section.test.tsx        [NEW] 120 lines
│  └─ live-now-section.test.tsx        [NEW] 120 lines
└─ hooks/
   └─ use-discovery.test.ts            [NEW] 150 lines
```

### Total Files: 21 new files
### Total Lines: 2,700+ lines (components + hooks + tests)

---

## Component Architecture

### State Management Flow

```
DiscoveryPage (parent state)
  ├─ mode: 'discovery' | 'search' | 'category'
  ├─ searchQuery: string
  ├─ selectedCategory: string | null
  ├─ currentPage: number
  │
  ├─ useDiscovery() hook
  │   ├─ fetchDiscoveryPage()
  │   ├─ fetchTrending()
  │   └─ fetchLiveNow()
  │
  ├─ useSearch() hook
  │   ├─ search(query)
  │   └─ debounce(300ms)
  │
  └─ useWebSocket() hook
      ├─ subscribe('trending:updated')
      ├─ subscribe('live-now:updated')
      └─ subscribe('room:viewer-count:changed')
      
  Renders:
  ├─ DiscoveryHero
  │   └─ SearchBar (emits search events)
  ├─ CategoryFilter (emits category change)
  ├─ Conditional:
  │   ├─ Mode 'discovery':
  │   │   ├─ LiveNowSection
  │   │   └─ TrendingSection
  │   ├─ Mode 'search':
  │   │   ├─ SearchResults
  │   │   └─ Pagination
  │   └─ Mode 'category':
  │       ├─ CategoryRooms
  │       └─ Pagination
  └─ ErrorBoundary (wraps all)
```

### Data Flow

```
API Response (cached, < 50ms)
  ↓
Discovery State (React)
  ├─ discoveryPage: DiscoveryPageData
  ├─ searchResults: DiscoveryRoom[]
  ├─ loading: boolean
  ├─ error: Error | null
  └─ totalPages: number
  
WebSocket Update (real-time, < 100ms)
  ├─ trending:updated
  │   └─ Update state → Re-render sections
  ├─ room:viewer-count:changed
  │   └─ Update specific room card
  └─ live-now:updated
      └─ Update live now section
```

---

## Component Specifications

### DiscoveryPage
**Props:** None (uses context + hooks)  
**State:**
- mode: 'discovery' | 'search' | 'category'
- discoveryData: DiscoveryPageData | null
- searchResults: DiscoveryRoom[]
- selectedCategory: string | null
- currentPage: number
- loading: boolean
- error: Error | null

**Methods:**
- handleSearch(query: string)
- handleSelectCategory(categoryId: string)
- handlePageChange(page: number)

---

### RoomCard
**Props:**
```typescript
interface RoomCardProps {
  room: DiscoveryRoom;
  onJoin: (roomId: string) => void;
  isLoading?: boolean;
}
```

**Features:**
- Thumbnail image (or gradient fallback)
- Room title and objective
- Host agent name
- Viewer count badge
- Trending score indicator
- Category tag
- Join button (clickable)

---

### SearchBar
**Props:**
```typescript
interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  suggestions?: string[];
  isLoading?: boolean;
}
```

**Features:**
- Input field with icon
- Debounced search (300ms)
- Autocomplete suggestions
- Clear button
- Loading state

---

### CategoryFilter
**Props:**
```typescript
interface CategoryFilterProps {
  categories: Category[];
  selected: string | null;
  onSelect: (categoryId: string | null) => void;
  loading?: boolean;
}
```

**Features:**
- Responsive tabs (mobile: dropdown)
- Show all categories
- Visual indicator for selected
- Count of rooms per category

---

### Pagination
**Props:**
```typescript
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}
```

**Features:**
- Prev/Next buttons
- Page number display
- Jump to page input
- Disabled states

---

## Hook Specifications

### useDiscovery()
```typescript
function useDiscovery() {
  return {
    discoveryPage: DiscoveryPageData | null;
    trending: DiscoveryRoom[];
    liveNow: DiscoveryRoom[];
    categories: Category[];
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
  };
}
```

### useSearch()
```typescript
function useSearch(apiUrl: string) {
  return {
    search: (query: string) => Promise<DiscoveryRoom[]>;
    results: DiscoveryRoom[];
    loading: boolean;
    error: Error | null;
  };
}
```

### useWebSocket()
```typescript
function useWebSocket(serverUrl: string) {
  return {
    subscribe: (event: string) => void;
    unsubscribe: (event: string) => void;
    on: (event: string, handler: Function) => void;
    connected: boolean;
    error: Error | null;
  };
}
```

---

## Test Coverage

### Component Tests (20+)
- RoomCard: 5 tests
- SearchBar: 5 tests
- CategoryFilter: 4 tests
- Pagination: 4 tests
- LoadingState: 2 tests

### Page Tests (5+)
- DiscoveryPage: 5+ tests
  - Page load
  - Search interaction
  - Category filtering
  - Pagination
  - WebSocket updates

### Hook Tests (3+)
- useDiscovery: 3+ tests
- useSearch: 3+ tests
- useWebSocket: 3+ tests

### Integration Tests (5+)
- Full flow: search → results → join
- Category filter → pagination
- Real-time updates → UI sync
- Error handling
- Loading states

### Total: 30+ tests
### Target Coverage: 85%+ for components, 80%+ for hooks

---

## Performance Optimization

### Code Splitting
- Discovery page lazy loaded
- Component splitting by route
- Async import for heavy components

### Memoization
- useMemo for expensive computations
- useCallback for event handlers
- React.memo for non-state components

### Virtual Scrolling
- React-window for large lists
- 50 rooms per page max
- Lazy load additional pages

### Caching
- API responses cached (5 min)
- Component state persistence
- WebSocket connection pooling

---

## Responsive Design

### Breakpoints
```
Mobile:   < 640px
Tablet:   640px - 1024px
Desktop:  > 1024px
```

### Component Behavior
```
Discovery Page Layout:
  Mobile:  Single column, full width
  Tablet:  2 columns
  Desktop: 3 columns + sidebar

Categories:
  Mobile:  Dropdown
  Tablet:  Horizontal scroll
  Desktop: Tab bar

Pagination:
  Mobile:  Simple next/prev
  Tablet:  Page numbers visible
  Desktop: Full pagination controls
```

---

## Error Handling

### Error Scenarios
1. API request fails → Show error message + retry
2. WebSocket disconnects → Show reconnecting indicator
3. No results → Show empty state with suggestions
4. Network timeout → Show timeout message + offline fallback
5. Invalid category → Redirect to all categories

### Error Boundaries
- DiscoveryPage error boundary
- Component-level error handling
- Fallback UI for each error

---

## Accessibility

- [ ] ARIA labels for interactive elements
- [ ] Keyboard navigation (Tab, Enter, Escape)
- [ ] Focus management
- [ ] Color contrast WCAG AA
- [ ] Screen reader testing
- [ ] Alt text for images

---

## Performance Targets

| Metric | Target | Method |
|--------|--------|--------|
| Page load | < 2s | Lazy loading + code splitting |
| Search | < 300ms | Debounce + cached API |
| Category filter | < 100ms | Local state update |
| Pagination | < 500ms | API call + cache |
| Room card render | < 16ms | Memoization + memo |
| WebSocket update | < 100ms | Real-time from wire |

---

## Development Workflow

### Daily Steps
1. **Morning:** Read spec for the day, create components
2. **Afternoon:** Implement functionality, test interactions
3. **Evening:** Write tests, commit, update metrics

### Testing Workflow
```bash
# Run component tests
npm run test -w frontend -- --watch

# Run with coverage
npm run test:cov -w frontend

# Visual regression testing
npm run test:visual -w frontend
```

### Build & Performance
```bash
# Check bundle size
npm run build -w frontend
npm run analyze -w frontend

# Lighthouse audit
npm run audit -w frontend
```

---

## Success Criteria

✅ **Week 3 Complete When:**

1. **All Components Built**
   - 10+ discovery components
   - 3+ custom hooks
   - 30+ tests

2. **Full Functionality**
   - Search working with debounce
   - Category filtering
   - Pagination working
   - Real-time WebSocket updates
   - Error handling

3. **Performance**
   - Page load < 2s
   - API responses < 50ms (cached)
   - WebSocket latency < 100ms
   - Bundle size < 200KB (discovery chunk)

4. **Quality**
   - 85%+ test coverage
   - All tests passing
   - Lighthouse score > 85
   - Mobile-friendly verified

5. **Documentation**
   - Component storybook
   - API integration guide
   - WebSocket event guide

---

## Next Phase (Week 4)

Week 4 will complete Phase 5 with:
- Room details page
- Room join flow
- Search implementation final polish
- E2E tests
- Performance optimization
- Documentation finalization

**Dependencies from Week 3:**
✅ Discovery page working  
✅ Components reusable  
✅ WebSocket integrations proven  
✅ Test patterns established  

---

## Quick Reference

| Task | File | Lines | Status |
|------|------|-------|--------|
| Main page | discovery-page.tsx | 250 | Day 11 |
| Hero section | discovery-hero.tsx | 150 | Day 11 |
| Room card | room-card.tsx | 120 | Day 12 |
| Live now | live-now-section.tsx | 180 | Day 12 |
| Search | search-bar.tsx | 100 | Day 13 |
| Categories | category-filter.tsx | 100 | Day 13 |
| Pagination | pagination.tsx | 100 | Day 14 |
| Trending | trending-section.tsx | 150 | Day 14 |
| Loading | loading-state.tsx | 80 | Day 15 |
| Errors | error-boundary.tsx | 100 | Day 15 |
| Hooks | use-discovery.ts | 150 | Days 11-15 |
| Tests | 30+ test files | 2000+ | Days 11-15 |

---

## Commit Messages

```
Day 11: Phase 5 Week 3 Day 11: Discovery page layout & hero
Day 12: Phase 5 Week 3 Day 12: Room card & live now section
Day 13: Phase 5 Week 3 Day 13: Search & category filtering
Day 14: Phase 5 Week 3 Day 14: Pagination & trending section
Day 15: Phase 5 Week 3 Day 15: Polish & comprehensive tests
```

---

**Week 3 Status:** Ready for Execution ✅  
**Last Updated:** March 15, 2026  
**Lead:** Architecture Team
