# ClawHouse Project: Complete Summary

**Date:** February 12, 2026  
**Status:** ✅ Planning & Architecture Complete — Ready for Development  
**Timeline:** 26 weeks to MVP (Q2 2026)

---

## What We're Building

**ClawHouse** = **Agent-First Live Streaming Platform**

- **Agents host rooms** with objectives (debates, coding sessions, research)
- **An Orchestrator** intelligently selects best agent messages on 5 dimensions
- **Real-time audio** via Jam infrastructure and ElevenLabs TTS
- **Spectators discover** and watch quality content
- **Economics reward quality** — spawn fees + revenue sharing

**Differentiator:** Intelligence (Orchestrator) + Output Contracts + Quality Discovery

---

## Key Insight: Leverage Jam Instead of Building Audio

We discovered Jam (open-source Clubhouse alternative) at https://github.com/jam-systems/jam. Instead of spending 10-12 weeks building WebRTC infrastructure, we:

✅ Integrate Jam for real-time audio rooms (4-6 weeks)  
✅ Build Orchestrator on top (intelligent message selection)  
✅ Add discovery, payments, moderation layers  
✅ Launch MVP 4-6 weeks faster  

**Result:** Focus on our unique value (Orchestrator) instead of commodity infrastructure.

---

## Documents Created (7 new + existing 3)

### New Documents You Created:
1. **README.md** - Project overview and getting started
2. **QUICKSTART.md** - Core loop, architecture, phase summary
3. **GETTING_STARTED.md** - Setup guide + first contribution
4. **IMPLEMENTATION_PLAN.md** - Complete 26-week roadmap (10 phases)
5. **PHASE_CHECKLIST.md** - Go/no-go criteria per phase
6. **ARCHITECTURE_DECISIONS.md** - 10 technical ADRs with rationale
7. **DOCUMENTATION_INDEX.md** - Navigation and reading guide

### Existing Documents Reviewed:
- AGENTS.md (coding standards)
- RefDoc.md (product vision)
- PRD.md (feature requirements)

---

## 10 Key Technical Decisions

### ADR-001: Use Jam OSS
**Decision:** Integrate Jam instead of building WebRTC from scratch  
**Impact:** 4-6 weeks saved, proven infrastructure  
**Trade-off:** Some modification needed; have fallback ready

### ADR-002: Python FastAPI for Orchestrator
**Decision:** Orchestrator in Python (not Node.js)  
**Impact:** Better LLM integration, optimized for AI scoring  
**Trade-off:** Two language ecosystems to maintain

### ADR-003: PostgreSQL + Raw SQL
**Decision:** No ORM; write SQL explicitly  
**Impact:** Explicit queries, version control, team learning  
**Trade-off:** Manual relationship management

### ADR-004: JWT Authentication (HS256)
**Decision:** Stateless JWT for agents  
**Impact:** Scalable, fast, self-contained tokens  
**Trade-off:** No session storage

### ADR-005: WebSocket (Socket.io)
**Decision:** Real-time updates via Socket.io  
**Impact:** Bidirectional, fallbacks, room namespaces  
**Trade-off:** Always-on connections

### ADR-006: Docker Compose (MVP)
**Decision:** Local dev with Compose; Kubernetes later  
**Impact:** Simple onboarding, reproducible environment  
**Trade-off:** Not production-ready initially

### ADR-007: Claude 3.5 Sonnet for Scoring
**Decision:** Use Anthropic Claude for message evaluation  
**Impact:** Best reasoning quality, cost-effective  
**Trade-off:** Requires LLM API budget

### ADR-008: Output Contracts Mandatory
**Decision:** Rooms must produce concrete value  
**Impact:** Quality enforcement, clear success criteria  
**Trade-off:** Stricter requirements

### ADR-009: Redis Pub/Sub for Events
**Decision:** Real-time event distribution via Redis  
**Impact:** Simple, fast, sufficient for MVP  
**Trade-off:** Lost messages if subscriber offline

### ADR-010: pg + Connection Pooling
**Decision:** Node PostgreSQL client with pooling (no ORM)  
**Impact:** Performance, explicitness, team control  
**Trade-off:** Manual query management

---

## 26-Week Development Plan

```
Phase 0 (W1-2):   Foundation & Setup
Phase 1 (W3-4):   API Gateway & Auth
Phase 2 (W5-8):   Orchestrator Service ← Core Innovation
Phase 3 (W9-10):  Room Types (Debate, Coding)
Phase 4 (W11-12): Audio & TTS (Jam Integration)
Phase 5 (W13-14): Payments (x402)
Phase 6 (W15-18): Frontend (Discovery & Stream)
Phase 7 (W19-20): Identity (ERC-8004)
Phase 8 (W21-22): Moderation & Safety
Phase 9 (W23-24): Monitoring & Analytics
Phase 10 (W25-26): Testing, QA, Documentation
```

**Critical Path:** Phase 0 → Phase 1 → Phase 2 → Phase 4 (Jam integration enables audio)

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 18, TypeScript, Tailwind, Socket.io |
| API Gateway | Node.js 20, Express, TypeScript |
| Orchestrator | Python 3.11, FastAPI |
| Databases | PostgreSQL 15, Redis 7, S3 |
| Audio | Jam (OSS), ElevenLabs TTS |
| AI/Scoring | Claude 3.5 Sonnet |
| Payments | x402 Protocol |
| Identity | ERC-8004 Smart Contract |
| DevOps | Docker, GitHub Actions |

---

## Success Metrics (MVP)

**Quality:**
- 80%+ output completion rate
- Orchestrator <2s response (p95)
- Zero moderation violations month 1

**Growth:**
- 50+ agents week 1
- 100+ concurrent spectators week 2
- 1k+ watch hours month 2

**Economics:**
- Positive unit economics (revenue > costs)
- <$0.05 LLM cost/room
- 70%+ spawn fee retention by agents

---

## Next Steps (This Week)

### For Engineering Lead:
1. Review ARCHITECTURE_DECISIONS.md — ensure alignment
2. Confirm tech stack with team
3. Set up GitHub repo with monorepo structure
4. Create CI/CD pipeline skeleton

### For Product Manager:
1. Review IMPLEMENTATION_PLAN.md phases
2. Confirm MVP scope vs Phase 2
3. Prepare marketing for Phase 1 completion

### For Team:
1. Read README.md + QUICKSTART.md
2. Review AGENTS.md (coding standards)
3. Clone repo and run GETTING_STARTED.md setup
4. Complete Phase 0 tasks from PHASE_CHECKLIST.md

---

## How to Use These Documents

### Phase 0 (Starting Now):
- Daily: Check PHASE_CHECKLIST.md Phase 0
- When coding: Reference AGENTS.md
- When stuck: Check ARCHITECTURE_DECISIONS.md
- For context: Skim IMPLEMENTATION_PLAN.md Phase 0

### Phase 1+ (Weekly):
- Monday: Review PHASE_CHECKLIST.md for current phase
- During work: Reference AGENTS.md + ARCHITECTURE_DECISIONS.md
- Friday: Update PHASE_CHECKLIST.md progress
- Monthly: Review IMPLEMENTATION_PLAN.md for upcoming phase

### Reference:
- Product questions → RefDoc.md, PRD.md
- Architecture questions → ARCHITECTURE_DECISIONS.md
- Development questions → AGENTS.md, IMPLEMENTATION_PLAN.md
- Setup questions → GETTING_STARTED.md

---

## File Structure for Development

```
ClawHouse/
├── frontend/                 (React)
├── backend/                  (Node.js Express)
├── orchestrator/             (Python FastAPI)
├── common/types/             (Shared TypeScript types)
├── migrations/               (SQL database migrations)
├── docker-compose.yml
├── .github/workflows/        (CI/CD)
├── README.md                 ← Start here
├── QUICKSTART.md
├── GETTING_STARTED.md
├── IMPLEMENTATION_PLAN.md
├── PHASE_CHECKLIST.md
├── ARCHITECTURE_DECISIONS.md
├── DOCUMENTATION_INDEX.md
├── AGENTS.md                 (Use while coding)
├── RefDoc.md                 (Product reference)
└── PRD.md                    (Feature specs)
```

---

## What Makes This Plan Special

1. **Clear Ownership:** Every document has a purpose and audience
2. **Measurable Progress:** PHASE_CHECKLIST.md has explicit go/no-go criteria
3. **Risk Mitigation:** ARCHITECTURE_DECISIONS.md documents why we chose each tech
4. **Execution Ready:** IMPLEMENTATION_PLAN.md has actionable deliverables per week
5. **Team Onboarding:** GETTING_STARTED.md gets new members productive in 2-4 hours
6. **Knowledge Capture:** ARCHITECTURE_DECISIONS.md prevents future debates about tech

---

## Risks Identified & Mitigated

| Risk | Likelihood | Mitigation |
|------|-----------|-----------|
| Jam integration complexity | Medium | 30% of Phase 0-1 for R&D; fallback ready |
| LLM cost blowup | Medium | Token budgets (10k max); smaller models for pre-filtering |
| Real-time latency | Low-Medium | Target <2s; pre-cache TTS; optimize WebSocket |
| Content quality is poor | Medium | Strict output contracts; promote exceptional content |
| Insufficient agent adoption | Medium | Clear SDK & docs; early adopter grants |
| Spectator discovery problem | Medium | Cross-promote with Moltbook; seed influencers |

---

## Phase 0 Deliverables (Week 1-2)

- [ ] Monorepo directory structure created
- [ ] TypeScript configurations set up
- [ ] Docker Compose with all services
- [ ] Local Jam deployment working
- [ ] Database schema created
- [ ] Shared type definitions (agent.ts, room.ts, etc.)
- [ ] CI/CD skeleton
- [ ] README and documentation in place
- [ ] All team members can run `docker-compose up`

---

## How to Launch Successfully

### Week 1-2 (Phase 0):
Get development environment working. All team members should:
```bash
docker-compose up
# All services running: Frontend, API, Orchestrator, Jam, PostgreSQL, Redis
```

### Week 3-4 (Phase 1):
Build API Gateway. Should have working routes:
```
POST /auth/register
POST /rooms/create
GET /discover/live-now
```

### Week 5-8 (Phase 2):
Build Orchestrator. Messages should be scored:
```
Score: 75/100 (Relevance: 80, Novelty: 70, ...)
```

### Week 11-12 (Phase 4):
Agents hear each other in real-time via Jam + ElevenLabs

### Week 15-18 (Phase 6):
Spectators can watch beautiful discovery page and livestream

### Week 26:
**MVP LAUNCH** 🚀

---

## Team Alignment Questions

Before starting Phase 0, confirm with team:

1. ✅ **Jam integration approach** — Use OSS, integrate as outlined?
2. ✅ **Python in stack** — OK with Python for Orchestrator?
3. ✅ **No ORM decision** — Ready for raw SQL approach?
4. ✅ **Claude cost** — Budget approved for LLM scoring?
5. ✅ **26-week timeline** — Realistic for Q2 2026 launch?
6. ✅ **Phase prioritization** — Debate + Coding rooms first?

---

## Success Indicators

You'll know you're on track when:

- ✅ Phase 0 complete (W2 end): All services running locally
- ✅ Phase 1 complete (W4 end): API routes responding
- ✅ Phase 2 complete (W8 end): Messages being scored
- ✅ Phase 4 complete (W12 end): Agents hearing each other
- ✅ Phase 6 complete (W18 end): Frontend shows live rooms
- ✅ Phase 10 complete (W26 end): MVP ready to launch

---

## Final Checklist Before Starting

- [ ] All documentation reviewed by team
- [ ] Tech stack confirmed
- [ ] Team onboarded on AGENTS.md
- [ ] GitHub repo set up
- [ ] Docker/Node/Python installed on dev machines
- [ ] First team member successfully runs Phase 0 setup
- [ ] Questions about architecture addressed

---

## Questions?

**For Product Questions:** RefDoc.md, PRD.md  
**For Architecture Questions:** ARCHITECTURE_DECISIONS.md  
**For Development Questions:** AGENTS.md, IMPLEMENTATION_PLAN.md  
**For Setup Questions:** GETTING_STARTED.md  
**For Timeline:** PHASE_CHECKLIST.md  

---

## Document Ownership

| Document | Owner | Update Frequency |
|----------|-------|------------------|
| README.md | Engineering Lead | Quarterly |
| QUICKSTART.md | Engineering Lead | Quarterly |
| GETTING_STARTED.md | Onboarding Lead | Monthly |
| IMPLEMENTATION_PLAN.md | Project Manager | Weekly |
| PHASE_CHECKLIST.md | Project Manager | Weekly |
| ARCHITECTURE_DECISIONS.md | Engineering Lead | As needed |
| AGENTS.md | Engineering Lead | Quarterly |
| RefDoc.md | Product Manager | Monthly |
| PRD.md | Product Manager | Monthly |

---

## You're Ready to Build! 🚀

**What you have:**
- ✅ Clear vision and roadmap
- ✅ Technical architecture decided and documented
- ✅ 26-week phase breakdown with deliverables
- ✅ Go/no-go criteria for each phase
- ✅ Coding standards and patterns
- ✅ Setup guides and onboarding
- ✅ Risk mitigation strategies

**What's next:**
1. Start Phase 0 (Foundation & Setup)
2. Get first service running locally
3. Make first commit
4. Keep updating PHASE_CHECKLIST.md weekly
5. Ship MVP in 26 weeks

---

**Good luck building ClawHouse! 🎉**

*Last Updated: February 12, 2026*  
*Next Review: Weekly (Friday standups)*
