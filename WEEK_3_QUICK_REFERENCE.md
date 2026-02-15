# Week 3 Quick Reference Card

**Bookmark this. Read it every morning.**

---

## What Are We Building?

| Day | Component | Type | Lines | Tests |
|-----|-----------|------|-------|-------|
| 1 | ApiClient + WebSocketService | Services | 680 | — |
| 2 | CreatePodcastForm | Form | 150 | 5 |
| 2 | CreateRoomForm | Form | 140 | 5 |
| 3 | EpisodeCard | Card | 100 | 3 |
| 3 | RoomCard | Card | 100 | 3 |
| 3 | EpisodePlayer | Player | 200 | 5 |
| 4 | SearchBar | Input | 80 | 2 |
| 4 | CategoryFilter | Filter | 80 | 2 |
| 4 | TrendingSection | Section | 100 | 2 |
| 5 | DiscoveryPage | Page | 250 | 2 |
| 5 | PodcastDetailPage | Page | 200 | 2 |

**Total:** 11 components, 2+ pages, 30+ tests, 80%+ coverage

---

## Daily Pattern

```typescript
// 1. Component File
📁 src/components/cards/EpisodeCard.tsx
export interface EpisodeCardProps {
  episode: Episode;
  onPlay: (episodeId: string) => void;
}

export function EpisodeCard({ episode, onPlay }: EpisodeCardProps) {
  // JSDoc comment
  // Implementation
  // Return JSX
}

// 2. Test File
📁 src/components/cards/EpisodeCard.test.tsx
describe("EpisodeCard", () => {
  it("should render episode with correct metadata", () => { ... });
  it("should call onPlay when play button clicked", () => { ... });
  it("should disable play button for draft episodes", () => { ... });
});

// 3. Usage (in parent component)
<EpisodeCard episode={episode} onPlay={handlePlay} />
```

---

## API Client Methods (Call These, Not fetch())

### Podcasts
```typescript
apiClient.createPodcast(payload)              // POST /podcasts
apiClient.getPodcast(id)                      // GET /podcasts/:id
apiClient.updatePodcast(id, payload)          // PATCH /podcasts/:id
apiClient.getAgentPodcasts(agentId)           // GET /agents/:agentId/podcasts
apiClient.getTrendingPodcasts(options)        // GET /podcasts/trending
```

### Episodes
```typescript
apiClient.generateEpisode(payload)            // POST /podcasts/:id/episodes
apiClient.getEpisodes(podcastId)              // GET /podcasts/:id/episodes
apiClient.getEpisode(id)                      // GET /episodes/:id
apiClient.getEpisodeStatus(id)                // GET /episodes/:id (poll)
apiClient.distributeEpisode(episodeId)        // POST /episodes/:id/distribute
```

### Rooms
```typescript
apiClient.createRoom(payload)                 // POST /rooms
apiClient.getRoom(id)                         // GET /rooms/:id
apiClient.getLiveRooms(options)               // GET /rooms/live
apiClient.submitMessage(payload)              // POST /rooms/:id/messages
apiClient.scoreMessages(roomId, messages)     // POST /rooms/:id/score-messages
```

### Discovery
```typescript
apiClient.search(query, options)              // GET /search
apiClient.healthCheck()                       // GET /health
```

---

## WebSocket Events (Listen For These)

```typescript
// Episode generation progress
wsService.onEpisodeGenerating((data) => {
  console.log(`Progress: ${data.progress}%`);
});

// Episode ready with audio URL
wsService.onEpisodeReady((data) => {
  console.log(`Audio ready: ${data.audioUrl}`);
});

// Episode generation failed
wsService.onEpisodeFailed((data) => {
  console.log(`Error: ${data.error}`);
});

// Room created
wsService.onRoomCreated((data) => {
  console.log(`Room ${data.roomId} started`);
});

// Agent joined room
wsService.onRoomJoined((data) => {
  console.log(`${data.participantCount} participants now`);
});

// Orchestrator selected a message
wsService.onMessageSelected((data) => {
  console.log(`Selected: ${data.score}/100`);
});

// Audio starting to play
wsService.onAudioPlaying((data) => {
  console.log(`Playing audio: ${data.audioUrl}`);
});
```

---

## Type Definitions (Import From types/index.ts)

```typescript
import {
  Podcast,
  Episode,
  Room,
  Agent,
  Message,
  ApiError,
  EpisodeStatus,          // "draft" | "generating" | "ready" | "failed"
  RoomType,               // "debate" | "coding" | "research" | "trading" | "simulation"
  CreatePodcastRequest,
  CreateEpisodeRequest,
  CreateRoomRequest,
  PaginatedResponse,
} from "../types";
```

---

## Component Template

```typescript
import { useState, useCallback } from "react";
import { apiClient } from "../../services/api";
import { Episode } from "../../types";

/**
 * EpisodeCard displays episode metadata and controls
 * 
 * Props:
 * - episode: Episode object from API
 * - onPlay: Callback when play button clicked
 * 
 * Usage:
 * <EpisodeCard episode={ep} onPlay={handlePlay} />
 */
export interface EpisodeCardProps {
  episode: Episode;
  onPlay: (episodeId: string) => void;
}

export function EpisodeCard({ episode, onPlay }: EpisodeCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePlayClick = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      onPlay(episode.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, [episode.id, onPlay]);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="font-bold">{episode.title}</h3>
      <p className="text-gray-600">{episode.listenCount} listens</p>
      
      {error && <p className="text-red-500">{error}</p>}
      
      <button
        onClick={handlePlayClick}
        disabled={isLoading || episode.status !== "ready"}
        className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {isLoading ? "Loading..." : "Play"}
      </button>
    </div>
  );
}
```

---

## Testing Template

```typescript
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { EpisodeCard } from "./EpisodeCard";
import { Episode } from "../../types";

const mockEpisode: Episode = {
  id: "ep-1",
  podcastId: "pod-1",
  title: "Episode 1",
  status: "ready",
  audioUrl: "https://...",
  listenCount: 42,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("EpisodeCard", () => {
  it("should render episode with correct metadata", () => {
    const onPlay = vi.fn();
    
    render(<EpisodeCard episode={mockEpisode} onPlay={onPlay} />);
    
    expect(screen.getByText("Episode 1")).toBeInTheDocument();
    expect(screen.getByText("42 listens")).toBeInTheDocument();
  });

  it("should call onPlay when play button clicked", async () => {
    const onPlay = vi.fn();
    const user = userEvent.setup();
    
    render(<EpisodeCard episode={mockEpisode} onPlay={onPlay} />);
    await user.click(screen.getByRole("button", { name: /play/i }));
    
    expect(onPlay).toHaveBeenCalledWith("ep-1");
  });

  it("should disable play button for draft episodes", () => {
    const onPlay = vi.fn();
    const draftEpisode = { ...mockEpisode, status: "draft" as const };
    
    render(<EpisodeCard episode={draftEpisode} onPlay={onPlay} />);
    
    expect(screen.getByRole("button", { name: /play/i }))
      .toBeDisabled();
  });
});
```

---

## Common Patterns

### Handle API Errors
```typescript
try {
  const podcast = await apiClient.createPodcast(payload);
  setSuccess("Podcast created!");
} catch (error) {
  if (error instanceof ApiClientError) {
    setError(error.message); // User-friendly message
    console.error(error.context); // Developer debugging
  } else {
    setError("Unknown error occurred");
  }
}
```

### Use WebSocket Events
```typescript
useEffect(() => {
  // Subscribe to event
  const unsubscribe = wsService.onEpisodeReady((data) => {
    setAudioUrl(data.audioUrl);
  });

  // Cleanup: unsubscribe when component unmounts
  return () => unsubscribe();
}, []);
```

### Fetch Paginated Data
```typescript
const [episodes, setEpisodes] = useState<Episode[]>([]);
const [page, setPage] = useState(1);

useEffect(() => {
  apiClient
    .getEpisodes(podcastId, { page, limit: 20 })
    .then((response) => {
      if (page === 1) {
        setEpisodes(response.items);
      } else {
        setEpisodes((prev) => [...prev, ...response.items]);
      }
    })
    .catch(setError);
}, [podcastId, page]);
```

### Debounce Search
```typescript
const [query, setQuery] = useState("");
const [results, setResults] = useState([]);

useEffect(() => {
  const timer = setTimeout(() => {
    if (query.length > 0) {
      apiClient.search(query).then(setResults);
    }
  }, 300); // Wait 300ms after user stops typing

  return () => clearTimeout(timer);
}, [query]);
```

---

## Naming Conventions

**Components:** PascalCase
```typescript
EpisodeCard, CreatePodcastForm, DiscoveryPage
```

**Functions:** camelCase
```typescript
handlePlayClick, fetchEpisodes, submitForm
```

**Constants:** UPPER_SNAKE_CASE
```typescript
MAX_TITLE_LENGTH = 100
DEFAULT_PAGE_SIZE = 20
```

**Files:** kebab-case
```typescript
episode-card.tsx
create-podcast-form.tsx
discovery-page.tsx
```

---

## Styling (Tailwind + shadcn/ui)

```typescript
// Button
<button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
  Click me
</button>

// Card
<div className="bg-white rounded-lg shadow p-4">
  Content
</div>

// Grid
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map((item) => <Card key={item.id} item={item} />)}
</div>

// Loading spinner
<div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" />

// Error message
<p className="text-red-500 text-sm">{error}</p>

// Success message
<p className="text-green-500 text-sm">{success}</p>
```

---

## Git Workflow

```bash
# Create branch for week
git checkout -b week/3-frontend-integration

# Daily: Stage changes
git add frontend/src/components/...
git add frontend/src/services/...

# Daily: Commit with message
git commit -m "Week 3 Day 2: Add form components

- Create CreatePodcastForm component
- Create CreateRoomForm component
- Add Zod validation schemas
- Write 10+ component tests
- Test coverage: 85%+"

# End of week: Push to origin
git push origin week/3-frontend-integration

# Merge to main
git checkout main
git merge week/3-frontend-integration
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Import error on types | `import { Podcast } from "../types"` |
| API returns 404 | Check podcastId is correct, podcast exists |
| WebSocket not connecting | Verify VITE_WS_URL, backend running |
| Component test fails | Mock API with vi.mock(), use userEvent |
| TypeScript error | Add explicit type annotation, never use `any` |
| ESLint error | Run `npm run lint -- --fix` |
| Tailwind not working | Ensure `tailwind.config.ts` configured |

---

## Success Checklist (End of Day)

Before committing, verify:
- [ ] Component renders without errors
- [ ] Props match TypeScript interface
- [ ] Calls correct API method (not fetch())
- [ ] Error handling implemented
- [ ] Loading state shown to user
- [ ] Tests written and passing
- [ ] JSDoc comment present
- [ ] No ESLint errors
- [ ] No TypeScript errors
- [ ] Git commit has clear message

---

## References

**Read:**
1. `WEEK_3_FRONTEND_LAUNCH.md` — Detailed specs
2. `AGENTS.md` (CODING STANDARDS) — Code style
3. `API_REFERENCE.md` — Endpoint docs

**Bookmark:**
1. Tailwind CSS: https://tailwindcss.com/docs
2. React Testing Library: https://testing-library.com/docs/react-testing-library/intro/
3. TypeScript Handbook: https://www.typescriptlang.org/docs/

---

**Print this. Keep it on your desk. Refer to it every morning.**

Generated: February 20, 2026  
Phase: Week 3 of 10  
Status: 🟢 Ready to use
