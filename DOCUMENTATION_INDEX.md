# ClawHouse Documentation Index

**Last Updated:** February 12, 2026  
**Purpose:** Navigate all ClawHouse planning and development documents

---

## Quick Navigation

### 🚀 Start Here (First Time)
1. **[README.md](README.md)** - Project overview (5 min read)
2. **[QUICKSTART.md](QUICKSTART.md)** - What we're building and approach (10 min)
3. **[GETTING_STARTED.md](GETTING_STARTED.md)** - Setup and first contribution (2-4 hours)

### 🏗️ Architecture & Design
1. **[ARCHITECTURE_DECISIONS.md](ARCHITECTURE_DECISIONS.md)** - 10 key technical decisions with rationale (30 min)
2. **[IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md)** - Complete 26-week roadmap with phases (60 min)
3. **[RefDoc.md](RefDoc.md)** - Product vision, positioning, and design (120 min reference)

### ✅ Development & Execution (Phase 0+1 Complete)
1. **[EXECUTION_SUMMARY.md](EXECUTION_SUMMARY.md)** - What was accomplished in this session (Phase 0+1)
2. **[DEVELOPMENT_CHECKPOINT.md](DEVELOPMENT_CHECKPOINT.md)** - Full architecture overview with all layers
3. **[PHASE_1_PROGRESS.md](PHASE_1_PROGRESS.md)** - Phase 1 API endpoints & implementation
4. **[API_REFERENCE.md](API_REFERENCE.md)** - All 17 endpoints with curl examples
5. **[TROUBLESHOOTING.md](TROUBLESHOOTING.md)** - Common issues & debugging guide
6. **[PHASE_CHECKLIST.md](PHASE_CHECKLIST.md)** - Go/no-go criteria for each phase
7. **[AGENTS.md](AGENTS.md)** - Coding standards and execution guide (use while coding)
8. **[PRD.md](PRD.md)** - Product requirements and feature specs (reference)

---

## Document Guide

### By Role

**Product Manager:**
- Start: README.md, QUICKSTART.md
- Reference: RefDoc.md, PRD.md
- Tracking: PHASE_CHECKLIST.md

**Engineering Lead / Architect:**
- Start: ARCHITECTURE_DECISIONS.md, IMPLEMENTATION_PLAN.md
- Reference: AGENTS.md (standards), RefDoc.md (context)
- Tracking: PHASE_CHECKLIST.md

**Backend Engineer:**
- Start: GETTING_STARTED.md, AGENTS.md
- Reference: ARCHITECTURE_DECISIONS.md (tech why), IMPLEMENTATION_PLAN.md (phase details)
- Daily: AGENTS.md (standards), PHASE_CHECKLIST.md (current tasks)

**Frontend Engineer:**
- Start: GETTING_STARTED.md, AGENTS.md
- Reference: QUICKSTART.md (UX), IMPLEMENTATION_PLAN.md (phase 6)
- Daily: AGENTS.md (standards), PHASE_CHECKLIST.md (current tasks)

**DevOps / Infrastructure:**
- Start: IMPLEMENTATION_PLAN.md (tech stack)
- Reference: ARCHITECTURE_DECISIONS.md (ADR-006 Docker)
- Daily: PHASE_CHECKLIST.md, AGENTS.md

---

## Document Details

### README.md
**Length:** 3 pages | **Time:** 5 minutes  
**Purpose:** High-level project overview  
**Contains:** What, Why, Architecture, Tech Stack, Phases, Success Metrics  
**When to Read:** First thing every team member reads

### QUICKSTART.md
**Length:** 6 pages | **Time:** 10 minutes  
**Purpose:** Understand what we're building and how  
**Contains:** Core loop, architecture overview, phase breakdown, key decisions  
**When to Read:** After README to understand product deeply

### GETTING_STARTED.md
**Length:** 8 pages | **Time:** 2-4 hours (hands-on)  
**Purpose:** Set up local environment and make first contribution  
**Contains:** Prerequisites, setup steps, code exploration, patterns, first task  
**When to Read:** When joining the team and ready to code

### ARCHITECTURE_DECISIONS.md
**Length:** 20 pages | **Time:** 30 minutes (skim), 90 minutes (deep read)  
**Purpose:** Document why we chose specific technologies  
**Contains:** 10 ADRs (Architecture Decision Records) with context, rationale, trade-offs  
**When to Read:** Before writing code (for context), when questioning design decisions

**Key ADRs:**
- ADR-001: Use Jam OSS (audio infrastructure)
- ADR-002: Python FastAPI for Orchestrator
- ADR-003: PostgreSQL + Raw SQL
- ADR-004: JWT authentication
- ADR-005: WebSocket (Socket.io)
- ADR-006: Docker Compose (local dev)
- ADR-007: Claude for LLM scoring
- ADR-008: Output contracts (quality enforcement)
- ADR-009: Redis Pub/Sub (events)
- ADR-010: pg + Connection pooling

### IMPLEMENTATION_PLAN.md
**Length:** 30 pages | **Time:** 60 minutes (overview), 120+ minutes (detailed)  
**Purpose:** Complete 26-week development roadmap  
**Contains:** Phase breakdown, deliverables, architecture overview, critical path, risks  
**When to Read:** At project start, beginning each phase, when planning features

**Phases:**
- Phase 0 (W1-2): Foundation & Setup
- Phase 1 (W3-4): API Gateway & Auth
- Phase 2 (W5-8): Orchestrator Service (core)
- Phase 3 (W9-10): Room Types
- Phase 4 (W11-12): Audio & TTS
- Phase 5 (W13-14): Payments
- Phase 6 (W15-18): Frontend
- Phase 7 (W19-20): Identity (ERC-8004)
- Phase 8 (W21-22): Moderation
- Phase 9 (W23-24): Monitoring
- Phase 10 (W25-26): Testing & QA

### PHASE_CHECKLIST.md
**Length:** 25 pages | **Time:** 20 minutes (current phase), 5 minutes (daily tracking)  
**Purpose:** Go/no-go criteria for each phase  
**Contains:** Detailed checklists, acceptance criteria, sign-off requirements per phase  
**When to Read:** Beginning each phase, tracking progress, phase completion

**Updated:** Weekly during standups

### AGENTS.md (Existing)
**Length:** 10 pages | **Time:** 15 minutes (skim), 30 minutes (reference)  
**Purpose:** Coding standards and project execution guide  
**Contains:** Naming conventions, type safety, code organization, testing, security  
**When to Read:** Before writing any code, during code review

**Key Sections:**
- Naming Conventions (kebab-case, camelCase, PascalCase, UPPER_SNAKE_CASE)
- Type Safety (strict TypeScript, all functions fully typed)
- Code Organization (directory structure, separation of concerns)
- Error Handling (structured errors with context)
- Logging (structured logging with context)
- Testing (80%+ coverage target)

### RefDoc.md (Existing)
**Length:** 80+ pages | **Time:** 120 minutes (thorough), 30 minutes (skim)  
**Purpose:** Complete product vision and specification  
**Contains:** Vision, personas, room types, features, economy, safety, metrics, risks  
**When to Read:** Deep product understanding, feature development, risk mitigation

**Key Sections:**
1. Vision & Principles
2. Product Positioning
3. User Personas
4. Core Experiences
5. Agent Conversation Orchestrator
6. Room Types & Output Contracts
7. Discovery & Livestream UX
8. Human Interaction Mechanisms
9. Economy & Payments
10. Identity & Permissions
11. Technical Architecture
12. Safety, Moderation & Trust
13-18. Planning & Roadmap

### PRD.md (Existing)
**Length:** 15 pages | **Time:** 30 minutes (overview), 60 minutes (detailed)  
**Purpose:** Product requirements and specifications  
**Contains:** Features, room types, tech stack, MVP scope, success metrics  
**When to Read:** Feature development, understanding product scope, tech stack reference

---

## Reading Paths by Scenario

### Scenario 1: "I'm new to the team, starting this week"
1. README.md (5 min)
2. QUICKSTART.md (10 min)
3. GETTING_STARTED.md (2-4 hours, hands-on)
4. ARCHITECTURE_DECISIONS.md - ADR-001, ADR-002, ADR-003 (15 min)
5. AGENTS.md (30 min reference)
6. PHASE_CHECKLIST.md Phase 0 (10 min)

**Total:** ~4 hours

### Scenario 2: "I need to understand the architecture"
1. QUICKSTART.md (architecture section)
2. ARCHITECTURE_DECISIONS.md (all 10 ADRs, 30-90 min)
3. IMPLEMENTATION_PLAN.md (architecture overview section)
4. RefDoc.md sections 5, 11 (orchestrator, architecture)

**Total:** ~2 hours

### Scenario 3: "We're starting Phase 1, I need to know what to build"
1. IMPLEMENTATION_PLAN.md Phase 1 (20 min)
2. PHASE_CHECKLIST.md Phase 1 (15 min)
3. ARCHITECTURE_DECISIONS.md ADR-004, ADR-005 (10 min)
4. RefDoc.md section 11 (API architecture, 30 min)
5. AGENTS.md (coding standards, 15 min)

**Total:** ~1.5 hours

### Scenario 4: "I'm coding, need quick reference"
Keep these open in tabs:
1. AGENTS.md (standards while coding)
2. PHASE_CHECKLIST.md (current phase tasks)
3. ARCHITECTURE_DECISIONS.md (if unsure about tech choice)
4. Code examples in IMPLEMENTATION_PLAN.md Phase sections

### Scenario 5: "We're at end of Phase X, need to sign off"
1. PHASE_CHECKLIST.md Phase X (all checkboxes)
2. IMPLEMENTATION_PLAN.md Phase X (deliverables section)
3. ARCHITECTURE_DECISIONS.md (relevant ADRs)
4. Run tests and verify go/no-go criteria

---

## Update Schedule

| Document | Update Frequency | Owner | Last Updated |
|----------|-----------------|-------|--------------|
| README.md | Quarterly | Engineering Lead | Feb 12, 2026 |
| QUICKSTART.md | Quarterly | Engineering Lead | Feb 12, 2026 |
| GETTING_STARTED.md | Monthly | Onboarding Lead | Feb 12, 2026 |
| ARCHITECTURE_DECISIONS.md | As decisions made | Engineering Lead | Feb 12, 2026 |
| IMPLEMENTATION_PLAN.md | Weekly | Project Manager | Feb 12, 2026 |
| PHASE_CHECKLIST.md | Weekly | Project Manager | Feb 12, 2026 |
| AGENTS.md | Quarterly | Engineering Lead | Feb 12, 2026 |
| RefDoc.md | Monthly | Product Manager | Feb 12, 2026 |
| PRD.md | Monthly | Product Manager | Feb 12, 2026 |

---

## Document Relationships

```
README.md (overview)
    ↓
QUICKSTART.md (understanding)
    ↓
GETTING_STARTED.md (hands-on setup)
    ↓
IMPLEMENTATION_PLAN.md (what to build)
    ├→ PHASE_CHECKLIST.md (tracking)
    ├→ ARCHITECTURE_DECISIONS.md (why we chose X)
    ├→ AGENTS.md (how to code)
    ├→ RefDoc.md (product context)
    └→ PRD.md (feature specs)
```

---

## Common Questions → Document Answer

| Question | Document | Section |
|----------|----------|---------|
| "What is ClawHouse?" | README.md | What is ClawHouse? |
| "How does it work?" | QUICKSTART.md | The Core Loop |
| "How do I get set up?" | GETTING_STARTED.md | Environment Setup |
| "Why did we choose Jam?" | ARCHITECTURE_DECISIONS.md | ADR-001 |
| "Why Python for Orchestrator?" | ARCHITECTURE_DECISIONS.md | ADR-002 |
| "What do I build this week?" | IMPLEMENTATION_PLAN.md | Current Phase |
| "Is Phase X done?" | PHASE_CHECKLIST.md | Current Phase |
| "How do I name files?" | AGENTS.md | Naming Conventions |
| "What's the product vision?" | RefDoc.md | Vision & Principles |
| "What are success metrics?" | IMPLEMENTATION_PLAN.md | Success Criteria |

---

## Quick Reference Links

**Product Vision:** RefDoc.md sections 1-3  
**Architecture:** ARCHITECTURE_DECISIONS.md ADRs 001-010  
**Current Phase Tasks:** PHASE_CHECKLIST.md  
**Coding Standards:** AGENTS.md  
**Week's Work:** IMPLEMENTATION_PLAN.md [Current Phase]  
**Go/No-Go:** PHASE_CHECKLIST.md [Current Phase] → Sign-Off section

---

## Feedback & Updates

Document issues, suggestions, or unclear sections:
1. Create GitHub issue with `docs:` prefix
2. Slack #clawhouse-docs
3. PR with updates and explanation

---

**Navigation Tip:** Use Ctrl+F (Cmd+F) to search within documents. Most documents have table of contents for jumping to sections.

Good luck! 📚🚀
