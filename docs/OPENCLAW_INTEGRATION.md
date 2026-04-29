# OpenClaw Integration Guide

## Overview

OpenClaw is a multi-channel messaging gateway that enables the Autonomous AI Startup to communicate across various platforms (Slack, Discord, WhatsApp, Telegram, Teams, etc.) through a unified interface. This guide covers setup, configuration, and usage.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Autonomous AI Startup                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                   Message Router                         │   │
│  │  • Routes incoming messages to appropriate agents        │   │
│  │  • Transforms agent responses to channel format          │   │
│  │  • Manages multi-agent channel conversations             │   │
│  └─────────────────────────────────────────────────────────┘   │
│                            ↕                                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  OpenClaw Client                         │   │
│  │  • WebSocket connection management                       │   │
│  │  • Ed25519 authentication                                │   │
│  │  • Message queue for offline scenarios                   │   │
│  │  • Automatic reconnection                                │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            ↕ WebSocket
┌─────────────────────────────────────────────────────────────────┐
│                     OpenClaw Gateway                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │  Slack   │ │ Discord  │ │ Telegram │ │  Teams   │   ...    │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Configure Environment Variables

Add the following to your `.env` file:

```bash
# OpenClaw Gateway Settings
OPENCLAW_GATEWAY_HOST=127.0.0.1
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_GATEWAY_TOKEN=your-gateway-token
OPENCLAW_CONFIG_PATH=.data/openclaw-config.json
OPENCLAW_STATE_DIR=.data/openclaw
OPENCLAW_MEMORY_DIR=.data/memory
```

### 2. Generate Device Identity

The system automatically generates Ed25519 key pairs for secure authentication:

```bash
# Keys are auto-generated on first connection
# Stored in .data/device-identity.json
pnpm run dev

# Or manually generate via API
curl -X POST http://localhost:3000/api/openclaw/connect
```

### 3. Connect to Gateway

```typescript
import { getOpenClawClient } from '@/lib/openclaw-client';

// Get singleton client instance
const client = getOpenClawClient();

// Connect to gateway
await client.connect();

// Listen for events
client.on('connected', () => console.log('Connected!'));
client.on('message', (msg) => console.log('Received:', msg));
```

## Configuration

### Configuration File Structure

Create `.data/openclaw-config.json`:

```json
{
  "connection": {
    "host": "127.0.0.1",
    "port": 18789,
    "secure": false,
    "reconnectInterval": 5000,
    "maxReconnectAttempts": 10,
    "pingInterval": 30000,
    "messageTimeout": 30000,
    "maxQueueSize": 1000
  },
  "channels": [
    {
      "id": "slack-general",
      "name": "General Channel",
      "platform": "slack",
      "enabled": true,
      "config": {
        "slackWorkspace": "your-workspace",
        "slackChannel": "#general"
      },
      "agentMappings": [
        {
          "agentSlug": "task-planner",
          "role": "responder",
          "filter": {
            "mentionRequired": true,
            "keywordTriggers": ["task", "help", "assign"]
          }
        }
      ]
    }
  ],
  "defaultAgent": "task-planner",
  "autoConnect": true,
  "debugMode": false
}
```

### Connection Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | string | `127.0.0.1` | Gateway hostname |
| `port` | number | `18789` | Gateway port |
| `secure` | boolean | `false` | Use WSS (WebSocket Secure) |
| `reconnectInterval` | number | `5000` | Reconnect delay (ms) |
| `maxReconnectAttempts` | number | `10` | Max reconnection attempts |
| `pingInterval` | number | `30000` | Keep-alive ping interval (ms) |
| `messageTimeout` | number | `30000` | Message response timeout (ms) |
| `maxQueueSize` | number | `1000` | Max offline message queue |

### Supported Platforms

| Platform | Config Keys | Description |
|----------|-------------|-------------|
| `slack` | `slackWorkspace`, `slackChannel` | Slack workspace integration |
| `discord` | `discordGuild`, `discordChannel` | Discord server integration |
| `telegram` | `telegramChatId` | Telegram bot integration |
| `whatsapp` | `whatsappNumber` | WhatsApp Business API |
| `teams` | `webhookUrl` | Microsoft Teams |
| `email` | `emailAddress` | Email communication |
| `webchat` | `apiKey` | Web chat widget |
| `matrix` | `metadata` | Matrix protocol |
| `irc` | `metadata` | IRC channels |
| `api` | `apiKey`, `webhookUrl` | Custom API integrations |

## Authentication

### Ed25519 Key Management

The system uses Ed25519 cryptographic keys for secure gateway authentication:

```typescript
import {
  getOrCreateDeviceIdentity,
  signMessage,
  verifySignature,
  createAuthPayload
} from '@/lib/device-identity';

// Get or create identity
const identity = await getOrCreateDeviceIdentity();
console.log('Public Key:', identity.publicKey);
console.log('Device ID:', identity.deviceId);

// Sign a message
const signature = signMessage('message-to-sign', identity);

// Verify signature
const isValid = verifySignature('message-to-sign', signature, identity.publicKey);

// Create auth payload for gateway
const authPayload = createAuthPayload(identity);
```

### Authentication Flow

1. **Connection Init**: Client connects to gateway WebSocket
2. **Challenge**: Gateway sends authentication challenge
3. **Response**: Client signs challenge with Ed25519 private key
4. **Verification**: Gateway verifies signature using public key
5. **Authenticated**: Connection established and ready

## Channel Configuration

### Adding a Channel

```typescript
import { upsertChannel } from '@/lib/openclaw-config';

upsertChannel({
  id: 'discord-support',
  name: 'Support Channel',
  platform: 'discord',
  enabled: true,
  config: {
    discordGuild: 'your-guild-id',
    discordChannel: 'support'
  },
  agentMappings: [
    {
      agentSlug: 'support-agent',
      role: 'responder',
      filter: {
        keywordTriggers: ['help', 'support', 'issue']
      }
    }
  ]
});
```

### Agent Mapping Roles

| Role | Description |
|------|-------------|
| `responder` | Agent can respond to messages in the channel |
| `listener` | Agent receives messages but doesn't respond directly |
| `broadcaster` | Agent can initiate messages (broadcasts) |

### Message Filters

```typescript
const filter: MessageFilter = {
  mentionRequired: true,      // Only process when agent is mentioned
  keywordTriggers: ['task'],  // Trigger on specific keywords
  excludePatterns: ['bot'],   // Ignore messages matching patterns
  minMessageLength: 5         // Minimum message length to process
};
```

## Message Routing

### How Messages are Routed

```
Incoming Message
       ↓
┌──────────────────┐
│ Message Router   │
│ ├─ Check channel │
│ ├─ Apply filters │
│ ├─ Find agents   │
│ └─ Route message │
└──────────────────┘
       ↓
┌──────────────────┐
│ Matching Agents  │
│ ├─ Task Planner  │
│ ├─ Support Agent │
│ └─ ...           │
└──────────────────┘
       ↓
┌──────────────────┐
│ Agent Response   │
│ └─ Format & Send │
└──────────────────┘
```

### Routing Configuration via API

```bash
# Get channel mappings
curl http://localhost:3000/api/openclaw/channels

# Map agent to channel
curl -X POST http://localhost:3000/api/openclaw/channels \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "slack-general",
    "agentSlug": "marketing",
    "role": "responder"
  }'
```

## Agent Synchronization

### Sync Local Agents to OpenClaw

```bash
# Sync all agents to gateway
curl -X POST http://localhost:3000/api/openclaw/sync

# Or programmatically
import { syncAllAgentsToOpenClaw } from '@/lib/agent-sync';
await syncAllAgentsToOpenClaw();
```

### Bidirectional Sync

```typescript
import { bidirectionalSync } from '@/lib/agent-sync';

// Full two-way synchronization
const result = await bidirectionalSync();
console.log('Pushed:', result.pushed);
console.log('Pulled:', result.pulled);
console.log('Conflicts:', result.conflicts);
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/openclaw/connect` | POST | Connect to gateway |
| `/api/openclaw/status` | GET | Get connection status |
| `/api/openclaw/channels` | GET | List channels |
| `/api/openclaw/channels` | POST | Configure channel |
| `/api/openclaw/send` | POST | Send message |
| `/api/openclaw/sync` | POST | Sync agents |

### Send Message Example

```bash
curl -X POST http://localhost:3000/api/openclaw/send \
  -H "Content-Type: application/json" \
  -d '{
    "channelId": "slack-general",
    "content": "Hello from the AI Startup!",
    "agentId": "marketing"
  }'
```

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to gateway
```bash
# Check gateway is running
nc -zv 127.0.0.1 18789

# Verify configuration
cat .data/openclaw-config.json

# Check logs
tail -f logs/app.log | grep openclaw
```

**Problem**: Authentication failing
```bash
# Regenerate device identity
rm .data/device-identity.json
pnpm run dev

# Verify public key is registered with gateway
```

### Message Routing Issues

**Problem**: Messages not reaching agents
- Verify channel is enabled in config
- Check agent mapping roles
- Review message filters (mentionRequired, keywordTriggers)
- Enable debug mode in config

**Problem**: Duplicate responses
- Check for multiple responder mappings
- Verify agent isn't mapped as both responder and listener

### Performance Issues

**Problem**: High latency
- Check gateway proximity
- Reduce ping interval
- Enable message compression

**Problem**: Message queue growing
- Increase maxQueueSize
- Fix connection stability
- Implement message prioritization

## Example Use Cases

### Customer Support Bot

```json
{
  "id": "support-channel",
  "platform": "slack",
  "agentMappings": [
    {
      "agentSlug": "support-agent",
      "role": "responder",
      "filter": {
        "keywordTriggers": ["help", "issue", "bug", "problem"]
      }
    },
    {
      "agentSlug": "engineering-lead",
      "role": "listener"
    }
  ]
}
```

### Sales Pipeline Integration

```json
{
  "id": "sales-channel",
  "platform": "discord",
  "agentMappings": [
    {
      "agentSlug": "sales",
      "role": "responder",
      "filter": {
        "keywordTriggers": ["pricing", "demo", "trial", "buy"]
      }
    },
    {
      "agentSlug": "ceo",
      "role": "listener"
    }
  ]
}
```

### Multi-Channel Marketing

```json
{
  "channels": [
    {
      "id": "twitter-marketing",
      "platform": "api",
      "agentMappings": [{ "agentSlug": "marketing", "role": "broadcaster" }]
    },
    {
      "id": "telegram-announce",
      "platform": "telegram",
      "agentMappings": [{ "agentSlug": "marketing", "role": "broadcaster" }]
    }
  ]
}
```

## Security Best Practices

1. **Rotate Device Keys**: Periodically regenerate Ed25519 key pairs
2. **Use WSS in Production**: Always enable `secure: true` for production
3. **Limit Agent Permissions**: Only grant necessary channel access
4. **Monitor Message Queue**: Set alerts for queue overflow
5. **Audit Channel Access**: Regularly review agent-channel mappings
6. **Secure Config Files**: Protect `.data/` directory permissions

## Related Documentation

- [Architecture](./ARCHITECTURE.md) - System architecture details
- [Deployment](./DEPLOYMENT.md) - Deployment guide
- [API Reference](./API_REFERENCE.md) - Full API documentation
- [Troubleshooting](./TROUBLESHOOTING.md) - Common issues and solutions
