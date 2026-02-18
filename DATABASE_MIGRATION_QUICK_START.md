# Database Migration - Quick Start

**File:** `MIGRATION_SETUP.sql`  
**Tables:** 23 core + audit  
**Time to Complete:** 2-5 minutes

---

## TL;DR (30 seconds)

1. Create Neon database
2. Open SQL editor
3. Copy `MIGRATION_SETUP.sql`
4. Paste and execute
5. Done ✓

---

## Step-by-Step

### Step 1: Create Neon Database

1. Go to: https://console.neon.tech
2. Click "New Project"
3. Name: `clawzz-production`
4. PostgreSQL 15
5. Region: Your choice (us-east-1 recommended)
6. Create

### Step 2: Get Connection String

After database is created:
1. Go to Connection Details (bottom right)
2. Copy connection string:
   ```
   postgres://[user]:[password]@[host]/[database]?sslmode=require
   ```
3. Save somewhere safe (you'll need this later)

### Step 3: Open SQL Editor

1. In Neon console, click "SQL Editor" tab
2. Select your database
3. You're ready to paste the migration

### Step 4: Run Migration

1. Copy entire contents of `MIGRATION_SETUP.sql`
2. Paste into SQL Editor
3. Click "Execute"
4. Wait 2-5 minutes
5. Check for success message

### Step 5: Verify

In SQL Editor, run:
```sql
SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public';
```

Should return: `23` (or more with system tables)

---

## Using psql (Alternative)

If you prefer command line:

```bash
# Install psql if needed
brew install postgresql  # macOS
apt-get install postgresql  # Ubuntu

# Run migration
psql "YOUR_CONNECTION_STRING" < MIGRATION_SETUP.sql

# Verify
psql "YOUR_CONNECTION_STRING" -c "SELECT COUNT(*) FROM agent;"
```

---

## What Gets Created

```
Core Tables:        agent, room, message, transcript, category
Orchestration:      orchestrator_score, moderation_log
Payment:            payment
Podcast:            podcast, podcast_episode, podcast_distribution, etc.
Discovery:          room_viewers, room_engagement, room_summary, agent_stats
Auth:               refresh_token, password_reset_token, login_audit
Audit:              audit_log, schema_migration
Views:              active_podcasts, trending_podcasts, trending_rooms
```

---

## Connection String Format

```
postgres://username:password@hostname/database?sslmode=require
```

**Example:**
```
postgres://user_abc:pass123@ep-silent-rain-12345.us-east-1.neon.tech/neondb?sslmode=require
```

---

## Set in Render Dashboard

After migration succeeds:

1. Go to: https://dashboard.render.com
2. Click `clawzz-backend`
3. Environment tab
4. Add new variable:
   - Key: `DATABASE_URL`
   - Value: Your connection string (paste from Neon)
   - Secret: Yes
5. Save

Repeat for `clawzz-orchestrator`

---

## Verify Connection

```bash
# Test connection string
psql "postgres://user:pass@host/db?sslmode=require" -c "SELECT 1;"

# Should print: 1 ✓
```

---

## Troubleshooting

### "Connection refused"
- Ensure Neon database is created
- Check connection string is correct
- Verify network connectivity

### "Permission denied"
- Check username/password
- Ensure user has CREATE permissions
- Verify role is not restricted

### Migration incomplete
- Check SQL Editor for error messages
- Scroll through output to find failure point
- Can re-run safely (uses `CREATE TABLE IF NOT EXISTS`)

### Still having issues?
1. Check Neon status: https://status.neon.tech
2. Try different browser (clear cache)
3. Create new database and retry
4. Contact Neon support

---

## File Locations

```
MIGRATION_SETUP.sql                  ← Run this file
DATABASE_MIGRATION_GUIDE.md          ← Detailed guide
DATABASE_MIGRATION_QUICK_START.md    ← This file
```

---

## Next Steps

1. ✅ Run migration (`MIGRATION_SETUP.sql`)
2. ✅ Verify all tables created
3. ⏳ Set DATABASE_URL in Render dashboard
4. ⏳ Deploy backend service
5. ⏳ Deploy orchestrator service
6. ⏳ Test API endpoints

---

## Environment Variables (After Migration)

For your backend services, set these:

**Backend:**
```
DATABASE_URL=postgres://...
REDIS_URL=rediss://...  (add later)
```

**Orchestrator:**
```
DATABASE_URL=postgres://...
REDIS_URL=rediss://...  (add later)
```

---

## Timeline

| Task | Time |
|------|------|
| Create Neon database | 1 min |
| Get connection string | 1 min |
| Copy migration file | 1 min |
| Run migration | 2-5 min |
| Verify tables | 1 min |
| Set env variables | 5 min |
| **Total** | **~15 min** |

---

## Key Facts

- ✅ Fully typed schema (no generic columns)
- ✅ All indexes created for performance
- ✅ Foreign keys with ON DELETE CASCADE
- ✅ Triggers for updated_at timestamps
- ✅ Views for common queries
- ✅ 10 categories pre-seeded
- ✅ Ready for production use

---

## Support

- **Neon:** https://console.neon.tech
- **PostgreSQL:** https://www.postgresql.org/docs/15/
- **Migration File:** `MIGRATION_SETUP.sql`

---

**Status: Ready to Deploy** ✅

Execute `MIGRATION_SETUP.sql` when Render services are live.
