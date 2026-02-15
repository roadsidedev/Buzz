# Week 3, Day 1: Foundation Setup Checklist

**Date:** February 20, 2026  
**Focus:** Services, Types, Dependencies  
**Status:** Ready to start

---

## Morning (1-2 hours)

### [ ] 1. Read Documentation
- [ ] Read `WEEK_3_FRONTEND_LAUNCH.md` (20 min)
  - Understand deliverables, timeline, architecture
  - Review component hierarchy
  - Note success criteria

- [ ] Read `API_REFERENCE.md` (10 min)
  - Understand all 9 podcast endpoints
  - Note request/response formats
  - Check error codes

### [ ] 2. Environment Setup
- [ ] Open terminal in `frontend/` directory
- [ ] Run `npm install` (to ensure all deps installed)
- [ ] Verify Vite dev server can start: `npm run dev`
  - Should see "Local: http://localhost:5173"
  - Leave running in separate terminal

### [ ] 3. Install New Dependencies
```bash
cd frontend
npm install @tanstack/react-query@5.28.0
npm install socket.io-client@4.7.2
npm install wavesurfer-js@6.3.0
```

- [ ] Verify no errors in npm output
- [ ] Check `package-lock.json` updated

### [ ] 4. Environment Variables
- [ ] Create `frontend/.env.local`:
```bash
VITE_API_URL=http://localhost:4000/api/v1
VITE_WS_URL=ws://localhost:4000
VITE_ENVIRONMENT=development
```

- [ ] Verify `.env.local` is in `.gitignore`

---

## Mid-Day (2-3 hours)

### [ ] 5. Code Review: Services Created
Files created in this session:
1. ✅ `frontend/src/types/index.ts` (250 lines)
2. ✅ `frontend/src/services/api.ts` (480 lines)
3. ✅ `frontend/src/services/websocket.ts` (200 lines)

For each file:
- [ ] Open and read through
- [ ] Understand imports and exports
- [ ] Note method signatures
- [ ] Check JSDoc comments

### [ ] 6. Verify TypeScript Compilation
```bash
cd frontend
npx tsc --noEmit
```
- [ ] Zero TypeScript errors
- [ ] No implicit any warnings

### [ ] 7. Update Vite Config (if needed)
- [ ] Check `frontend/vite.config.ts` for proxy setup
- [ ] Ensure API proxy configured:
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:4000',
      changeOrigin: true,
    },
  },
}
```

---

## Afternoon (2-3 hours)

### [ ] 8. Backend Verification
Before proceeding with components, verify backend is running:

```bash
# In another terminal
curl -X GET http://localhost:4000/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-20T...",
  "orchestrator": true
}
```

- [ ] Health check passes
- [ ] Orchestrator connection confirmed

### [ ] 9. API Client Testing (Manual)
Create temporary test file to verify API client works:

**Create `frontend/src/test-api.ts`:**
```typescript
import { apiClient } from "./services/api";

// Test if API client can initialize
console.log("API Client initialized");
console.log("Base URL:", apiClient.getToken());

// Try health check
apiClient.healthCheck().then(result => {
  console.log("Health check:", result);
}).catch(error => {
  console.error("Health check failed:", error);
});
```

Run in browser console:
```bash
npm run dev
# Open http://localhost:5173
# Open DevTools console
```

- [ ] No errors in console
- [ ] Health check response visible

### [ ] 10. Clean up Test File
```bash
rm frontend/src/test-api.ts
```

### [ ] 11. Git Commit
```bash
cd /path/to/ClawHouse
git add frontend/src/types/index.ts
git add frontend/src/services/api.ts
git add frontend/src/services/websocket.ts
git add frontend/.env.local
git add package*.json

git commit -m "Week 3 Day 1: Setup foundation with types and services

- Add comprehensive TypeScript types for all domain models
- Create ApiClient service with 15+ REST endpoint methods
- Create WebSocketService for real-time event handling
- Install dependencies: react-query, socket.io-client, wavesurfer-js
- Configure environment variables
- All TypeScript compilation passes with zero errors"
```

- [ ] Commit successful
- [ ] Commit message descriptive

---

## End of Day (1 hour)

### [ ] 12. Document Progress
Create `WEEK_3_DAY1_COMPLETE.md`:
```markdown
# Week 3, Day 1: Complete ✅

**Date:** February 20, 2026
**Duration:** 6 hours
**Status:** ✅ COMPLETE

## Tasks Completed

### Services (2 created)
- [x] ApiClient (480 lines, 15+ methods)
- [x] WebSocketService (200 lines, event handling)

### Types (1 created)
- [x] TypeScript definitions (250 lines, 20+ types)

### Dependencies (3 installed)
- [x] @tanstack/react-query
- [x] socket.io-client
- [x] wavesurfer-js

### Verification
- [x] npm install succeeds
- [x] TypeScript compilation passes
- [x] Backend health check responds
- [x] API client can be imported

## Files Summary

**Created:**
1. frontend/src/types/index.ts (250 lines)
   - All domain types (Podcast, Episode, Room, Message, etc.)
   - WebSocket event payloads
   - Request/response types

2. frontend/src/services/api.ts (480 lines)
   - ApiClient class with 15+ methods
   - Error handling and retry logic
   - Token management
   - Request building and response parsing

3. frontend/src/services/websocket.ts (200 lines)
   - WebSocketService with event handlers
   - Connection lifecycle management
   - Room join/leave functionality

**Updated:**
- frontend/package.json (added 3 dependencies)
- frontend/.env.local (new, contains config)

## Code Quality

- [x] All functions fully typed (TypeScript strict mode)
- [x] Comprehensive JSDoc comments
- [x] Error classes defined
- [x] Proper imports/exports
- [x] Zero implicit any
- [x] Zero TypeScript errors

## Next Day (Day 2)

Will create:
1. CreatePodcastForm component
2. Validation schemas
3. Form component tests (5+ tests)

## Known Issues / Notes

- None at this point
- All systems ready for component development

---

**Generated:** February 20, 2026
**Phase:** Week 3/5
**Status:** Ready for Day 2
```

- [ ] Progress file created

### [ ] 13. Review Checklist
- [ ] All 12 items complete
- [ ] No errors or warnings
- [ ] Code committed to git
- [ ] Progress documented

---

## Optional (If Time Remaining)

### [ ] 14. Explore Backend
- [ ] Look at `backend/src/routes/podcast-routes.ts`
- [ ] Understand request/response formats
- [ ] Note error handling patterns

### [ ] 15. Set Up ESLint (if not already)
```bash
cd frontend
npm run lint
```
- [ ] Check for any linting issues
- [ ] Fix formatting if needed

### [ ] 16. Create Test Setup
Look ahead to Day 2 testing:
```bash
# Check if vitest configured
cat frontend/vitest.config.ts
```
- [ ] Note testing setup
- [ ] Understand mock patterns

---

## Success Criteria

By end of Day 1, you should have:

✅ **Code**
- Types file with 20+ TypeScript interfaces
- API client with 15+ REST methods
- WebSocket service with event handlers
- All code fully documented

✅ **Testing**
- TypeScript compilation passes
- No ESLint errors
- Can import all services in browser
- Backend health check responds

✅ **Documentation**
- This checklist completed
- Progress file created
- Git commit with clear message

✅ **Ready for Day 2**
- Can start building components
- Services available for use
- Environment configured
- Backend verified running

---

## Troubleshooting

### Issue: `npm install` fails
**Solution:**
```bash
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

### Issue: TypeScript errors
**Solution:**
```bash
# Check specific errors
npx tsc --noEmit

# If importing from common/types/, verify path
# Update tsconfig.json if needed
```

### Issue: Backend health check fails
**Solution:**
```bash
# Verify backend is running
cd backend
npm run dev

# Check on http://localhost:4000/health
curl http://localhost:4000/health
```

### Issue: WebSocket can't connect
**Solution:**
- Backend must support socket.io on `/socket.io`
- Check VITE_WS_URL environment variable
- Verify CORS configured in backend

---

## Notes for Next Days

**Day 2 will build:**
- CreatePodcastForm component
- Form validation (Zod schemas)
- Component tests for form

**Day 3 will build:**
- EpisodePlayer component
- EpisodeCard component
- Card tests

**Day 4 will build:**
- CreateRoomForm component
- RoomCard component
- Discovery page scaffold

**Day 5 will build:**
- Complete DiscoveryPage (search, filter, pagination)
- Complete PodcastDetailPage
- Integration tests

---

**Week 3, Day 1 is ready to launch! 🚀**

**Time:** ~6 hours  
**Complexity:** Foundation work (no new concepts)  
**Risk:** Low (isolated services, no integration)  
**Next checkpoint:** Day 2 component creation
