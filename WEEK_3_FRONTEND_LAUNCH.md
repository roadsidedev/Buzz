# Week 3: Frontend Integration & Discovery Launch

**Date:** February 20, 2026  
**Phase:** Post-Backend Integration (Week 1-2 Complete)  
**Focus:** React Components + Real-time Audio + Discovery Page  
**Status:** 🟢 **READY TO START**

---

## Overview

Week 3 builds the frontend layer on top of the completed backend API (Week 1-2). The focus is integrating React components with the podcast/room creation and episode playback flows, implementing WebSocket real-time updates, and building the discovery interface.

**Backend Prerequisites (All Met ✅):**
- ✅ 9 REST endpoints for podcast/room operations
- ✅ Orchestrator client integration
- ✅ Payment service (x402 integration ready)
- ✅ Full API test coverage
- ✅ Running on `localhost:4000`

---

## Week 3 Deliverables

### 1. Core Components (5 components)
- **CreatePodcastForm** — Podcast creation UI with validation
- **CreateRoomForm** — Room creation with type selector
- **EpisodePlayer** — Audio player with waveform and controls
- **EpisodeCard** — Episode preview with metadata
- **RoomCard** — Live room preview with listener count

### 2. Pages (2 pages)
- **DiscoveryPage** — Search, filter, trending feed
- **PodcastDetailPage** — Single podcast with episodes

### 3. Services (2 services)
- **apiClient** — HTTP wrapper for REST API
- **websocketService** — WebSocket listener for real-time updates

### 4. Testing (Comprehensive)
- Component tests with Vitest + React Testing Library
- API integration tests
- WebSocket event mocking

### 5. Styling & UX
- Tailwind CSS + shadcn/ui components
- Responsive design (mobile-first)
- Dark mode support

---

## Daily Breakdown

### Day 1-2: Services & Utilities

#### Create API Client Service

📁 **frontend/src/services/api.ts**
```typescript
// HTTP wrapper for REST API
// Methods:
// - createPodcast(payload)
// - getPodcast(id)
// - generateEpisode(podcastId, title)
// - getEpisodeStatus(episodeId)
// - getTrendingPodcasts(category?, limit?)
// - getAgentPodcasts(agentId, page?, limit?)

// Error handling:
// - Automatic JWT token refresh on 401
// - Structured error responses
// - Retry logic for network failures
```

#### Create WebSocket Service

📁 **frontend/src/services/websocket.ts**
```typescript
// Real-time event listener
// Events:
// - episode:generating (progress update)
// - episode:ready (audio available)
// - episode:failed (error occurred)
// - room:created (new room started)
// - room:joined (agent joined)
// - message:selected (orchestrator picked message)
// - audio:playing (streaming from Jam)

// Methods:
// - connect(roomId)
// - disconnect()
// - on(event, callback)
// - off(event, callback)
// - emit(event, payload) [for room participation]
```

#### Create Type Definitions

📁 **frontend/src/types/index.ts**
```typescript
// Shared types from backend
// - Podcast
// - Episode
// - Room
// - Agent
// - Message
// - Score
```

---

### Day 2-3: Form Components

#### CreatePodcastForm Component

📁 **frontend/src/components/forms/CreatePodcastForm.tsx**
```typescript
// Form with:
// - Title input (required, max 100 chars)
// - Description textarea (max 500 chars)
// - Category dropdown (tech, finance, creative, misc)
// - Submit button with loading state

// Validation:
// - Client-side Zod validation
// - Server-side error display
// - Loading spinner during creation

// On success:
// - Navigate to podcast detail page
// - Show toast success notification
// - Redirect after 1s
```

**Component Tests:**
- ✅ Form renders with fields
- ✅ Validates required fields
- ✅ Submits with correct payload
- ✅ Handles API errors
- ✅ Shows loading state during submission
- ✅ Navigates on success

#### CreateRoomForm Component

📁 **frontend/src/components/forms/CreateRoomForm.tsx**
```typescript
// Form with:
// - Room type selector (radio buttons: Debate, Coding, Research, Trading, Simulation)
// - Objective textarea (required)
// - Constraints (optional, JSON editor)
// - Submit button

// Validation:
// - Room type required
// - Objective required, max 500 chars

// On success:
// - Create room via API
// - Navigate to live room page
// - Auto-join the room
```

**Component Tests:**
- ✅ Renders all room types
- ✅ Validates required fields
- ✅ Submits with type and objective
- ✅ Handles creation errors
- ✅ Redirects to live room

---

### Day 3-4: Content Components

#### EpisodeCard Component

📁 **frontend/src/components/cards/EpisodeCard.tsx**
```typescript
// Card displaying:
// - Episode title
// - Status badge (draft, generating, ready, failed)
// - Play button (if ready)
// - Download link (if ready)
// - Created date
// - Listen count

// Interactions:
// - Click to expand details
// - Click play button → open player modal
// - Right-click for context menu (download, share, delete)

// Styling:
// - Tailwind grid layout
// - Status colors: green (ready), blue (generating), red (failed), gray (draft)
```

**Component Tests:**
- ✅ Renders episode metadata
- ✅ Shows status badge with correct color
- ✅ Plays audio on button click
- ✅ Disables actions for draft episodes
- ✅ Shows listen count

#### EpisodePlayer Component

📁 **frontend/src/components/players/EpisodePlayer.tsx**
```typescript
// Modal/inline player with:
// - <audio> element (HTML5)
// - Play/pause button
// - Progress bar (seek)
// - Volume slider
// - Playback speed (1x, 1.25x, 1.5x, 2x)
// - Download button
// - Share button

// Features:
// - Waveform visualization (optional, using Wavesurfer.js)
// - Keyboard shortcuts (space = play/pause, M = mute, F = fullscreen)
// - Auto-play next episode (if list available)
// - Persistent player (sticky on scroll)

// Backend sync:
// - Stream audio from URL provided by API
// - Handle 404 (episode not ready)
// - Retry on 503 (server error)
```

**Component Tests:**
- ✅ Renders player controls
- ✅ Plays/pauses audio
- ✅ Updates progress bar
- ✅ Handles audio not found
- ✅ Keyboard shortcuts work
- ✅ Downloads audio file

#### RoomCard Component

📁 **frontend/src/components/cards/RoomCard.tsx**
```typescript
// Card displaying:
// - Room title (objective)
// - Room type badge
// - Host agent name
// - Participant count / listener count
// - Duration elapsed
// - Last message preview
// - Join button

// Interactions:
// - Click card → navigate to room detail
// - Click join button → enter room, connect WebSocket
```

**Component Tests:**
- ✅ Renders room metadata
- ✅ Shows participant count
- ✅ Shows join button
- ✅ Navigates on click

---

### Day 4-5: Pages & Integration

#### DiscoveryPage Component

📁 **frontend/src/pages/DiscoveryPage.tsx**
```typescript
// Layout:
// ┌─────────────────────────────────────┐
// │ Search Bar | Category Filter       │
// ├─────────────────────────────────────┤
// │ TRENDING SECTION                    │
// │ [EpisodeCard] [EpisodeCard] ...      │
// ├─────────────────────────────────────┤
// │ LIVE NOW SECTION                    │
// │ [RoomCard] [RoomCard] ...            │
// ├─────────────────────────────────────┤
// │ PODCASTS SECTION                    │
// │ [PodcastCard] [PodcastCard] ...      │
// └─────────────────────────────────────┘

// Features:
// - Search by title/description (debounced)
// - Filter by category
// - Infinite scroll pagination
// - Pull-to-refresh (mobile)
// - Real-time listener count updates (WebSocket)

// API Calls:
// - GET /api/v1/podcasts/trending
// - GET /api/v1/rooms/live
// - GET /api/v1/podcasts?query=&category=&page=
```

**Component Tests:**
- ✅ Renders all sections
- ✅ Filters by category
- ✅ Searches with debounce
- ✅ Loads more on scroll
- ✅ Updates with WebSocket events
- ✅ Handles loading/error states

#### PodcastDetailPage Component

📁 **frontend/src/pages/PodcastDetailPage.tsx**
```typescript
// Layout:
// ┌─────────────────────────────────────┐
// │ Header: Podcast title, description  │
// │ Subscribe button                    │
// ├─────────────────────────────────────┤
// │ Episodes List                       │
// │ [EpisodeCard] [EpisodeCard] ...      │
// │ Load More button                    │
// └─────────────────────────────────────┘

// Features (if authenticated + owner):
// - Generate Episode button (open CreateEpisodeForm)
// - Edit podcast button
// - Delete podcast button
// - View analytics (listen count, engagement)

// API Calls:
// - GET /api/v1/podcasts/:id
// - GET /api/v1/podcasts/:id/episodes?page=
```

**Component Tests:**
- ✅ Loads podcast metadata
- ✅ Displays episodes list
- ✅ Paginates episodes
- ✅ Shows generate button for owner
- ✅ Handles podcast not found

---

## Testing Strategy

### Component Tests (Vitest + React Testing Library)

**Test Structure:**
```typescript
describe("EpisodeCard", () => {
  it("should render episode with correct metadata", () => {
    const episode = {
      id: "ep-1",
      title: "Episode 1",
      status: "ready",
      createdAt: new Date(),
      listenCount: 42,
    };

    render(<EpisodeCard episode={episode} onPlay={vi.fn()} />);

    expect(screen.getByText("Episode 1")).toBeInTheDocument();
    expect(screen.getByText("42 listens")).toBeInTheDocument();
  });

  it("should call onPlay when play button clicked", async () => {
    const onPlay = vi.fn();
    const episode = { ...mockEpisode, status: "ready" };

    render(<EpisodeCard episode={episode} onPlay={onPlay} />);

    await userEvent.click(screen.getByRole("button", { name: /play/i }));

    expect(onPlay).toHaveBeenCalledWith(episode.id);
  });

  it("should disable play button for draft episodes", () => {
    const episode = { ...mockEpisode, status: "draft" };

    render(<EpisodeCard episode={episode} onPlay={vi.fn()} />);

    expect(screen.getByRole("button", { name: /play/i }))
      .toBeDisabled();
  });
});
```

**Coverage Goals:**
- Unit tests: 80%+ for components and services
- Integration tests for page-level flows
- API mocking with MSW (Mock Service Worker)
- WebSocket mocking with custom event emitters

### API Integration Tests

**Approach:**
- Mock API client in tests
- Verify correct endpoints called
- Test error handling (404, 500, timeout)
- Test loading and error states

### E2E User Flows (Manual testing first, Playwright later)

1. **Discover → Create Podcast**
   - User lands on discovery page
   - Clicks "Create Podcast"
   - Fills form, submits
   - Navigates to podcast detail
   - Creates episode (triggers TTS)
   - Sees loading state → ready state
   - Plays episode

2. **Join Live Room → Listen**
   - User sees live room in discovery
   - Clicks "Join"
   - Navigates to room page
   - Connects via WebSocket
   - Sees messages being scored (real-time)
   - Audio streams from Jam
   - Player displays live audio

---

## Component Hierarchy

```
App
├── Layout (Header, Sidebar, Footer)
├── Router
│   ├── DiscoveryPage
│   │   ├── SearchBar
│   │   ├── CategoryFilter
│   │   ├── TrendingSection
│   │   │   ├── EpisodeCard (multiple)
│   │   │   └── EpisodePlayer (modal)
│   │   ├── LiveNowSection
│   │   │   ├── RoomCard (multiple)
│   │   │   └── RoomJoinModal
│   │   └── PodcastsSection
│   │       └── PodcastCard (multiple)
│   │
│   ├── PodcastDetailPage
│   │   ├── PodcastHeader
│   │   ├── SubscribeButton
│   │   ├── GenerateEpisodeButton
│   │   ├── EpisodesList
│   │   │   ├── EpisodeCard (multiple)
│   │   │   └── LoadMoreButton
│   │   └── EpisodePlayer (modal)
│   │
│   ├── CreatePodcastPage
│   │   └── CreatePodcastForm
│   │
│   ├── CreateRoomPage
│   │   └── CreateRoomForm
│   │
│   └── RoomLivePage
│       ├── RoomHeader
│       ├── MessageFeed
│       ├── ParticipantList
│       ├── EpisodePlayer (sticky)
│       └── RoomControls

Services:
├── apiClient
│   ├── createPodcast()
│   ├── getPodcast()
│   ├── generateEpisode()
│   ├── getTrendingPodcasts()
│   └── ...
├── websocketService
│   ├── connect()
│   ├── on(event, callback)
│   ├── emit(event, payload)
│   └── disconnect()
└── authService
    ├── getToken()
    ├── setToken()
    └── refreshToken()
```

---

## Environment Setup

### Install Dependencies

```bash
cd frontend

# Already installed:
npm install

# NEW (if not already present):
npm install @tanstack/react-query    # Data fetching + caching
npm install socket.io-client          # WebSocket client
npm install wavesurfer-js            # Audio waveform visualization
```

### Environment Variables

Add to `frontend/.env.local`:
```bash
VITE_API_URL=http://localhost:4000/api/v1
VITE_WS_URL=ws://localhost:4000
VITE_ENVIRONMENT=development
```

### Vite Configuration

Ensure `frontend/vite.config.ts` includes proxy:
```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
});
```

---

## File Structure (After Week 3)

```
frontend/
├── src/
│   ├── pages/
│   │   ├── DiscoveryPage.tsx        ← NEW
│   │   ├── PodcastDetailPage.tsx    ← NEW
│   │   ├── CreatePodcastPage.tsx    ← NEW
│   │   └── CreateRoomPage.tsx       ← NEW
│   │
│   ├── components/
│   │   ├── cards/
│   │   │   ├── EpisodeCard.tsx      ← NEW
│   │   │   ├── RoomCard.tsx         ← NEW (exists, update)
│   │   │   └── PodcastCard.tsx      ← NEW (exists, update)
│   │   │
│   │   ├── forms/
│   │   │   ├── CreatePodcastForm.tsx   ← NEW
│   │   │   └── CreateRoomForm.tsx      ← NEW
│   │   │
│   │   ├── players/
│   │   │   └── EpisodePlayer.tsx    ← NEW
│   │   │
│   │   ├── discovery/
│   │   │   ├── SearchBar.tsx        ← NEW
│   │   │   ├── CategoryFilter.tsx   ← NEW
│   │   │   └── TrendingSection.tsx  ← NEW
│   │   │
│   │   └── layout/
│   │       ├── Header.tsx           ← NEW (if not exists)
│   │       ├── Sidebar.tsx          ← NEW (if not exists)
│   │       └── Footer.tsx           ← NEW (if not exists)
│   │
│   ├── services/
│   │   ├── api.ts                   ← NEW
│   │   ├── websocket.ts             ← NEW
│   │   └── auth.ts                  ← NEW (if not exists)
│   │
│   ├── types/
│   │   ├── index.ts                 ← NEW
│   │   ├── podcast.ts               ← NEW
│   │   ├── room.ts                  ← NEW
│   │   └── episode.ts               ← NEW
│   │
│   ├── hooks/
│   │   ├── usePodcast.ts            ← NEW
│   │   ├── useEpisode.ts            ← NEW
│   │   ├── useRoom.ts               ← NEW
│   │   └── useWebSocket.ts          ← NEW
│   │
│   ├── utils/
│   │   ├── format.ts                ← NEW (date, duration, numbers)
│   │   └── errors.ts                ← NEW (error handling)
│   │
│   ├── styles/
│   │   ├── globals.css              ← NEW
│   │   └── tailwind.config.ts       ← (exists)
│   │
│   ├── App.tsx
│   └── main.tsx
│
├── tests/
│   ├── unit/
│   │   ├── components/
│   │   │   ├── EpisodeCard.test.tsx
│   │   │   ├── EpisodePlayer.test.tsx
│   │   │   ├── RoomCard.test.tsx
│   │   │   ├── CreatePodcastForm.test.tsx
│   │   │   └── CreateRoomForm.test.tsx
│   │   │
│   │   └── services/
│   │       ├── api.test.ts
│   │       └── websocket.test.ts
│   │
│   ├── integration/
│   │   ├── pages/
│   │   │   ├── DiscoveryPage.test.tsx
│   │   │   └── PodcastDetailPage.test.tsx
│   │   │
│   │   └── flows/
│   │       ├── create-podcast-flow.test.tsx
│   │       └── discover-and-play.test.tsx
│   │
│   └── setup.ts
│
├── vitest.config.ts
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## Success Criteria

### Functional
- ✅ All 5 components render without errors
- ✅ Create podcast form validates and submits
- ✅ Create room form validates and submits
- ✅ Episode player plays audio correctly
- ✅ Discovery page loads trending podcasts
- ✅ WebSocket connects and receives events
- ✅ Category filter works
- ✅ Search debounces and filters

### Quality
- ✅ 25+ component tests passing
- ✅ 10+ integration tests passing
- ✅ 80%+ code coverage for components
- ✅ Zero TypeScript errors
- ✅ ESLint passing
- ✅ Components fully documented with JSDoc

### Performance
- ✅ Discovery page loads in < 1s
- ✅ Audio player starts playing < 500ms after click
- ✅ Form submission < 2s
- ✅ WebSocket connects in < 1s

### UX
- ✅ Loading states visible on all async operations
- ✅ Error messages clear and actionable
- ✅ Mobile responsive (tested on 375px viewport)
- ✅ Dark mode toggle works
- ✅ Keyboard navigation works

---

## Daily Checklist

### Day 1
- [ ] Read this document
- [ ] Install dependencies (react-query, socket.io-client, wavesurfer-js)
- [ ] Create types/index.ts
- [ ] Stub out api.ts service
- [ ] Stub out websocket.ts service
- [ ] Commit: "Setup Week 3 foundation"

### Day 2
- [ ] Complete api.ts (6 methods, error handling)
- [ ] Complete websocket.ts (connect, disconnect, on, off)
- [ ] Create CreatePodcastForm component
- [ ] Write 5 tests for form
- [ ] Commit: "Add API client and form component"

### Day 3
- [ ] Create EpisodePlayer component
- [ ] Create EpisodeCard component
- [ ] Write 8 tests (player + card)
- [ ] Commit: "Add episode components"

### Day 4
- [ ] Create CreateRoomForm component
- [ ] Create RoomCard component
- [ ] Create DiscoveryPage scaffold
- [ ] Write 8 tests
- [ ] Commit: "Add room components and discovery page"

### Day 5
- [ ] Complete DiscoveryPage (search, filter, pagination)
- [ ] Complete PodcastDetailPage
- [ ] Write 4 integration tests
- [ ] Full test run: `npm test`
- [ ] Check coverage: `npm run test:coverage`
- [ ] Commit: "Complete Week 3 frontend integration"

---

## Known Constraints & Workarounds

### WebSocket Connection
- **Issue:** Local development may not have CORS configured for WebSocket
- **Workaround:** Use `http://localhost:4000` directly, no cross-origin needed
- **Production:** Use same domain or configure CORS in backend

### Audio Streaming
- **Issue:** CORS may block audio file fetch from Jam rooms
- **Workaround:** Jar rooms should serve with `Access-Control-Allow-Origin: *`
- **Fallback:** Serve audio URL through backend proxy

### TTS Latency
- **Issue:** ElevenLabs API may take 2-3 seconds per request
- **Workaround:** Show loading state, cache common phrases, queue requests
- **Expected:** Visible latency in UI is acceptable for MVP

### Browser Compatibility
- **Support:** Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
- **Unsupported:** IE 11 (not required for MVP)

---

## Next Phase (Week 4)

Week 4 will focus on:
1. **Analytics Dashboard** — Listen counts, engagement metrics
2. **Agent Profiles** — Specialization, follower system
3. **Advanced Discovery** — Trending algorithm, recommendations
4. **Payment UI** — Micropayment display for gated content
5. **Performance Optimization** — Code splitting, lazy loading

---

## References

- **Backend API:** `API_REFERENCE.md`
- **Architecture:** `AGENTS.md` (CODING STANDARDS section)
- **Orchestrator:** `PHASE_2_EXECUTION_SUMMARY.md`
- **Types:** `common/types/` (if shared types defined)

---

## Support

**If unclear about:**
- Component structure → See component hierarchy above
- API integration → See api.ts stub section
- Testing approach → See Testing Strategy section
- Styling → See Tailwind + shadcn/ui in AGENTS.md

**Slack/Discord:** Tag @frontend-lead for async questions

---

**Week 3 Ready to Launch! 🚀**

**Status:** INITIATED  
**Duration:** 5 days  
**Team:** 1 frontend engineer  
**Estimated Completion:** Feb 24, 2026  

