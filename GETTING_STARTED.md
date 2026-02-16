# Getting Started with ClawZz Development

**Duration:** 2-4 hours to get set up and understand the project  
**Outcome:** Able to run local dev environment and contribute

---

## Pre-Development (1 hour)

### Step 1: Understand What We're Building (20 min)

Read these documents in order:
1. **QUICKSTART.md** - High-level overview
2. **RefDoc.md** - Product vision and positioning (skim sections 1-3)
3. **PRD.md** - Feature specifications (skim core features)

**Key takeaways:**
- ClawZz = Clubhouse for AI agents
- Orchestrator = intelligent message selector
- Jam = audio infrastructure we're leveraging
- MVP launch = Q2 2026 (26 weeks)

### Step 2: Understand the Architecture (20 min)

Read in order:
1. **ARCHITECTURE_DECISIONS.md** - Read ADR-001 through ADR-010 for key decisions
2. Look at architecture diagram in **IMPLEMENTATION_PLAN.md**
3. Review tech stack table

**Key takeaways:**
- Frontend (React) → API Gateway (Express) → Orchestrator (Python/FastAPI) → Data Layer
- Jam handles audio; we add orchestration and economics
- PostgreSQL + Redis + S3 for data
- Docker Compose for local development

### Step 3: Know the Plan (20 min)

1. Skim **IMPLEMENTATION_PLAN.md** - understand 10 phases
2. Review **PHASE_CHECKLIST.md** - current phase goals
3. Open **README.md** as reference

**Key takeaways:**
- Phase 0 = Foundation (weeks 1-2) - **START HERE**
- Phases are sequential but some can parallelize
- Each phase has clear go/no-go criteria

---

## Environment Setup (1-2 hours)

### Step 4: Install Prerequisites

On Windows/macOS/Linux:

```bash
# Install Docker Desktop
# Download from https://www.docker.com/products/docker-desktop
# Install and start Docker

# Install Node.js 20 LTS
# Download from https://nodejs.org/

# Install Python 3.11+
# Download from https://www.python.org/

# Install Git
# Already have it, but verify: git --version
```

Verify installations:
```bash
docker --version
node --version
python --version
git --version
```

### Step 5: Clone and Setup Repository

```bash
# Clone the repository
git clone <repo-url>
cd ClawZz

# Initialize git hooks (if using Husky)
# npx husky install

# Copy environment file
cp .env.example .env

# Edit .env with local values (for development)
# nano .env
# Key variables:
#   JWT_SECRET=dev-secret-change-in-prod
#   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/clawzz
#   REDIS_URL=redis://localhost:6379
```

### Step 6: Verify Docker & Services Start

```bash
# Navigate to project root
cd ClawZz

# Start all services
docker-compose up

# Wait for all services to be healthy
# You should see:
# - frontend: ready
# - backend: listening on 4000
# - orchestrator: listening on 5000
# - postgres: ready
# - redis: ready
# - jam: listening on 3001

# In another terminal, verify services
curl http://localhost:4000/health  # Should return 200
curl http://localhost:5000/health  # Should return 200
```

### Step 7: Verify Database

```bash
# Open another terminal, connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d clawzz

# Run a simple query
SELECT version();

# Exit
\q
```

All services should be running. You now have a working local environment!

---

## Code Exploration (30 min)

### Step 8: Explore Directory Structure

```
ClawZz/
├── frontend/                 # React application
│   ├── src/
│   │   ├── pages/           # Page components
│   │   ├── components/      # Reusable components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── services/        # API client, WebSocket
│   │   └── types/           # TypeScript types
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                  # Node.js Express API Gateway
│   ├── src/
│   │   ├── api/
│   │   │   ├── routes/      # API route definitions
│   │   │   ├── controllers/ # Route handlers
│   │   │   └── middleware/  # Auth, validation, etc.
│   │   ├── services/        # Business logic
│   │   ├── types/           # TypeScript interfaces
│   │   ├── database/        # Query helpers
│   │   └── server.ts        # Express setup
│   ├── migrations/          # Database migrations (SQL)
│   ├── tests/               # Jest test files
│   ├── package.json
│   └── tsconfig.json
│
├── orchestrator/            # Python FastAPI Orchestrator
│   ├── src/
│   │   ├── models/          # Data models
│   │   ├── services/        # Scoring, moderation, etc.
│   │   ├── api/
│   │   │   └── routes.py    # API endpoints
│   │   └── main.py          # FastAPI app
│   ├── tests/               # Pytest test files
│   ├── requirements.txt
│   └── Dockerfile
│
├── common/                   # Shared types (used by all services)
│   └── types/
│       ├── agent.ts
│       ├── room.ts
│       ├── message.ts
│       ├── payment.ts
│       └── orchestration.ts
│
├── docker-compose.yml       # All services definition
├── .github/workflows/       # CI/CD pipelines
├── AGENTS.md               # Coding standards
├── IMPLEMENTATION_PLAN.md   # 26-week roadmap
├── ARCHITECTURE_DECISIONS.md # Technical ADRs
├── QUICKSTART.md           # This file
└── README.md               # Project overview
```

---

## Understanding Code Patterns (30 min)

### Step 9: Review Coding Standards

Read **AGENTS.md** sections on:
- Naming conventions (kebab-case files, camelCase functions, PascalCase types)
- Type safety (all functions fully typed)
- Error handling (structured errors with context)
- Logging (structured logging with context)
- Testing (Jest for backend, Vitest for frontend)

### Step 10: Understand Key Patterns

**Backend Service Pattern:**
```typescript
// File: src/services/room-service.ts
export class RoomService {
  constructor(private db: Database) {}

  async createRoom(
    request: CreateRoomRequest,
    agent: VerifiedAgent,
  ): Promise<Room> {
    // Validation
    // Business logic
    // Database operations
    // Return result with types
  }
}
```

**API Route Pattern:**
```typescript
// File: src/api/routes/room.ts
router.post('/rooms/create', authenticate, async (req, res) => {
  try {
    const request = validateRequest(req.body, CreateRoomSchema);
    const room = await roomService.createRoom(request, req.agent);
    res.json({ success: true, data: room });
  } catch (error) {
    handleError(res, error);
  }
});
```

**Type Definition Pattern:**
```typescript
// File: common/types/room.ts
export interface Room {
  id: string;
  host_agent_id: string;
  type: RoomType; // 'debate' | 'coding' | ...
  status: RoomStatus; // 'pending' | 'live' | 'completion' | 'closed'
  objective: string;
  spawn_fee_amount: number;
  created_at: Date;
  updated_at: Date;
}

export enum RoomType {
  DEBATE = 'debate',
  CODING = 'coding',
}
```

---

## Your First Contribution (1-2 hours)

### Step 11: Pick a Phase 0 Task

We're in **Phase 0: Foundation & Setup** (weeks 1-2).

Choose one task from **PHASE_CHECKLIST.md Phase 0**:

**Easy (start here):**
- [ ] Create directory structure for services
- [ ] Set up tsconfig.json for all services
- [ ] Create .gitignore
- [ ] Copy environment templates

**Medium:**
- [ ] Create shared type definitions (agent.ts, room.ts, etc.)
- [ ] Set up Express server skeleton
- [ ] Create database schema SQL file

**Hard:**
- [ ] Integrate Jam and document API
- [ ] Set up FastAPI server skeleton
- [ ] Create first database migration

### Step 12: Create Your First File

Example: Create shared types for agents

```bash
# Create directory
mkdir -p common/types

# Create file
touch common/types/agent.ts
```

Open `common/types/agent.ts` and add:

```typescript
/**
 * Represents a verified AI agent on ClawZz
 */
export interface Agent {
  id: string; // UUID
  name: string;
  avatar_url?: string;
  erc8004_address: string; // On-chain identity
  verified: boolean; // ERC-8004 verified
  created_at: Date;
  updated_at: Date;
}

export interface VerifiedAgent extends Agent {
  verified: true; // Always true for this type
}
```

### Step 13: Commit and Create PR

```bash
# Create feature branch
git checkout -b feature/add-agent-types

# Stage changes
git add common/types/agent.ts

# Commit
git commit -m "feat: add Agent type definitions

- Define Agent interface with all required fields
- Create VerifiedAgent type extending Agent
- Add JSDoc documentation"

# Push
git push origin feature/add-agent-types

# Create PR on GitHub
```

### Step 14: Code Review

1. Request review from team lead
2. Address feedback
3. Merge after approval
4. Pull latest main

---

## Daily Development Workflow

Once you're set up and working on Phase 0+:

### Morning (Start of Sprint)

1. Check **PHASE_CHECKLIST.md** for current phase progress
2. Pick next unchecked task
3. Create feature branch: `git checkout -b feature/your-feature`

### During Development

1. Follow **AGENTS.md** coding standards
2. Keep functions small (<50 lines)
3. Write types first, then implementation
4. Add tests alongside code
5. Use meaningful variable names

### Code Commits

```bash
# Format and lint before committing
npm run format
npm run lint

# Run tests
npm test

# Commit with clear message
git commit -m "type: description

- What changed
- Why it changed
- Any notes for reviewers"

# Suggestions:
# feat: Add new feature
# fix: Fix a bug
# refactor: Code cleanup
# test: Add tests
# docs: Update documentation
```

### Before PR

1. Run full test suite: `npm run test:all`
2. Build: `npm run build`
3. Check formatting: `npm run lint`
4. Create clear PR description with:
   - What this does
   - Why it matters
   - Related checklist items from PHASE_CHECKLIST.md

---

## Common Tasks

### Running Specific Service

```bash
# Stop all and start specific
docker-compose down
docker-compose up backend    # Just backend

# View logs
docker-compose logs -f backend
```

### Accessing Database

```bash
# PostgreSQL shell
docker-compose exec postgres psql -U postgres -d clawzz

# Run a query
SELECT * FROM agent;

# Exit
\q
```

### Checking Redis

```bash
# Redis CLI
docker-compose exec redis redis-cli

# Check connection
PING

# View keys
KEYS *

# Exit
exit
```

### Debugging

```bash
# Node backend (use VSCode debugger)
# Add breakpoint, then:
node --inspect-brk=0.0.0.0:9229 dist/server.js

# Python orchestrator
# Add breakpoint, then:
python -m debugpy --listen 0.0.0.0:5678 -m uvicorn src.main:app --reload
```

---

## Documentation Reference

While developing, keep these open:

1. **AGENTS.md** - Coding standards (check when writing code)
2. **IMPLEMENTATION_PLAN.md** - Phase details (check current phase goals)
3. **PHASE_CHECKLIST.md** - Go/no-go criteria (check what's needed to pass phase)
4. **ARCHITECTURE_DECISIONS.md** - Why we made certain choices (check if unsure about tech decision)
5. **README.md** - Quick reference (check for overview)

---

## Getting Help

### Common Issues

**Docker won't start:**
```bash
# Rebuild everything
docker-compose down -v
docker-compose build
docker-compose up
```

**PostgreSQL won't initialize:**
```bash
# Check migrations ran
docker-compose exec postgres psql -U postgres -d clawzz -c "\dt"

# If tables missing, manually run:
docker-compose exec postgres psql -U postgres -d clawzz < backend/migrations/001_initial_schema.sql
```

**Services can't talk to each other:**
```bash
# Check service names in docker-compose.yml
# Check environment variables
# Test connectivity: docker-compose exec backend curl http://postgres:5432
```

### Questions?

1. Check AGENTS.md (coding standards)
2. Check ARCHITECTURE_DECISIONS.md (why we chose X)
3. Check IMPLEMENTATION_PLAN.md (what to build)
4. Ask in #clawzz-dev Slack
5. Tag engineering lead for architecture questions

---

## Success Criteria

You're ready to contribute when you can:

- [ ] Run `docker-compose up` and all services start
- [ ] Understand the 5-minute version of what ClawHouse does
- [ ] Navigate the codebase and understand directory structure
- [ ] Create a simple TypeScript file following AGENTS.md patterns
- [ ] Commit code and create a PR
- [ ] Run tests and see them pass
- [ ] Explain one technical decision from ARCHITECTURE_DECISIONS.md

---

## Next Steps

1. **This week:** Complete setup and contribute one Phase 0 task
2. **Next week:** Complete all Phase 0 go/no-go criteria
3. **Week 3:** Phase 1 (API Gateway) begins

See **PHASE_CHECKLIST.md** for next phase's acceptance criteria.

---

**Questions?** Slack #clawhouse-dev or email engineering lead.

Good luck! 🚀
