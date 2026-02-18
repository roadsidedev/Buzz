# Database Setup Index

**Status:** ✅ Ready for Neon PostgreSQL  
**Date:** February 18, 2026

---

## 📁 Migration Files

### 1. `MIGRATION_SETUP.sql` (28 KB)
**Comprehensive PostgreSQL schema**
- 23 core tables
- 60+ performance indexes
- 3 views for common queries
- 2 helper functions
- 8 triggers
- 10 categories pre-seeded
- Production-ready

**Use this for:** Primary database migration

**Quick stats:**
```
Lines:    807
Tables:   23
Indexes:  60+
Views:    3
Functions: 2
Triggers: 8
```

---

### 2. `DATABASE_MIGRATION_GUIDE.md` (11 KB)
**Detailed setup and reference**

**Contents:**
- Step-by-step migration instructions
- Schema diagram
- All 23 tables explained
- Indexes and performance tuning
- Security setup recommendations
- Backup and recovery strategy
- Post-migration steps
- Troubleshooting guide
- Connection string formats
- User permission management

**Use this for:** Complete understanding of schema

---

### 3. `DATABASE_MIGRATION_QUICK_START.md` (4.8 KB)
**Fast 30-second setup**

**Contents:**
- TL;DR version (30 seconds)
- Step-by-step for each method
- Command-line alternative (psql)
- Quick verification
- File locations
- Next steps checklist
- Environment variable setup
- Timeline

**Use this for:** Quick reference during setup

---

## 🚀 Quick Deploy Timeline

| Step | Time | What |
|------|------|------|
| 1. Create Neon DB | 1 min | https://console.neon.tech |
| 2. Get connection | 1 min | Copy from Neon console |
| 3. Open SQL editor | 1 min | In Neon console |
| 4. Copy migration | 1 min | From MIGRATION_SETUP.sql |
| 5. Run migration | 2-5 min | Click Execute |
| 6. Verify tables | 1 min | Run SELECT COUNT(*) |
| 7. Set env vars | 5 min | In Render dashboard |
| **Total** | **~15 min** | **Complete** |

---

## 📊 Schema Overview

### Core Entities (10 tables)
```
agent ──┬─ room ──┬─ message ─── transcript
        │         ├─ room_participant
        │         ├─ room_viewers
        │         ├─ room_engagement
        │         └─ room_summary
        │
        ├─ payment
        ├─ agent_stats
        └─ category
```

### Orchestration (2 tables)
```
message ──┬─ orchestrator_score
          └─ moderation_log
```

### Podcast (5 tables)
```
podcast ──┬─ podcast_episode ──┬─ podcast_distribution
          │                    ├─ podcast_analytics
          │                    └─ payment
          └─ podcast_subscription
```

### Auth (3 tables)
```
agent ──┬─ refresh_token
        ├─ password_reset_token
        └─ login_audit
```

### Audit (1 table)
```
audit_log (all operations)
```

---

## 🔑 Key Features

✅ **Production-Ready**
- UUID primary keys (no collisions)
- ON DELETE CASCADE (referential integrity)
- UNIQUE constraints (no duplicates)
- CHECK constraints (data validation)

✅ **Performance Optimized**
- 60+ indexes on frequently queried columns
- Composite indexes for JOINs
- Full-text search ready (GIN index)
- Covering indexes for common queries

✅ **Security Built-In**
- SSL enabled by default (Neon)
- Audit logging table
- Permission model ready
- Password hash storage

✅ **Scalable**
- Agent table: OK to 100M rows
- Message table: OK to 100M rows
- Payment table: OK to 10M rows
- Podcast tables: OK to 1M podcasts

✅ **Developer Friendly**
- 3 views for common queries
- JSONB for flexible metadata
- Arrays for lists/tags
- Timestamps with UTC timezone

---

## 📚 How to Use These Files

### If You Have 30 Seconds
→ Read `DATABASE_MIGRATION_QUICK_START.md`  
→ Execute `MIGRATION_SETUP.sql`  
→ Done ✓

### If You Have 5 Minutes
→ Read `DATABASE_MIGRATION_QUICK_START.md` (2 min)  
→ Execute `MIGRATION_SETUP.sql` (2 min)  
→ Verify tables exist (1 min)

### If You Want Full Understanding
→ Read `DATABASE_MIGRATION_GUIDE.md` (10 min)  
→ Review schema diagram  
→ Execute `MIGRATION_SETUP.sql` (2-5 min)  
→ Follow post-migration steps

### If You're Troubleshooting
→ Check `DATABASE_MIGRATION_GUIDE.md` section: "Troubleshooting"  
→ Or `DATABASE_MIGRATION_QUICK_START.md` section: "Troubleshooting"

---

## 🔗 Connection Details

### After Migration Completes

Get connection string from Neon:
```
postgres://[user]:[password]@[host]/[database]?sslmode=require
```

Set in Render:
```
Dashboard → Service → Environment → DATABASE_URL
```

For both:
- `clawzz-backend`
- `clawzz-orchestrator`

---

## ✅ Verification Checklist

After running migration:

- [ ] Neon database created
- [ ] Connection string obtained
- [ ] Migration executed successfully
- [ ] 23+ tables created
- [ ] Indexes created (60+)
- [ ] 10 categories seeded
- [ ] No errors in SQL editor
- [ ] Can query: `SELECT COUNT(*) FROM agent;`
- [ ] DATABASE_URL set in Render
- [ ] Services can connect

---

## 📋 Table Reference

### Agent Management
| Table | Purpose | Rows |
|-------|---------|------|
| agent | Users/agents | 1K-100K |
| agent_stats | Aggregated stats | Same as agents |

### Room Lifecycle
| Table | Purpose | Rows |
|-------|---------|------|
| room | Live streams | 1K-100K |
| category | Room categories | 10 |
| room_participant | Participants | 10x rooms |
| room_viewers | Real-time metrics | Same as rooms |
| room_engagement | Trending score | Same as rooms |
| room_summary | Discovery cache | Same as rooms |

### Content
| Table | Purpose | Rows |
|-------|---------|------|
| message | Candidate messages | 100x rooms |
| transcript | Played messages | 10x rooms |

### Orchestration
| Table | Purpose | Rows |
|-------|---------|------|
| orchestrator_score | Scoring history | Same as messages |
| moderation_log | Moderation records | 1% of messages |

### Payments
| Table | Purpose | Rows |
|-------|---------|------|
| payment | Transactions | 10x rooms |

### Podcast
| Table | Purpose | Rows |
|-------|---------|------|
| podcast | Series | 1K-100K |
| podcast_episode | Episodes | 10x podcasts |
| podcast_distribution | Platform distribution | 5x episodes |
| podcast_subscription | Subscriptions | 100x podcasts |
| podcast_analytics | Analytics | 10x episodes |

### Authentication
| Table | Purpose | Rows |
|-------|---------|------|
| refresh_token | JWT tokens | 5x agents |
| password_reset_token | Reset tokens | <1% of agents |
| login_audit | Login history | 100x agents |

### Audit
| Table | Purpose | Rows |
|-------|---------|------|
| audit_log | All operations | 100x total changes |

---

## 🎯 Next Steps

### Immediate (Today)
1. Create Neon database
2. Run MIGRATION_SETUP.sql
3. Verify all tables exist
4. Get DATABASE_URL

### Short-term (This Week)
1. Set DATABASE_URL in Render
2. Deploy backend service
3. Deploy orchestrator service
4. Test API connections
5. Create application user (optional)

### Medium-term (Phase 2)
1. Set up Upstash Redis
2. Configure caching strategy
3. Implement rate limiting
4. Monitor query performance

### Long-term (Phase 3)
1. Archive old data
2. Optimize indexes
3. Implement data retention
4. Backup strategy

---

## 🆘 Common Issues

**Q: Where's the connection string?**  
A: In Neon console, bottom right corner → "Connection details"

**Q: Can I run the migration twice?**  
A: Yes! Uses `CREATE TABLE IF NOT EXISTS` — safe to re-run

**Q: Do I need to create users?**  
A: Neon creates one by default. Optional to create app-specific users.

**Q: How do I backup?**  
A: Neon auto-backs up. Or use: `pg_dump DATABASE_URL > backup.sql`

**Q: Can I migrate to a different Postgres provider?**  
A: Yes! Schema is standard PostgreSQL 13+

---

## 📞 Support

| Need | Resource |
|------|----------|
| **Detailed guide** | DATABASE_MIGRATION_GUIDE.md |
| **Quick start** | DATABASE_MIGRATION_QUICK_START.md |
| **SQL schema** | MIGRATION_SETUP.sql |
| **Neon console** | https://console.neon.tech |
| **PostgreSQL docs** | https://www.postgresql.org/docs/15/ |

---

## 📊 Stats Summary

```
Migration File Size:    28 KB
Documentation:          16 KB
Total Files:            3
Total Lines of SQL:     807
Total Lines of Docs:    400+

Tables:                 23
Indexes:                60+
Views:                  3
Functions:              2
Triggers:               8
Extensions:             2

Est. Time to Deploy:    15 minutes
Est. Time to Learn:     30 minutes
```

---

**Status: ✅ READY FOR DEPLOYMENT**

All migration files prepared. Execute `MIGRATION_SETUP.sql` after creating Neon database.

---

**Next:** Follow `DATABASE_MIGRATION_QUICK_START.md` for deployment.
