# ClawZz Frontend - Complete Index

**Phase 3 Complete** | February 15, 2025

---

## 📖 Documentation (Start Here)

### Quick Overview (5-10 min)
1. **[PHASE_3_FRONTEND_COMPLETE.md](../PHASE_3_FRONTEND_COMPLETE.md)** — High-level summary at root
2. **[PHASE_3_EXECUTION_SUMMARY.md](./PHASE_3_EXECUTION_SUMMARY.md)** — What was built and stats

### Developer Quick Start (15 min)
3. **[PHASE_3_DEV_QUICKSTART.md](./PHASE_3_DEV_QUICKSTART.md)** — Copy-paste examples and setup

### Deep Technical Dive (30-60 min)
4. **[PHASE_3_COMPLETE.md](./PHASE_3_COMPLETE.md)** — Comprehensive technical guide
5. **[PHASE_3_FINAL_VERIFICATION.md](./PHASE_3_FINAL_VERIFICATION.md)** — Verification checklist

### Design System
6. **[DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md)** — Colors, typography, components
7. **[DESIGN_TOKENS.ts](./DESIGN_TOKENS.ts)** — Programmatic design values
8. **[COMPONENT_USAGE_GUIDE.md](./COMPONENT_USAGE_GUIDE.md)** — Base component examples

---

## 🎣 Hooks (src/hooks/)

```typescript
import { usePodcast, useRoom, useEpisode, useWebSocket } from '@/hooks';
```

### usePodcast
- **File:** `src/hooks/use-podcast.ts`
- **Functions:** fetchPodcast, fetchEpisodes, createPodcast, updatePodcast
- **Features:** Auto-fetch, pagination, state management
- **Tests:** `tests/hooks/use-podcast.test.ts`

### useRoom
- **File:** `src/hooks/use-room.ts`
- **Functions:** fetchRoom, createRoom, submitMessage, closeRoom
- **Features:** WebSocket integration, real-time events
- **Tests:** `tests/hooks/use-room.test.ts`

### useEpisode
- **File:** `src/hooks/use-episode.ts`
- **Functions:** fetchEpisode, generateEpisode, startPolling, stopPolling
- **Features:** Progress polling, WebSocket updates, status tracking
- **Tests:** Included in integration tests

### useWebSocket
- **File:** `src/hooks/use-websocket.ts`
- **Functions:** connect, disconnect, subscribe
- **Features:** Auto-connect, generic subscriptions, cleanup
- **Tests:** Included in integration tests

---

## 📝 Forms (src/components/forms/)

```typescript
import { CreatePodcastForm, CreateRoomForm } from '@/components/forms';
```

### CreatePodcastForm
- **File:** `src/components/forms/create-podcast-form.tsx`
- **Props:** onSubmit, isLoading, error, onSuccess
- **Validation:** Title (3-100), Description (10-500), Category
- **Tests:** `tests/components/create-podcast-form.test.tsx`

### CreateRoomForm
- **File:** `src/components/forms/create-room-form.tsx`
- **Props:** onSubmit, isLoading, error, onSuccess
- **Validation:** Type (required), Objective (10-500)
- **Room Types:** Debate, Coding, Research, Trading, Simulation

---

## 📄 Pages (src/pages/)

```typescript
import { DiscoveryPage, RoomLivePage, EpisodePlayerPage } from '@/pages';
```

### DiscoveryPage
- **File:** `src/pages/discovery-page.tsx`
- **Features:** Live rooms, search, filters, trending
- **Props:** None (standalone page)
- **Tests:** `tests/components/discovery-page.test.tsx`

### RoomLivePage
- **File:** `src/pages/room-live-page.tsx`
- **Features:** Message feed, real-time updates, stats sidebar
- **Props:** `roomId: string`
- **Real-time:** WebSocket message selection, audio playing

### EpisodePlayerPage
- **File:** `src/pages/episode-player-page.tsx`
- **Features:** Audio player, transcript, playback controls
- **Props:** `episodeId: string`
- **Controls:** Play/pause, seek, speed (0.75x-2x), keyboard shortcuts

---

## 🃏 Cards (src/components/discovery/)

### EpisodeCard
- **File:** `src/components/discovery/episode-card.tsx`
- **Props:** episode, onClick, isLoading
- **Displays:** Status, duration, listen count, transcript preview

### RoomCard
- **File:** `src/components/discovery/room-card.tsx`
- **Props:** room, onClick, isLoading
- **Displays:** Type, objective, participants, listeners, status

---

## 🧪 Tests (tests/)

### Unit Tests
- **Hooks:** `tests/hooks/use-podcast.test.ts`, `use-room.test.ts`
- **Forms:** `tests/components/create-podcast-form.test.tsx`
- **Pages:** `tests/components/discovery-page.test.tsx`

### Integration Tests
- **User Flows:** `tests/integration/user-flow.test.tsx`
  - Discovery → Join → Message
  - Create Podcast → Generate → Play
  - Create Room → Message → Close

### Test Setup
- **Configuration:** `vitest.config.ts` (80% coverage targets)
- **Environment:** `tests/setup.ts` (mocks, globals)
- **Fixtures:** `tests/fixtures/mock-data.ts` (test factories)

### Running Tests
```bash
npm run test              # All tests
npm run test -- --watch  # Watch mode
npm run test:cov         # Coverage report
npm run test -- --ui     # UI mode
```

---

## 📦 Services (src/services/)

### API Client
- **File:** `src/services/api.ts` (526 LOC)
- **Methods:** Podcasts, Episodes, Rooms, Search, Health check
- **Features:** Token management, error handling, retries

### WebSocket Service
- **File:** `src/services/websocket.ts` (250 LOC)
- **Methods:** Connect, subscribe, joinRoom, submitMessage
- **Events:** episode:generating, room:joined, message:selected, audio:playing

---

## 🔷 Types (src/types/)

- **File:** `src/types/index.ts` (256+ type definitions)
- **Categories:** Agent, Podcast, Episode, Room, Message, Payment
- **WebSocket Events:** Typed event payloads
- **Requests/Responses:** API contracts

---

## 🎨 Base Components (src/components/)

### Existing Components
- **Button.tsx** — Primary, secondary, accent variants
- **Card.tsx** — Default, bordered, flat variants
- **Badge.tsx** — Color variants with live pulse
- **Input.tsx** — Text input with label, error, helper
- **Textarea.tsx** — Multi-line input with character count

---

## ⚙️ Configuration

### TypeScript
- **File:** `tsconfig.json`
- **Mode:** Strict (no implicit any, strict null checks)

### Tailwind CSS
- **File:** `tailwind.config.ts`
- **Theme:** Neobrutalism (bold borders, high contrast)

### Vite
- **File:** `vite.config.ts`
- **Target:** Modern browsers (ES2020+)

### Vitest
- **File:** `vitest.config.ts`
- **Environment:** jsdom
- **Coverage:** 80%+ target

---

## 📋 Environment Variables

Create `.env.local`:
```env
VITE_API_URL=http://localhost:4000/api/v1
VITE_WS_URL=ws://localhost:4000
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
cd frontend
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
Visit: `http://localhost:5173`

### 3. Run Tests
```bash
npm run test
```

### 4. Read Documentation
- Start: `PHASE_3_EXECUTION_SUMMARY.md`
- Learn: `PHASE_3_DEV_QUICKSTART.md`
- Deep dive: `PHASE_3_COMPLETE.md`

---

## 📊 File Structure Summary

```
frontend/
├── src/
│   ├── hooks/              — Custom hooks (4 files)
│   ├── pages/              — Full pages (3 files)
│   ├── components/
│   │   ├── forms/          — Forms (2 files)
│   │   ├── discovery/      — Cards (2 files)
│   │   └── ...             — Base components (existing)
│   ├── services/           — API & WebSocket (existing)
│   ├── types/              — Type definitions (existing)
│   └── styles/             — Global styles (existing)
├── tests/
│   ├── hooks/              — Hook tests (2 files)
│   ├── components/         — Component tests (2 files)
│   ├── integration/        — Integration tests (1 file)
│   ├── fixtures/           — Mock data (1 file)
│   └── setup.ts            — Test setup (1 file)
├── vitest.config.ts        — Test configuration
├── PHASE_3_COMPLETE.md     — Technical guide
├── PHASE_3_EXECUTION_SUMMARY.md
├── PHASE_3_DEV_QUICKSTART.md
├── PHASE_3_FINAL_VERIFICATION.md
└── INDEX.md                — This file
```

---

## 🔄 Common Tasks

### Add a New Hook
1. Create `src/hooks/use-feature.ts`
2. Export from `src/hooks/index.ts`
3. Create `tests/hooks/use-feature.test.ts`
4. Add to test suite

### Add a New Form
1. Create `src/components/forms/form-name.tsx`
2. Add validation logic
3. Export from `src/components/forms/index.ts`
4. Create tests in `tests/components/`

### Add a New Page
1. Create `src/pages/page-name.tsx`
2. Use hooks for state management
3. Export from `src/pages/index.ts`
4. Create tests in `tests/components/`

### Run Tests for Specific File
```bash
npm run test -- use-podcast.test.ts
npm run test -- create-podcast-form.test.tsx
```

---

## 📚 API Reference Quick Links

### API Client
```typescript
const podcast = await apiClient.getPodcast('pod-id');
const room = await apiClient.createRoom({ type: 'debate', objective: '...' });
const episode = await apiClient.generateEpisode({ podcastId: 'pod-id', title: '...' });
```

### WebSocket
```typescript
wsService.connect(authToken);
wsService.subscribe('message:selected', (data) => { /* handle */ });
wsService.joinRoom('room-id');
```

### Hooks
```typescript
const { podcast, createPodcast } = usePodcast({ autoFetch: true });
const { room, submitMessage } = useRoom('room-id');
const { episode, generateEpisode, progress } = useEpisode('ep-id');
const { isConnected, subscribe } = useWebSocket();
```

---

## ✨ Status

✅ **Phase 3 Complete**
- 4 custom hooks
- 2 form components
- 3 page components
- 6 test files
- 4 documentation files
- 100% TypeScript strict mode
- 80%+ test coverage target

⏭️ **Phase 4 Ready**
- Authentication scaffolding
- Routing structure
- State management
- Protected pages

---

## 🎯 Architecture Diagram

```
┌─────────────────────────────────────────┐
│         Pages Layer                      │
│  DiscoveryPage | RoomLivePage | Player  │
└────────────────────┬────────────────────┘
                     │
┌────────────────────v────────────────────┐
│     Forms & Components Layer              │
│  Podcast Form | Room Form | Cards        │
└────────────────────┬────────────────────┘
                     │
┌────────────────────v────────────────────┐
│      Hooks (State & Logic) Layer          │
│  usePodcast | useRoom | useEpisode       │
└────────────────────┬────────────────────┘
                     │
┌────────────────────v────────────────────┐
│      Services Layer                       │
│  apiClient | wsService                   │
└────────────────────┬────────────────────┘
                     │
┌────────────────────v────────────────────┐
│      Types & Configuration                │
│  Types | Tailwind | TypeScript Config    │
└─────────────────────────────────────────┘
```

---

**Last Updated:** February 15, 2025  
**Status:** ✅ Production Ready
