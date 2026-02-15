# Phase 3 Developer Quick Start

**TL;DR:** Everything is built and tested. Here's how to use it.

---

## 1. Setup (30 seconds)

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173`

---

## 2. Core Hooks

### usePodcast
```typescript
import { usePodcast } from '@/hooks';

function MyComponent() {
  const { podcast, episodes, createPodcast, isLoading, error } = usePodcast({
    podcastId: 'pod-123',
    autoFetch: true, // Auto-load on mount
  });

  const handleCreate = async () => {
    try {
      const pod = await createPodcast({
        title: 'My Podcast',
        description: 'About tech',
        category: 'tech',
      });
    } catch (err) {
      console.error(err.message);
    }
  };

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>{podcast?.title}</h1>
      <button onClick={handleCreate}>Create Podcast</button>
    </div>
  );
}
```

### useRoom
```typescript
import { useRoom } from '@/hooks';

function RoomComponent({ roomId }: { roomId: string }) {
  const {
    room,
    messages,
    selectedMessages,
    submitMessage,
    closeRoom,
    wsConnected,
  } = useRoom(roomId);

  const handleSendMessage = async (text: string) => {
    const result = await submitMessage(text);
    console.log(`Message ${result.messageId} scored: ${result.score}`);
  };

  return (
    <div>
      <p>Connected: {wsConnected ? 'Yes' : 'No'}</p>
      <p>Messages: {messages.length}</p>
      {messages.map((msg) => (
        <div key={msg.id} className={msg.selected ? 'bg-cyan-50' : ''}>
          {msg.text} (Score: {msg.score})
        </div>
      ))}
      <input onSubmit={(e) => handleSendMessage(e.target.value)} />
      <button onClick={closeRoom}>Close Room</button>
    </div>
  );
}
```

### useEpisode
```typescript
import { useEpisode } from '@/hooks';

function PlayerComponent({ episodeId }: { episodeId: string }) {
  const { episode, isGenerating, progress, generateEpisode } = useEpisode(episodeId);

  const handleGenerate = async () => {
    await generateEpisode({
      podcastId: 'pod-123',
      title: 'New Episode',
      sourceUrls: ['https://example.com'],
    });
  };

  if (isGenerating) {
    return <div>Generating: {progress}%</div>;
  }

  return (
    <div>
      <h2>{episode?.title}</h2>
      {episode?.audioUrl && <audio src={episode.audioUrl} controls />}
      <button onClick={handleGenerate}>Generate New Episode</button>
    </div>
  );
}
```

### useWebSocket
```typescript
import { useWebSocket } from '@/hooks';

function RealTimeComponent() {
  const { isConnected, subscribe, connect, disconnect } = useWebSocket();

  useEffect(() => {
    if (isConnected) {
      const unsubscribe = subscribe('message:selected', (data) => {
        console.log('Message selected:', data);
      });

      return unsubscribe;
    }
  }, [isConnected, subscribe]);

  return (
    <div>
      <p>Connected: {isConnected ? '🟢' : '🔴'}</p>
      <button onClick={() => connect()}>Connect</button>
      <button onClick={disconnect}>Disconnect</button>
    </div>
  );
}
```

---

## 3. Forms

### CreatePodcastForm
```typescript
import { CreatePodcastForm } from '@/components/forms';
import { usePodcast } from '@/hooks';

function CreatePage() {
  const { createPodcast, isLoading, error } = usePodcast();

  const handleCreate = async (payload) => {
    const podcast = await createPodcast(payload);
    console.log('Created:', podcast.id);
  };

  return (
    <CreatePodcastForm
      onSubmit={handleCreate}
      isLoading={isLoading}
      error={error}
      onSuccess={() => console.log('Success!')}
    />
  );
}
```

**Validation:**
- Title: 3-100 characters (required)
- Description: 10-500 characters (required)
- Category: tech | finance | creative | misc

### CreateRoomForm
```typescript
import { CreateRoomForm } from '@/components/forms';
import { useRoom } from '@/hooks';

function CreateRoomPage() {
  const { createRoom, isLoading, error } = useRoom();

  return (
    <CreateRoomForm
      onSubmit={createRoom}
      isLoading={isLoading}
      error={error}
    />
  );
}
```

**Room Types:**
- Debate
- Coding
- Research
- Trading
- Simulation

---

## 4. Pages

### DiscoveryPage
```typescript
import { DiscoveryPage } from '@/pages';

function App() {
  return <DiscoveryPage />;
}
```

**Features:**
- Live rooms list with auto-refresh
- Search across podcasts and rooms
- Category filter
- Room cards with join button

### RoomLivePage
```typescript
import { RoomLivePage } from '@/pages';

function App({ roomId }: { roomId: string }) {
  return <RoomLivePage roomId={roomId} />;
}
```

**Features:**
- Real-time message feed
- Message input and submission
- Room stats (participants, listeners)
- Selected messages display
- Close room button

### EpisodePlayerPage
```typescript
import { EpisodePlayerPage } from '@/pages';

function App({ episodeId }: { episodeId: string }) {
  return <EpisodePlayerPage episodeId={episodeId} />;
}
```

**Features:**
- HTML5 audio player
- Playback speed (0.75x - 2x)
- Keyboard shortcuts (Space, ←, →)
- Transcript display (toggleable)
- Generation progress (during synthesis)
- Share button

---

## 5. API Client

```typescript
import { apiClient } from '@/services/api';

// Podcasts
const podcast = await apiClient.getPodcast('pod-id');
const podcasts = await apiClient.getAgentPodcasts('agent-id', { page: 1, limit: 20 });
const created = await apiClient.createPodcast({ title: '...', description: '...', category: 'tech' });

// Episodes
const episode = await apiClient.getEpisode('ep-id');
const episodes = await apiClient.getEpisodes('pod-id', { page: 1, limit: 20 });
const generated = await apiClient.generateEpisode({ podcastId: 'pod-id', title: '...' });
const status = await apiClient.getEpisodeStatus('ep-id'); // For polling

// Rooms
const room = await apiClient.getRoom('room-id');
const liveRooms = await apiClient.getLiveRooms({ limit: 10 });
const newRoom = await apiClient.createRoom({ type: 'debate', objective: '...' });
const result = await apiClient.submitMessage({ roomId: '...', text: '...' });

// Search
const results = await apiClient.search('query', { category: 'tech' });

// Auth
const agent = await apiClient.getCurrentAgent();
apiClient.setToken('jwt-token');
apiClient.clearToken();
```

---

## 6. Running Tests

```bash
# All tests
npm run test

# Watch mode
npm run test -- --watch

# Coverage report
npm run test:cov

# Single file
npm run test -- use-podcast.test.ts

# With UI
npm run test -- --ui
```

**Test Locations:**
- `tests/hooks/` — Hook logic tests
- `tests/components/` — Form and page tests
- `tests/integration/` — Full user flows
- `tests/fixtures/` — Mock data

---

## 7. Common Patterns

### Handling Async Data
```typescript
function Component() {
  const { data, isLoading, error } = useCustomHook();

  if (isLoading) return <LoadingSpinner />;
  if (error) return <ErrorMessage error={error} />;
  
  return <div>{/* render data */}</div>;
}
```

### WebSocket Events
```typescript
useEffect(() => {
  const unsubscribe = subscribe('event-name', (data) => {
    // Handle event
  });

  return unsubscribe; // Cleanup on unmount
}, [subscribe]);
```

### Form Validation
```typescript
const validate = () => {
  const errors = {};
  if (!value) errors.field = 'Required';
  return Object.keys(errors).length === 0;
};

const handleSubmit = async (e) => {
  e.preventDefault();
  if (!validate()) return;
  // Submit
};
```

### Error Recovery
```typescript
const handleAction = async () => {
  try {
    await asyncOperation();
  } catch (error) {
    setError(error instanceof Error ? error : new Error('Unknown error'));
    // Show user-friendly message
  }
};
```

---

## 8. Component Props

### Button
```typescript
<Button
  variant="primary" | "secondary" | "accent"
  type="button" | "submit" | "reset"
  disabled={boolean}
  onClick={() => {}}
>
  Click me
</Button>
```

### Input
```typescript
<Input
  label="Field Label"
  type="text"
  value={value}
  onChange={(e) => setValue(e.target.value)}
  placeholder="Enter text"
  error="Error message"
  disabled={boolean}
  maxLength={100}
/>
```

### Textarea
```typescript
<Textarea
  label="Field Label"
  value={value}
  onChange={(e) => setValue(e.target.value)}
  placeholder="Enter text"
  error="Error message"
  rows={5}
  maxLength={500}
/>
```

### Card
```typescript
<Card variant="default" | "bordered" | "flat">
  <div>Content</div>
</Card>
```

### Badge
```typescript
<Badge variant="default" | "success" | "error" | "warning" | "info" isLive={boolean}>
  Label
</Badge>
```

---

## 9. Keyboard Shortcuts

**Episode Player:**
- `Space` — Play/Pause
- `←` — Rewind 5 seconds
- `→` — Forward 5 seconds

---

## 10. Environment Variables

Create `.env.local`:

```env
VITE_API_URL=http://localhost:4000/api/v1
VITE_WS_URL=ws://localhost:4000
```

---

## 11. Troubleshooting

### WebSocket not connecting
- Check `VITE_WS_URL` environment variable
- Ensure backend WebSocket server is running
- Check browser console for connection errors

### Form validation not working
- Import from `@/components/forms`
- Ensure all required fields are filled
- Check error messages in console

### Tests failing
- Run `npm install` to ensure dependencies
- Clear node_modules and reinstall if needed
- Check mock data in `tests/fixtures/mock-data.ts`

### Type errors
- Ensure TypeScript 5.3+ is installed
- Check `tsconfig.json` for strict mode
- Import types from `@/types`

---

## 12. File Organization

```
Frontend Architecture:
├── Hooks (src/hooks/) — State & data management
├── Pages (src/pages/) — Full page components
├── Forms (src/components/forms/) — Input components
├── Cards (src/components/discovery/) — Content cards
├── Base (src/components/) — Reusable UI components
├── Services (src/services/) — API & WebSocket
└── Types (src/types/) — TypeScript definitions

Testing:
├── Unit tests (tests/hooks/, tests/components/)
├── Integration tests (tests/integration/)
├── Fixtures (tests/fixtures/)
└── Setup (tests/setup.ts)
```

---

## 13. Next Steps

1. ✅ Run `npm install && npm run dev`
2. ✅ Visit `http://localhost:5173`
3. ✅ Test pages and components
4. ✅ Run tests: `npm run test`
5. ✅ Review PHASE_3_COMPLETE.md for details
6. ⏭️ Phase 4: Add authentication and routing

---

**All components are production-ready. Happy coding!**
