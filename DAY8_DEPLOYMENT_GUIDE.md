# Day 8 Deployment Guide

**Deployment Phase:** Phase 2 Completion  
**Risk Level:** Low (isolated new services, non-breaking changes)  
**Rollback Time:** < 5 minutes  
**Testing Time:** ~30 minutes  

---

## Pre-Deployment Requirements

### Environment Setup
```bash
# Ensure you're on main branch
git checkout main
git pull origin main

# Install dependencies
npm install

# Set environment variables (if not already set)
cp .env.example .env
# Edit .env with actual values:
# - DATABASE_URL
# - LOG_LEVEL=info
# - NODE_ENV=staging (or production)
```

### Verification Steps
```bash
# 1. Type check
npm run build
# Should complete with no errors

# 2. Lint check
npm run lint
# Should pass all rules

# 3. Run Day 8 tests
npm run test -- day8-revenue-settlement.test.ts
# Should show: 25+ tests passing

# 4. Full test suite
npm run test
# All tests should pass
```

---

## Deployment Steps

### Step 1: Database Migration

```bash
# Create backup before migration
pg_dump clawhouse > backup_pre_day8.sql

# Run migration
npm run db:migrate -- 009_agent_statistics.sql

# Verify table creation
psql -d clawhouse -c "
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_name = 'agent_statistics';"
# Should return: agent_statistics

# Verify indexes
psql -d clawhouse -c "
  SELECT indexname 
  FROM pg_indexes 
  WHERE tablename = 'agent_statistics';"
# Should return 4 indexes:
# - agent_statistics_pkey
# - idx_agent_statistics_room
# - idx_agent_statistics_agent
# - idx_agent_statistics_score
# - idx_agent_statistics_created
```

### Step 2: Code Deployment

```bash
# Build the application
npm run build

# Verify build output
ls -la dist/
# Should contain compiled files

# Run final test
npm run test -- day8-revenue-settlement.test.ts

# Deploy code
# (Use your standard deployment process)
# Example:
git checkout -b release/day8
git add .
git commit -m "Deploy Day 8: Revenue distribution & settlement"
git push origin release/day8
# Create PR and merge to main
```

### Step 3: Service Restart

```bash
# Option A: Docker deployment
docker-compose down
docker-compose up -d

# Option B: PM2 deployment
pm2 reload clawhouse
# or
pm2 restart clawhouse

# Option C: Direct restart
npm stop
npm start

# Wait for service startup
sleep 5

# Verify service is running
curl -s http://localhost:4000/health | jq .
# Should return: { "status": "ok" }
```

### Step 4: Verification

```bash
# Check logs for startup errors
tail -f logs/app.log
# Look for: "Starting room orchestration service" and no ERROR entries

# Verify database connection
npm run test -- --grep "database"

# Test API endpoints (if applicable)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:4000/api/rooms

# Monitor for 5 minutes
watch -n 1 'tail -n 5 logs/app.log'
```

---

## Service Integration Verification

### Check Service Imports

```bash
# Verify imports are correct
grep -n "agentStatisticsService" \
  backend/src/services/room-orchestration-service.ts
# Should show import and usage

grep -n "revenueDistributionService" \
  backend/src/services/room-orchestration-service.ts
# Should show import and usage
```

### Check Service Exports

```bash
# Verify services are exported
grep -n "export" \
  backend/src/services/agent-statistics-service.ts \
  backend/src/services/revenue-distribution-service.ts
# Should show singleton exports

# Verify index exports (if applicable)
grep -n "agentStatisticsService\|revenueDistributionService" \
  backend/src/services/index.ts
```

---

## Monitoring Post-Deployment

### Log Monitoring

```bash
# Watch for key events
tail -f logs/app.log | grep -E "(Room closed|Agent statistics|Revenue distributed)"

# Watch for errors
tail -f logs/app.log | grep ERROR

# Watch for warnings
tail -f logs/app.log | grep WARN
```

### Database Monitoring

```bash
# Monitor table growth
watch -n 10 'psql -d clawhouse -c "
  SELECT COUNT(*) as stats_count 
  FROM agent_statistics;"'

# Check for lock contention
psql -d clawhouse -c "
  SELECT pid, usename, state, query 
  FROM pg_stat_activity 
  WHERE state != 'idle';"
```

### Performance Monitoring

```bash
# Check query performance
psql -d clawhouse -c "
  SELECT mean_time, calls, query 
  FROM pg_stat_statements 
  WHERE query LIKE '%agent_statistics%' 
  ORDER BY mean_time DESC;"

# Monitor disk usage
du -sh /var/lib/postgresql/data/

# Monitor CPU/Memory (Linux)
top -p $(pgrep -f 'postgres|node')
```

---

## Testing in Production

### Manual Testing

```bash
# 1. Create a test room and run it to completion
# (Use your normal room creation flow)

# 2. Verify statistics were created
psql -d clawhouse -c "
  SELECT room_id, agent_id, messages_submitted, messages_selected 
  FROM agent_statistics 
  ORDER BY created_at DESC LIMIT 1;"

# 3. Verify revenue was calculated
grep "Revenue distributed" logs/app.log | tail -1

# 4. Check leaderboard query
psql -d clawhouse -c "
  SELECT agent_id, COUNT(*) as participations, 
         AVG(average_score) as avg_score 
  FROM agent_statistics 
  GROUP BY agent_id 
  ORDER BY avg_score DESC LIMIT 5;"
```

### Automated Testing

```bash
# Run smoke tests
npm run test:smoke

# Run integration tests
npm run test:integration

# Run Day 8 specific tests with coverage
npm run test -- day8-revenue-settlement.test.ts --coverage
```

---

## Rollback Procedure

### If Issues Are Detected

```bash
# 1. Immediate actions
# Stop accepting new room creation
# Mark system as maintenance

# 2. Revert database migration (if needed)
psql -d clawhouse -f backup_pre_day8.sql
# or use pg_restore

# 3. Revert code
git revert HEAD
npm run build
npm start

# 4. Verify rollback
curl http://localhost:4000/health

# 5. Monitor logs
tail -f logs/app.log
```

### Data Recovery

```bash
# If data was corrupted in agent_statistics table
psql -d clawhouse -c "
  DROP TABLE agent_statistics CASCADE;"

# Rerun migration
npm run db:migrate -- 009_agent_statistics.sql

# Regenerate statistics from message history
# (Script can be created in Phase 2)
```

---

## Troubleshooting

### Issue: "agent_statistics" table not found

**Solution:**
```bash
# Verify migration ran
npm run db:migrate:status

# Manually run migration
psql -d clawhouse -f migrations/009_agent_statistics.sql

# Verify table exists
psql -d clawhouse -c "\dt agent_statistics"
```

### Issue: Services not found error

**Solution:**
```bash
# Check file exists
ls -la backend/src/services/agent-statistics-service.ts
ls -la backend/src/services/revenue-distribution-service.ts

# Check imports in room-orchestration-service.ts
grep -n "import.*statistics\|import.*revenue" \
  backend/src/services/room-orchestration-service.ts

# Rebuild
npm run build

# Restart service
npm start
```

### Issue: Revenue distribution not triggering

**Solution:**
```bash
# Check logs for room closure
tail -f logs/app.log | grep "Closing room"

# Check if room reaches completion
psql -d clawhouse -c "
  SELECT id, status, completion_percentage 
  FROM room 
  ORDER BY created_at DESC LIMIT 5;"

# Verify output contract service is working
tail -f logs/app.log | grep "completion"
```

### Issue: Database migration fails

**Solution:**
```bash
# Check current migration status
npm run db:migrate:status

# Check for syntax errors in migration file
psql -d clawhouse -f migrations/009_agent_statistics.sql --dry-run
# (If supported by your CLI)

# Check for existing table/indexes
psql -d clawhouse -c "
  SELECT tablename, indexname 
  FROM pg_indexes 
  WHERE tablename LIKE 'agent%';"

# If table exists, skip migration or drop and recreate
psql -d clawhouse -c "DROP TABLE IF EXISTS agent_statistics CASCADE;"
```

---

## Performance Tuning

### After Deployment

```bash
# 1. Check slow queries
psql -d clawhouse -c "
  SELECT query, mean_time, calls 
  FROM pg_stat_statements 
  ORDER BY mean_time DESC LIMIT 10;"

# 2. Analyze query plans
psql -d clawhouse -c "
  EXPLAIN ANALYZE 
  SELECT * FROM agent_statistics 
  WHERE agent_id = 'test-id';"

# 3. Verify index usage
psql -d clawhouse -c "
  SELECT schemaname, tablename, indexname, idx_scan 
  FROM pg_stat_user_indexes 
  WHERE tablename = 'agent_statistics';"

# 4. Run VACUUM ANALYZE to update statistics
psql -d clawhouse -c "VACUUM ANALYZE agent_statistics;"
```

### If Performance Is Degraded

```bash
# 1. Disable sequential scans (temporary)
SET enable_seqscan = OFF;

# 2. Increase work_mem for sorting
SET work_mem = '256MB';

# 3. Analyze execution plans
EXPLAIN VERBOSE SELECT ... 

# 4. Add more specific indexes if needed
# (But typically not needed for this schema)
```

---

## Success Criteria

### Day 8 Deployment Is Successful If:

✅ **Functionality**
- [ ] Room closure completes successfully
- [ ] Agent statistics table is populated
- [ ] Revenue is distributed correctly
- [ ] All three services work without errors

✅ **Data Integrity**
- [ ] Statistics records have correct counts
- [ ] Revenue calculations sum to 100%
- [ ] No duplicate entries in agent_statistics
- [ ] Foreign key constraints maintained

✅ **Performance**
- [ ] Room closure completes in < 5 seconds
- [ ] No database locks
- [ ] CPU/Memory usage normal
- [ ] No slow queries (> 1 second)

✅ **Reliability**
- [ ] No error spikes in logs
- [ ] Service restarts cleanly
- [ ] Can handle 10+ concurrent room closures
- [ ] Graceful error handling

✅ **Monitoring**
- [ ] Logs properly formatted
- [ ] Errors have full context
- [ ] Metrics are trackable
- [ ] Alerts can be configured

---

## Post-Deployment Checklist

### Hour 1
- [ ] Service running without errors
- [ ] Database connection stable
- [ ] Statistics table receiving data
- [ ] Logs clean and readable

### Day 1
- [ ] 10+ successful room closures
- [ ] Statistics accurately calculated
- [ ] Revenue distributions logged
- [ ] No data integrity issues

### Week 1
- [ ] Performance metrics stable
- [ ] Error rate < 0.1%
- [ ] Data consistency verified
- [ ] Leaderboard queries fast

---

## Support & Escalation

### If Issues Arise

1. **Check logs first**
   ```bash
   tail -f logs/app.log | grep ERROR
   ```

2. **Verify database**
   ```bash
   psql -d clawhouse -c "SELECT COUNT(*) FROM agent_statistics;"
   ```

3. **Run tests**
   ```bash
   npm run test -- day8-revenue-settlement.test.ts
   ```

4. **Check services**
   ```bash
   curl http://localhost:4000/health
   ```

5. **If stuck, rollback**
   ```bash
   git revert HEAD
   npm run build
   npm start
   ```

### Contact Information
- **Backend Lead:** [Your name]
- **DevOps:** [DevOps contact]
- **Database:** [DB admin]
- **On-Call:** [On-call engineer]

---

## Documentation References

- **Architecture:** AGENTS.md (Day 8 section)
- **API Reference:** DAY8_QUICK_REFERENCE.md
- **Test Suite:** backend/tests/integration/day8-revenue-settlement.test.ts
- **Verification:** DAY8_VERIFICATION_CHECKLIST.md
- **Summary:** DAY8_EXECUTION_SUMMARY.md

---

## Sign-Off

### Deployment Checklist
- [ ] Code reviewed and approved
- [ ] All tests passing
- [ ] Database migration tested
- [ ] Environment variables set
- [ ] Rollback plan ready
- [ ] Team notified

### Deployed By
**Name:** _________________  
**Date:** _________________  
**Signature:** _________________

### Verified By
**Name:** _________________  
**Date:** _________________  
**Status:** ✅ Production Ready

---

**Last Updated:** Feb 16, 2026  
**Deployment Status:** Ready to Deploy
