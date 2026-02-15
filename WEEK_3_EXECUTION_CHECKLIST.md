# Week 3: Neobrutalism Design System & Frontend Execution

**Status:** 🟢 **DESIGN SYSTEM FOUNDATION COMPLETE**  
**Date:** February 15, 2026  
**Phase:** Frontend Integration & Discovery Launch

---

## Completed Tasks ✅

### Design System Foundation
- [x] **Tailwind Config** (`tailwind.config.ts`)
  - Custom color palette (black, white, cyan, magenta, yellow)
  - Typography scale (Space Grotesk, Inter, JetBrains Mono)
  - Spacing system (0.25rem increments)
  - Animations (fade-in, slide-up, glitch, etc.)
  - Component utility classes

- [x] **PostCSS Config** (`postcss.config.js`)
  - Tailwind CSS processing
  - Autoprefixer for browser support

- [x] **Global CSS** (`src/styles/globals.css`)
  - Typography hierarchy (H1-H6 with aggressive sizing)
  - Form elements (input, textarea, select)
  - Base components (badge, spinner, toast, modal)
  - Responsive breakpoints (mobile-first)
  - Dark mode support
  - Print styles

- [x] **Design System Documentation** (`DESIGN_SYSTEM.md`)
  - Color palette reference
  - Typography guidelines
  - Spacing system
  - Border & shadow specifications
  - Component patterns
  - Accessibility standards
  - Dark mode implementation
  - Animation guidelines

### Component Library (Neobrutalism Style)
- [x] **Button Component** (`src/components/Button.tsx`)
  - 3 variants: primary (black), secondary (white), accent (cyan)
  - 3 sizes: sm, md, lg
  - Hover and active states
  - Loading state with spinner
  - Disabled state
  - Full TypeScript typing

- [x] **Card Component** (`src/components/Card.tsx`)
  - 3 variants: default, bordered, flat
  - 3 padding options: sm, md, lg
  - Optional click interaction
  - Glow effect on hover

- [x] **Badge Component** (`src/components/Badge.tsx`)
  - 6 color variants (default, primary, secondary, success, warning, error)
  - Live indicator with pulse animation
  - Uppercase text with letter-spacing
  - Minimal border styling

- [x] **Input Component** (`src/components/Input.tsx`)
  - Text, email, password, number, search types
  - Label support with required indicator
  - Error state with red border
  - Helper text below field
  - Focus state with cyan border
  - Disabled state

- [x] **Textarea Component** (`src/components/Textarea.tsx`)
  - Multi-line text input
  - Character count display
  - Max length support
  - Error and helper text
  - Min height with resizable
  - Accessibility features

- [x] **Component Exports** (`src/components/index.ts`)
  - Central export point
  - Type re-exports
  - Easy imports for pages

### App Update
- [x] **Updated App.tsx**
  - Import new design system
  - Use component library
  - Display color palette
  - Show button variants
  - Demonstrate typography scale
  - Live API status badge
  - Phase 3 launch messaging

---

## Next Tasks (Days 2-5)

### Day 2-3: Services & Type Definitions
- [ ] Create `src/types/index.ts` (shared types)
  - Podcast, Episode, Room, Agent, Message, Score types
  - Import from common/ if shared

- [ ] Create `src/services/api.ts` (API Client)
  - Axios wrapper with interceptors
  - JWT token refresh logic
  - Base URL from env
  - Error handling with custom errors
  - Methods:
    - `createPodcast(payload)`
    - `getPodcast(id)`
    - `generateEpisode(podcastId, title)`
    - `getEpisodeStatus(episodeId)`
    - `getTrendingPodcasts(category?, limit?)`
    - `getAgentPodcasts(agentId, page?, limit?)`

- [ ] Create `src/services/websocket.ts` (Real-time Service)
  - Socket.io client initialization
  - Event listeners for:
    - `episode:generating`
    - `episode:ready`
    - `episode:failed`
    - `room:created`
    - `room:joined`
    - `message:selected`
    - `audio:playing`
  - Methods: `connect()`, `disconnect()`, `on()`, `off()`, `emit()`

- [ ] Create `src/hooks/` directory with React hooks
  - `usePodcast.ts` (fetch podcast)
  - `useEpisode.ts` (fetch episode)
  - `useRoom.ts` (fetch room)
  - `useWebSocket.ts` (connect to socket)

### Day 3-4: Form Components
- [ ] **CreatePodcastForm** (`src/components/forms/CreatePodcastForm.tsx`)
  - Title input (required, max 100 chars)
  - Description textarea (max 500 chars)
  - Category dropdown
  - Submit button with loading state
  - Validation with Zod
  - Error display
  - Toast notification on success
  - Navigate to podcast detail page

- [ ] **CreateRoomForm** (`src/components/forms/CreateRoomForm.tsx`)
  - Room type selector (radio buttons: Debate, Coding, Research, Trading, Simulation)
  - Objective textarea (required, max 500 chars)
  - Optional constraints JSON editor
  - Submit button
  - Validation
  - Navigate to live room page

### Day 4-5: Content & Discovery Pages
- [ ] **EpisodeCard** (`src/components/cards/EpisodeCard.tsx`)
  - Episode title
  - Status badge (draft, generating, ready, failed)
  - Play button
  - Download link
  - Created date
  - Listen count
  - Clickable for details
  - Right-click context menu

- [ ] **RoomCard** (`src/components/cards/RoomCard.tsx`)
  - Room objective (title)
  - Room type badge
  - Host agent name
  - Participant/listener count
  - Duration elapsed
  - Last message preview
  - Join button
  - Click to navigate

- [ ] **EpisodePlayer** (`src/components/players/EpisodePlayer.tsx`)
  - HTML5 audio element
  - Play/pause button
  - Progress bar (seek)
  - Volume slider
  - Playback speed (1x, 1.25x, 1.5x, 2x)
  - Download button
  - Share button
  - Waveform visualization (wavesurfer-js)
  - Keyboard shortcuts (space, M, F)
  - Auto-play next episode
  - Sticky on scroll

- [ ] **DiscoveryPage** (`src/pages/DiscoveryPage.tsx`)
  - Search bar (debounced)
  - Category filter dropdown
  - Trending section (EpisodeCards)
  - Live now section (RoomCards)
  - Infinite scroll pagination
  - Pull-to-refresh on mobile
  - Loading states
  - Error handling
  - Real-time listener count updates

- [ ] **PodcastDetailPage** (`src/pages/PodcastDetailPage.tsx`)
  - Podcast header (title, description, metadata)
  - Episodes list
  - Episode cards with player
  - Subscribe button
  - Share options

- [ ] **RoomLivePage** (`src/pages/RoomLivePage.tsx`)
  - Room header (objective, type, duration)
  - Message feed (real-time)
  - Participant list with avatars
  - Episode player (sticky)
  - Room controls (if host)
  - WebSocket integration

### Day 5: Testing & Polish
- [ ] Component tests (Vitest + React Testing Library)
  - Button component tests (variants, sizes, loading, disabled)
  - Card component tests (variants, padding, clickable)
  - Badge component tests (variants, live state)
  - Input/Textarea tests (value, error, helper text)
  - Form component tests (validation, submission, errors)
  - Page integration tests

- [ ] API integration tests
  - Mock API responses
  - Error handling
  - Loading states

- [ ] WebSocket mock tests
  - Event emission
  - Connection/disconnection
  - Event listeners

- [ ] Coverage report
  - Target: 80%+ coverage
  - Run: `npm run test:cov`

- [ ] Performance audit
  - Discovery page load time < 1s
  - Audio player start < 500ms
  - Form submission < 2s
  - WebSocket connect < 1s

- [ ] Accessibility audit
  - Contrast ratios (WebAIM)
  - Keyboard navigation (Tab, Enter, Escape)
  - Screen reader testing
  - Focus indicators

- [ ] Responsive testing
  - Mobile (375px)
  - Tablet (768px)
  - Desktop (1024px+)

- [ ] ESLint & Prettier
  - Run: `npm run lint`
  - Run: `npm run format`

---

## Files to Create Summary

```
frontend/
├── tailwind.config.ts                    ✅ DONE
├── postcss.config.js                     ✅ DONE
├── DESIGN_SYSTEM.md                      ✅ DONE
│
├── src/
│   ├── styles/
│   │   └── globals.css                   ✅ DONE
│   │
│   ├── components/
│   │   ├── Button.tsx                    ✅ DONE
│   │   ├── Card.tsx                      ✅ DONE
│   │   ├── Badge.tsx                     ✅ DONE
│   │   ├── Input.tsx                     ✅ DONE
│   │   ├── Textarea.tsx                  ✅ DONE
│   │   ├── index.ts                      ✅ DONE
│   │   ├── forms/
│   │   │   ├── CreatePodcastForm.tsx     ⏳ TODO
│   │   │   └── CreateRoomForm.tsx        ⏳ TODO
│   │   ├── cards/
│   │   │   ├── EpisodeCard.tsx           ⏳ TODO
│   │   │   ├── RoomCard.tsx              ⏳ TODO
│   │   │   └── PodcastCard.tsx           ⏳ TODO
│   │   ├── players/
│   │   │   └── EpisodePlayer.tsx         ⏳ TODO
│   │   └── discovery/
│   │       ├── SearchBar.tsx             ⏳ TODO
│   │       ├── CategoryFilter.tsx        ⏳ TODO
│   │       └── TrendingSection.tsx       ⏳ TODO
│   │
│   ├── pages/
│   │   ├── DiscoveryPage.tsx             ⏳ TODO
│   │   ├── PodcastDetailPage.tsx         ⏳ TODO
│   │   ├── CreatePodcastPage.tsx         ⏳ TODO
│   │   └── CreateRoomPage.tsx            ⏳ TODO
│   │
│   ├── services/
│   │   ├── api.ts                        ⏳ TODO
│   │   ├── websocket.ts                  ⏳ TODO
│   │   └── auth.ts                       ⏳ TODO
│   │
│   ├── hooks/
│   │   ├── usePodcast.ts                 ⏳ TODO
│   │   ├── useEpisode.ts                 ⏳ TODO
│   │   ├── useRoom.ts                    ⏳ TODO
│   │   └── useWebSocket.ts               ⏳ TODO
│   │
│   ├── types/
│   │   ├── index.ts                      ⏳ TODO
│   │   ├── podcast.ts                    ⏳ TODO
│   │   ├── room.ts                       ⏳ TODO
│   │   └── episode.ts                    ⏳ TODO
│   │
│   ├── utils/
│   │   ├── format.ts                     ⏳ TODO
│   │   └── errors.ts                     ⏳ TODO
│   │
│   ├── App.tsx                           ✅ UPDATED
│   └── main.tsx
│
└── tests/
    ├── unit/components/
    │   ├── Button.test.tsx                ⏳ TODO
    │   ├── Card.test.tsx                  ⏳ TODO
    │   ├── Badge.test.tsx                 ⏳ TODO
    │   ├── Input.test.tsx                 ⏳ TODO
    │   ├── Textarea.test.tsx              ⏳ TODO
    │   ├── CreatePodcastForm.test.tsx     ⏳ TODO
    │   ├── CreateRoomForm.test.tsx        ⏳ TODO
    │   ├── EpisodeCard.test.tsx           ⏳ TODO
    │   ├── RoomCard.test.tsx              ⏳ TODO
    │   └── EpisodePlayer.test.tsx         ⏳ TODO
    │
    ├── unit/services/
    │   ├── api.test.ts                    ⏳ TODO
    │   └── websocket.test.ts              ⏳ TODO
    │
    ├── integration/
    │   ├── DiscoveryPage.test.tsx         ⏳ TODO
    │   └── PodcastDetailPage.test.tsx     ⏳ TODO
    │
    └── setup.ts                           ⏳ TODO
```

---

## Running the Frontend

### Install Dependencies
```bash
cd frontend
npm install
```

### Development Server
```bash
npm run dev
# Open http://localhost:3000
```

### Build for Production
```bash
npm run build
```

### Run Tests
```bash
npm test                    # Run all tests
npm run test:cov           # With coverage report
```

### Linting & Formatting
```bash
npm run lint               # Check for linting errors
npm run format             # Auto-format code
```

---

## Success Criteria

### Functional ✅
- All base components render without errors
- Design system demonstrates all color variants
- Button, Card, Badge components work correctly
- App loads and connects to API

### Quality
- Zero TypeScript errors (strict mode)
- ESLint passing
- Components documented with JSDoc
- Component tests passing (80%+ coverage)

### Design
- Neobrutalism aesthetic applied
- High contrast (black/white/cyan)
- Bold typography hierarchy
- Consistent spacing and borders
- Dark mode functional

### Performance
- Page load < 1s
- Components render snappy (< 300ms)
- No console errors

---

## Neobrutalism Design Principles Applied

✅ **Bold Typography** — Space Grotesk for headings, uppercase labels, letter-spacing  
✅ **High Contrast** — Pure black (#000) and white (#fff) with electric accents  
✅ **Strong Borders** — 2px black borders instead of shadows  
✅ **Minimal Embellishment** — No gradients, drop shadows, or rounded corners (0px by default)  
✅ **Industrial Aesthetic** — Raw edges, utilitarian, unapologetic design  
✅ **Electric Accents** — Cyan (#0EA5E9), Magenta (#EC4899), Yellow (#F59E0B) for interaction  
✅ **Snappy Interactions** — Fast animations (< 0.5s), instant feedback  
✅ **Accessibility First** — WCAG AA contrast, keyboard navigation, screen reader support

---

## References

- **Design System:** `DESIGN_SYSTEM.md`
- **Frontend Plan:** `WEEK_3_FRONTEND_LAUNCH.md`
- **API Reference:** `API_REFERENCE.md`
- **Tailwind CSS:** https://tailwindcss.com/
- **Neobrutalism:** https://www.are.na/search/neobrutalism

---

**Ready for Day 2 Execution! 🚀**

Next: Services & Type Definitions
