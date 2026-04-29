# API Reference

Complete API documentation for The Autonomous AI Startup Architecture.

## Overview

The API uses REST conventions with JSON request/response bodies. All timestamps are in ISO 8601 format.

**Base URL**: `http://localhost:3000`

## Authentication

### Basic Auth

```bash
curl -u username:password http://localhost:3000/api/agents
```

### API Key

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/agents
```

### Environment Variables

```bash
AUTH_USER=admin
AUTH_PASS=password
API_KEY=your-api-key
```

## Response Format

### Success Response

```json
{
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20
  }
}
```

### Error Response

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters",
    "details": {
      "field": "title",
      "issue": "Required field missing"
    }
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Permission denied |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Agents API

### List Agents

Retrieve all agents.

```http
GET /api/agents
```

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `division` | string | Filter by division |
| `status` | string | Filter by status (idle/active/busy) |
| `limit` | number | Results per page (default: 100) |
| `offset` | number | Pagination offset |

**Response**:

```json
[
  {
    "id": "agent-uuid",
    "name": "Developer Agent",
    "slug": "developer",
    "role": "Lead Software Developer",
    "division": "engineering",
    "status": "idle",
    "specialization": "Full-stack development",
    "capabilities": ["coding", "architecture", "testing"],
    "technicalSkills": ["TypeScript", "React", "Node.js"],
    "personalityTraits": ["analytical", "detail-oriented"],
    "source": "local",
    "metrics": {
      "tasksCompleted": 45,
      "successRate": 0.95,
      "avgResponseTime": 1200
    },
    "createdAt": "2026-03-01T00:00:00Z",
    "updatedAt": "2026-03-11T12:00:00Z"
  }
]
```

### Get Agent

```http
GET /api/agents/:id
```

**Response**: Single agent object

### Create Agent

```http
POST /api/agents
```

**Request Body**:

```json
{
  "name": "New Agent",
  "role": "Specialist",
  "division": "engineering",
  "capabilities": ["coding", "testing"],
  "specialization": "Backend development",
  "technicalSkills": ["Python", "PostgreSQL"],
  "personalityTraits": ["methodical"]
}
```

**Response**: Created agent object

### Update Agent

```http
PATCH /api/agents/:id
```

**Request Body**: Partial agent object

### Delete Agent

```http
DELETE /api/agents/:id
```

### Sync Agents

Synchronize agents from workspace and OpenClaw.

```http
POST /api/agents/sync
```

**Response**:

```json
{
  "synced": 112,
  "fromWorkspace": 6,
  "fromOpenClaw": 0,
  "fromConfig": 106
}
```

### Import Agents

Import agents from external repository.

```http
POST /api/agents/import
```

**Request Body**:

```json
{
  "source": "agency-agents",
  "division": "game-development",
  "count": 10
}
```

---

## Tasks API

### List Tasks

```http
GET /api/tasks
```

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `status` | string | Filter by status |
| `assigned_to` | string | Filter by agent ID |
| `priority` | string | Filter by priority |
| `limit` | number | Results per page |

**Response**:

```json
[
  {
    "id": "task-uuid",
    "title": "Implement feature X",
    "description": "Detailed description",
    "status": "in_progress",
    "priority": "high",
    "assignedTo": "agent-uuid",
    "dependencies": ["task-uuid-2"],
    "estimatedHours": 4,
    "actualHours": null,
    "tags": ["feature", "backend"],
    "subtasks": [],
    "context": {},
    "createdAt": "2026-03-11T10:00:00Z",
    "updatedAt": "2026-03-11T12:00:00Z"
  }
]
```

### Create Task

```http
POST /api/tasks
```

**Request Body**:

```json
{
  "title": "Task title",
  "description": "Task description",
  "priority": "high",
  "estimatedHours": 2,
  "tags": ["feature"],
  "autoAssign": true
}
```

### Update Task

```http
PATCH /api/tasks/:id
```

### Delete Task

```http
DELETE /api/tasks/:id
```

### Get Task Queue

Get next available task for an agent.

```http
GET /api/tasks/queue?agent=:agentId
```

**Response**: Single task object or `null`

### Process Task

Send a task to an OpenClaw agent for processing.

```http
POST /api/tasks/process
```

**Request Body**:
```json
{
  "taskId": "optional-specific-task-id",
  "agentSlug": "optional-agent-slug"
}
```

If no `taskId` is provided, the next available task with status `todo` is selected.

**Response**:
```json
{
  "success": true,
  "taskId": "abc123",
  "title": "Task Title",
  "agent": "task-planner",
  "status": "in_progress",
  "message": "Task sent to agent task-planner"
}
```

---

## Analytics API

### System Health

```http
GET /api/analytics/system
```

**Response**:

```json
{
  "database": {
    "sizeBytes": 1234567,
    "sizeMB": 1.18,
    "tableCount": 10,
    "totalRows": 5000,
    "walSize": 0
  },
  "agents": {
    "total": 112,
    "active": 15,
    "idle": 97,
    "byDivision": {
      "engineering": 18,
      "marketing": 18,
      "game-development": 19
    }
  },
  "connections": {
    "active": 1,
    "total": 1
  },
  "uptime": 86400,
  "lastUpdated": "2026-03-11T12:00:00Z"
}
```

### Agent Metrics

```http
GET /api/analytics/agents
```

**Query Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `agentId` | string | Filter by specific agent |

**Response**:

```json
[
  {
    "agentId": "agent-uuid",
    "name": "Developer Agent",
    "division": "engineering",
    "tasksCompleted": 45,
    "tasksInProgress": 2,
    "tasksFailed": 1,
    "successRate": 0.94,
    "avgResponseTime": 1200,
    "avgTaskDuration": 3600,
    "lastActive": "2026-03-11T12:00:00Z"
  }
]
```

### Task Analytics

```http
GET /api/analytics/tasks
```

**Response**:

```json
{
  "totalTasks": 500,
  "byStatus": {
    "todo": 50,
    "in_progress": 25,
    "done": 400,
    "blocked": 25
  },
  "byPriority": {
    "critical": 10,
    "high": 100,
    "medium": 300,
    "low": 90
  },
  "completionRate": 0.8,
  "avgDuration": 7200,
  "bottlenecks": [
    { "status": "review", "count": 15, "avgAge": 3600 }
  ],
  "throughput": {
    "daily": 20,
    "weekly": 100,
    "monthly": 400
  }
}
```

### Performance Metrics

```http
GET /api/analytics/performance
```

**Response**:

```json
{
  "responseTime": {
    "avg": 150,
    "p50": 100,
    "p95": 350,
    "p99": 800
  },
  "throughput": {
    "requestsPerSecond": 50,
    "tasksPerHour": 25
  },
  "cache": {
    "hitRate": 0.85,
    "size": 5000,
    "maxSize": 10000
  },
  "errors": {
    "rate": 0.01,
    "count": 5,
    "byType": {
      "validation": 3,
      "database": 2
    }
  }
}
```

---

## OpenClaw API

### Connection Status

```http
GET /api/openclaw/status
```

**Response**:

```json
{
  "state": "connected",
  "authenticated": true,
  "gatewayUrl": "ws://127.0.0.1:18789/v3/control",
  "connectedAt": "2026-03-11T10:00:00Z",
  "messageQueue": 0,
  "lastPing": "2026-03-11T12:00:00Z"
}
```

### Connect to Gateway

```http
POST /api/openclaw/connect
```

**Request Body** (optional):

```json
{
  "host": "gateway.example.com",
  "port": 18789,
  "secure": true
}
```

### List Channels

```http
GET /api/openclaw/channels
```

**Response**:

```json
[
  {
    "id": "slack-general",
    "name": "General Channel",
    "platform": "slack",
    "enabled": true,
    "config": {
      "slackWorkspace": "workspace",
      "slackChannel": "#general"
    },
    "agentMappings": [
      {
        "agentSlug": "task-planner",
        "role": "responder",
        "filter": {
          "mentionRequired": true
        }
      }
    ]
  }
]
```

### Configure Channel

```http
POST /api/openclaw/channels
```

**Request Body**:

```json
{
  "id": "new-channel",
  "name": "New Channel",
  "platform": "discord",
  "enabled": true,
  "config": {
    "discordGuild": "guild-id",
    "discordChannel": "channel-name"
  },
  "agentMappings": []
}
```

### Send Message

```http
POST /api/openclaw/send
```

**Request Body**:

```json
{
  "channelId": "slack-general",
  "content": "Hello from AI Startup!",
  "agentId": "marketing",
  "format": "markdown"
}
```

### Sync Agents to OpenClaw

```http
POST /api/openclaw/sync
```

**Response**:

```json
{
  "pushed": 112,
  "pulled": 0,
  "conflicts": 0
}
```

---

## Gateways API

### List Gateways

```http
GET /api/gateways
```

**Response**:

```json
[
  {
    "id": "gateway-uuid",
    "name": "Primary Gateway",
    "url": "ws://127.0.0.1:18789",
    "status": "connected",
    "createdAt": "2026-03-01T00:00:00Z"
  }
]
```

### Register Gateway

```http
POST /api/gateways
```

**Request Body**:

```json
{
  "name": "New Gateway",
  "url": "ws://gateway.example.com:18789",
  "token": "gateway-token"
}
```

---

## Webhooks API

### List Webhooks

```http
GET /api/webhooks
```

**Response**:
```json
[
  {
    "id": "abc123",
    "name": "My Webhook",
    "url": "https://example.com/webhook",
    "method": "POST",
    "events": ["task.completed", "agent.error"],
    "status": "active",
    "lastTriggered": null,
    "successRate": 100,
    "totalCalls": 0
  }
]
```

### Create Webhook

```http
POST /api/webhooks
```

**Request Body**:
```json
{
  "name": "My Webhook",
  "url": "https://example.com/webhook",
  "method": "POST",
  "events": ["task.completed"]
}
```

### Delete Webhook

```http
DELETE /api/webhooks?id=webhook-id
```

---

## WebSocket Protocol

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3000/api/ws');

ws.onopen = () => {
  // Authenticate
  ws.send(JSON.stringify({
    type: 'auth',
    payload: { token: 'your-token' }
  }));
};
```

### Message Types

#### Client → Server

| Type | Description |
|------|-------------|
| `auth` | Authenticate connection |
| `subscribe` | Subscribe to events |
| `unsubscribe` | Unsubscribe from events |
| `ping` | Keep-alive ping |

#### Server → Client

| Type | Description |
|------|-------------|
| `auth_response` | Authentication result |
| `event` | System event |
| `pong` | Keep-alive response |
| `error` | Error message |

### Event Subscription

```javascript
// Subscribe to agent events
ws.send(JSON.stringify({
  type: 'subscribe',
  payload: { events: ['agent.created', 'agent.updated', 'task.assigned'] }
}));

// Receive events
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'event') {
    console.log('Event:', data.payload);
  }
};
```

### Event Types

| Event | Description |
|-------|-------------|
| `agent.created` | New agent created |
| `agent.updated` | Agent updated |
| `agent.deleted` | Agent deleted |
| `task.created` | New task created |
| `task.assigned` | Task assigned to agent |
| `task.completed` | Task completed |
| `message.received` | Message from channel |
| `system.health` | System health update |

---

## Rate Limiting

| Endpoint | Limit |
|----------|-------|
| General API | 100 req/min |
| Auth endpoints | 10 req/min |
| Analytics | 30 req/min |
| WebSocket | 50 msg/min |

**Rate Limit Headers**:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1710158400
```

---

## Pagination

```http
GET /api/agents?limit=20&offset=40
```

**Response Headers**:

```http
X-Total-Count: 112
X-Page: 3
X-Per-Page: 20
```

---

## Filtering & Sorting

```http
# Filter
GET /api/tasks?status=todo&priority=high

# Sort
GET /api/agents?sort=name&order=asc

# Search
GET /api/agents?search=developer
```

---

## SDK Usage

### JavaScript/TypeScript

```typescript
// Using fetch
const response = await fetch('/api/agents', {
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your-api-key'
  }
});
const agents = await response.json();

// Create task with auto-assign
await fetch('/api/tasks', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    title: 'New feature',
    description: 'Implement X',
    autoAssign: true
  })
});
```

### Python

```python
import requests

# List agents
response = requests.get(
    'http://localhost:3000/api/agents',
    headers={'X-API-Key': 'your-api-key'}
)
agents = response.json()

# Create task
task = requests.post(
    'http://localhost:3000/api/tasks',
    json={'title': 'New task', 'autoAssign': True},
    headers={'X-API-Key': 'your-api-key'}
).json()
```

### cURL

```bash
# List agents
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/agents

# Create task
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"title": "New task", "autoAssign": true}'
```

---

## Related Documentation

- [Architecture](./ARCHITECTURE.md) - System design
- [OpenClaw Integration](./OPENCLAW_INTEGRATION.md) - Gateway setup
- [Deployment](./DEPLOYMENT.md) - Deployment guide
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues
