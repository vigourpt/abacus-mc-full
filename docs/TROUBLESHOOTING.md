# Troubleshooting Guide

This guide helps diagnose and resolve common issues with The Autonomous AI Startup Architecture.

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Startup Issues](#startup-issues)
3. [Database Problems](#database-problems)
4. [Agent Issues](#agent-issues)
5. [Task Processing](#task-processing)
6. [OpenClaw Connection](#openclaw-connection)
7. [Performance Issues](#performance-issues)
8. [API Errors](#api-errors)
9. [Debug Mode](#debug-mode)
10. [Getting Help](#getting-help)

## Quick Diagnostics

### System Health Check

```bash
# Check overall system health
curl http://localhost:3000/api/analytics/system

# Expected response
{
  "database": { "sizeBytes": 1234567, "tableCount": 10, "totalRows": 5000 },
  "agents": { "total": 112, "active": 15, "idle": 97 },
  "connections": { "active": 1, "total": 1 },
  "uptime": 86400
}
```

### Quick Health Commands

```bash
# Check if server is running
curl -f http://localhost:3000/api/health || echo "Server not responding"

# Check database
pnpm db:status

# Check agent count
curl -s http://localhost:3000/api/agents | jq '.length'

# Check OpenClaw connection
curl http://localhost:3000/api/openclaw/status

# View recent logs
tail -100 .data/logs/app.log
```

## Startup Issues

### Server Won't Start

**Symptom**: `pnpm dev` fails or hangs

**Solutions**:

```bash
# 1. Check port availability
lsof -i :3000
# Kill conflicting process
kill -9 <PID>

# 2. Clear cache and reinstall
rm -rf .next node_modules
pnpm install

# 3. Check for TypeScript errors
pnpm type-check

# 4. Verify environment
cat .env

# 5. Check Node.js version
node --version  # Should be 20+
```

### Build Errors

**Symptom**: `pnpm build` fails

```bash
# View detailed build errors
pnpm build 2>&1 | head -100

# Common fixes:
# 1. Missing dependencies
pnpm install

# 2. Type errors
pnpm type-check --noEmit

# 3. Clear Next.js cache
rm -rf .next

# 4. Update dependencies
pnpm update
```

### Missing Dependencies

**Symptom**: `Module not found` errors

```bash
# Reinstall all dependencies
rm -rf node_modules pnpm-lock.yaml
pnpm install

# If specific package missing
pnpm add <package-name>
```

## Database Problems

### Database Locked

**Symptom**: `SQLITE_BUSY: database is locked`

**Cause**: Multiple processes accessing database, or WAL checkpoint issues

```bash
# 1. Check for multiple processes
ps aux | grep -E "node|next"

# 2. Kill stale processes
pkill -f "next-server"

# 3. Enable WAL mode (one-time fix)
sqlite3 .data/ai-startup.db "PRAGMA journal_mode=WAL;"

# 4. Force checkpoint
sqlite3 .data/ai-startup.db "PRAGMA wal_checkpoint(TRUNCATE);"

# 5. Restart application
pnpm dev
```

### Database Corruption

**Symptom**: Unexpected errors, missing data

```bash
# 1. Check integrity
sqlite3 .data/ai-startup.db "PRAGMA integrity_check;"

# 2. If corrupt, recover from backup
cp .data/backups/ai-startup-latest.db .data/ai-startup.db

# 3. Or rebuild database
mv .data/ai-startup.db .data/ai-startup.db.corrupt
pnpm db:migrate
pnpm db:seed
```

### Migration Failures

**Symptom**: Schema errors, missing columns

```bash
# 1. Check current schema
sqlite3 .data/ai-startup.db ".schema agents"

# 2. Force re-run migrations
pnpm db:migrate

# 3. Manual migration (if needed)
sqlite3 .data/ai-startup.db "ALTER TABLE agents ADD COLUMN specialization TEXT;"
```

### Performance Issues

**Symptom**: Slow queries, high CPU from database

```bash
# 1. Optimize database
pnpm db:optimize

# 2. Check table sizes
sqlite3 .data/ai-startup.db "
  SELECT name, 
    (SELECT COUNT(*) FROM agents) as agent_count,
    (SELECT COUNT(*) FROM tasks) as task_count;
"

# 3. Clean up old data
sqlite3 .data/ai-startup.db "
  DELETE FROM activity_log WHERE created_at < datetime('now', '-30 days');
  VACUUM;
"

# 4. Add indexes if missing
sqlite3 .data/ai-startup.db "
  CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
  CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to);
"
```

## Agent Issues

### Agents Not Loading

**Symptom**: Empty agent list, agents not appearing

```bash
# 1. Check database for agents
curl http://localhost:3000/api/agents | jq '.length'

# 2. Sync agents from workspace
curl -X POST http://localhost:3000/api/agents/sync

# 3. Check workspace directory
ls -la workspace/agents/

# 4. Manually seed agents
pnpm tsx scripts/seed-agents.ts
```

### Agent Sync Failing

**Symptom**: Agents not syncing from workspace or OpenClaw

```bash
# 1. Check workspace structure
find workspace/agents -name "soul.md" | head -10

# 2. Verify soul.md format
cat workspace/agents/ceo/soul.md | head -20

# 3. Check sync logs
curl -X POST http://localhost:3000/api/agents/sync 2>&1

# 4. Manual import
pnpm tsx scripts/import-specialized-agents.ts
```

### Agent Status Stuck

**Symptom**: Agent shows wrong status (always idle/active)

```bash
# 1. Check agent status
curl http://localhost:3000/api/agents | jq '.[] | {name, status}'

# 2. Reset agent status
sqlite3 .data/ai-startup.db "
  UPDATE agents SET status = 'idle' WHERE status = 'active';
"

# 3. Restart server
pm2 restart ai-startup  # or restart your process
```

## Task Processing

### Tasks Not Being Assigned

**Symptom**: Tasks stay in 'todo' status

```bash
# 1. Check available agents
curl http://localhost:3000/api/agents | jq '[.[] | select(.status == "idle")] | length'

# 2. Check task assignment
curl http://localhost:3000/api/tasks | jq '.[] | {title, status, assigned_to}'

# 3. Manually trigger assignment
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Test task", "autoAssign": true}'

# 4. Check task planner logs
grep "task-planner" .data/logs/app.log | tail -20
```

### Task Dependencies Not Working

**Symptom**: Dependent tasks not waiting, wrong execution order

```bash
# 1. Check task dependencies
sqlite3 .data/ai-startup.db "
  SELECT t.title, d.depends_on_task_id 
  FROM tasks t 
  LEFT JOIN task_dependencies d ON t.id = d.task_id 
  WHERE d.depends_on_task_id IS NOT NULL;
"

# 2. Check dependency status
curl http://localhost:3000/api/tasks/queue?agent=task-planner

# 3. Verify canTaskStart logic
# This is handled by TaskPlanner.canTaskStart()
```

### Tasks Stuck in Progress

**Symptom**: Tasks never complete

```bash
# 1. Find stuck tasks
sqlite3 .data/ai-startup.db "
  SELECT id, title, assigned_to, updated_at 
  FROM tasks 
  WHERE status = 'in_progress' 
  AND updated_at < datetime('now', '-1 hour');
"

# 2. Reset stuck tasks
sqlite3 .data/ai-startup.db "
  UPDATE tasks 
  SET status = 'todo', assigned_to = NULL 
  WHERE status = 'in_progress' 
  AND updated_at < datetime('now', '-2 hours');
"
```

## OpenClaw Connection

### Cannot Connect to Gateway

**Symptom**: WebSocket connection fails

```bash
# 1. Check gateway is reachable
nc -zv 127.0.0.1 18789

# 2. Verify configuration
cat .data/openclaw-config.json | jq '.connection'

# 3. Check environment variables
echo $OPENCLAW_GATEWAY_HOST
echo $OPENCLAW_GATEWAY_PORT

# 4. Test WebSocket manually
websocat ws://127.0.0.1:18789/v3/control
```

### Authentication Failing

**Symptom**: `auth_error` or connection rejected

```bash
# 1. Check device identity
cat .data/device-identity.json | jq '.publicKey'

# 2. Regenerate identity
rm .data/device-identity.json
curl -X POST http://localhost:3000/api/openclaw/connect

# 3. Verify gateway token
echo $OPENCLAW_GATEWAY_TOKEN

# 4. Check gateway logs (if you have access)
docker logs openclaw-gateway | tail -50
```

### Messages Not Routing

**Symptom**: Messages received but not reaching agents

```bash
# 1. Check channel configuration
curl http://localhost:3000/api/openclaw/channels | jq '.'

# 2. Verify agent mappings
cat .data/openclaw-config.json | jq '.channels[].agentMappings'

# 3. Check message filters
# Ensure mentionRequired, keywordTriggers are correct

# 4. Enable debug mode
# Set "debugMode": true in openclaw-config.json
```

### Frequent Disconnections

**Symptom**: WebSocket keeps disconnecting

```bash
# 1. Check connection stability
curl http://localhost:3000/api/openclaw/status

# 2. Increase ping interval
# In openclaw-config.json: "pingInterval": 30000

# 3. Check for network issues
ping -c 10 $OPENCLAW_GATEWAY_HOST

# 4. Review reconnection settings
cat .data/openclaw-config.json | jq '.connection | {reconnectInterval, maxReconnectAttempts}'
```

## Performance Issues

### High CPU Usage

**Symptom**: Server consuming excessive CPU

```bash
# 1. Profile the application
node --prof server.js
# Then analyze with: node --prof-process isolate-*.log

# 2. Check for busy loops
top -p $(pgrep -f "next-server")

# 3. Common causes:
# - Excessive logging (reduce LOG_LEVEL)
# - Large task queue
# - WebSocket reconnection loops

# 4. Reduce analytics frequency
# Analytics are cached for 30s by default
```

### High Memory Usage

**Symptom**: Out of memory errors, slow performance

```bash
# 1. Check memory usage
ps -o pid,vsz,rss,comm -p $(pgrep -f "next-server")

# 2. Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=4096"
pnpm start

# 3. Clear caches
curl -X POST http://localhost:3000/api/admin/cache/clear

# 4. Check for memory leaks
# Use Chrome DevTools with --inspect flag
node --inspect server.js
```

### Slow API Responses

**Symptom**: API taking >1s to respond

```bash
# 1. Check response times
curl -w "@curl-format.txt" http://localhost:3000/api/agents

# 2. Enable performance monitoring
curl http://localhost:3000/api/analytics/performance

# 3. Optimize database
pnpm db:optimize

# 4. Check cache hit rates
# Look for cache misses in logs
grep "cache miss" .data/logs/app.log | wc -l
```

### Slow Dashboard Loading

**Symptom**: UI takes long to load

```bash
# 1. Check API response times
time curl http://localhost:3000/api/agents
time curl http://localhost:3000/api/tasks
time curl http://localhost:3000/api/analytics/system

# 2. Reduce data loaded
# Use pagination in API calls

# 3. Check network latency
# Use browser DevTools Network tab
```

## API Errors

### 401 Unauthorized

**Symptom**: API returns 401

```bash
# 1. Check credentials
echo $AUTH_USER
echo $AUTH_PASS

# 2. Test with correct auth
curl -u admin:password http://localhost:3000/api/agents

# 3. Check API key
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/agents
```

### 500 Internal Server Error

**Symptom**: API returns 500

```bash
# 1. Check server logs
tail -100 .data/logs/app.log | grep -i error

# 2. Enable verbose logging
export LOG_LEVEL=debug
pnpm dev

# 3. Check specific endpoint
curl -v http://localhost:3000/api/failing-endpoint 2>&1

# 4. Common causes:
# - Database connection issues
# - Missing environment variables
# - Malformed request data
```

### CORS Errors

**Symptom**: Browser blocks requests

```bash
# 1. Check CORS headers
curl -I http://localhost:3000/api/agents

# 2. Verify allowed origins
# Configure in next.config.ts

# 3. For development, use:
# Access-Control-Allow-Origin: *
```

## Debug Mode

### Enabling Debug Mode

```bash
# 1. Set environment variable
export LOG_LEVEL=debug

# 2. Or in .env
LOG_LEVEL=debug

# 3. Enable OpenClaw debug
# In .data/openclaw-config.json: "debugMode": true

# 4. Restart server
pnpm dev
```

### Viewing Logs

```bash
# Application logs
tail -f .data/logs/app.log

# With pino-pretty formatting
tail -f .data/logs/app.log | pnpm pino-pretty

# Filter by module
grep "task-planner" .data/logs/app.log

# Filter by log level
grep '"level":50' .data/logs/app.log  # Errors only
```

### Debug API Endpoints

```bash
# System diagnostics
curl http://localhost:3000/api/analytics/system

# Agent metrics
curl http://localhost:3000/api/analytics/agents

# Performance data
curl http://localhost:3000/api/analytics/performance

# Database status
pnpm db:status
```

## Getting Help

### Collect Diagnostic Information

Before seeking help, gather:

```bash
# 1. System info
node --version
pnpm --version
cat /etc/os-release

# 2. Application version
cat package.json | jq '.version'

# 3. Database state
pnpm db:status

# 4. Recent errors
tail -200 .data/logs/app.log | grep -i error

# 5. Configuration (sanitized)
cat .data/openclaw-config.json | jq 'del(.connection.apiKey)'
```

### Log Files Location

| File | Location | Content |
|------|----------|---------|
| App logs | `.data/logs/app.log` | Application events |
| Error logs | `.data/logs/error.log` | Errors only |
| Access logs | `.data/logs/access.log` | HTTP requests |
| DB backups | `.data/backups/` | Database backups |

### Community Support

- **GitHub Issues**: [Report bugs](https://github.com/vigourpt/The-Autonomous-AI-Startup-Architecture/issues)
- **Discussions**: [Ask questions](https://github.com/vigourpt/The-Autonomous-AI-Startup-Architecture/discussions)
- **Discord**: Join the community server

### Related Documentation

- [Architecture](./ARCHITECTURE.md) - System design
- [Deployment](./DEPLOYMENT.md) - Deployment guide
- [OpenClaw Integration](./OPENCLAW_INTEGRATION.md) - Gateway setup
- [API Reference](./API_REFERENCE.md) - API documentation
