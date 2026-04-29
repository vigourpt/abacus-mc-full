# The Autonomous AI Startup Architecture

<div align="center">

🤖 **A Unified Multi-Agent Orchestration System**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![Agents](https://img.shields.io/badge/Agents-112+-purple.svg)](#-agent-roster)
[![Phase](https://img.shields.io/badge/Phase-3%20Complete-success.svg)](docs/PHASE_ROADMAP.md)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

**Instead of 51 prompts → 1 AI company with 112+ specialized agents**

</div>

---

## 🎯 Overview

The Autonomous AI Startup Architecture is a production-ready, multi-agent orchestration platform that transforms specialized AI agents into a cohesive, autonomous startup operation. It combines the power of:

- **Mission Control** - Real-time agent management and task orchestration
- **Operational Layer** - Python-based execution loop with OpenClaw connector
- **Agency Agents** - 112+ specialized AI agent personalities across 14 divisions
- **OpenClaw** - Personal AI gateway for multi-channel connectivity
- **Analytics Dashboard** - Comprehensive monitoring and performance tracking

## ✨ Key Features

### Phase 3 Complete ✅

| Feature | Description |
|---------|-------------|
| **OpenClaw Integration** | Full bidirectional sync with WebSocket gateway |
| **Message Routing** | Intelligent routing of messages to specialized agents |
| **Multi-Channel Support** | Slack, Discord, Telegram, Teams, Email, and more |
| **Analytics Dashboard** | Real-time system metrics and agent performance |
| **Performance Optimization** | Caching layer, database optimization, query performance |
| **Ed25519 Authentication** | Secure device identity and gateway authentication |
| **Visual Task Pipeline** | Real-time Kanban-style pipeline with 4 stages (Planner → Tasks → Agents → Results) |
| **IDEA → STARTUP Generator** | One-click startup generation from an idea with automated task pipeline |
| **Agent Knowledge System** | Agents learn from previous projects and reuse successful patterns |
| **Agent Reputation System** | Performance-based ranking improves task routing over time |

### Operational Layer ✅

| Component | Description |
|-----------|-------------|
| **OpenClaw Connector** | Python client for OpenClaw Gateway communication |
| **Task Runner** | Execution loop for processing tasks via agents |
| **Project Memory** | Persistent context and state tracking across sessions |
| **Logging System** | Structured logging with configurable levels |
| **Mission Control** | Main entry point orchestrating all components |
| **Knowledge Capture** | Extracts reusable patterns from successful task outputs |
| **Knowledge Retrieval** | Semantic search for relevant knowledge before execution |
| **Embedding System** | Text embeddings for knowledge search (OpenAI or TF-IDF) |
| **Reputation Manager** | Tracks agent performance metrics and success rates |

### Phase 2 Features

| Feature | Description |
|---------|-------------|
| **Task Planner Agent** | Central orchestrator with multi-agent collaboration support |
| **Dynamic Agent Hiring** | Automatically creates new agents when tasks require new capabilities |
| **Agent Import System** | Import specialized agents from agency-agents repository |
| **112+ AI Agents** | Spanning 14 divisions from Engineering to Game Development |
| **Multi-Agent Collaboration** | Tasks can involve multiple agents working together |
| **Task Dependencies** | Support for complex task workflows with dependencies |
| **Workload Balancing** | Intelligent distribution of work across agents |
| **Real-time Updates** | WebSocket-based live monitoring and events |

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- pnpm (recommended) or npm

### Installation

```bash
# Clone the repository
git clone https://github.com/vigourpt/The-Autonomous-AI-Startup-Architecture.git
cd The-Autonomous-AI-Startup-Architecture

# Install dependencies
pnpm install

# Copy environment configuration
cp .env.example .env

# Initialize database and import agents
pnpm run db:migrate
pnpm exec tsx scripts/seed-agents.ts
pnpm exec tsx scripts/import-specialized-agents.ts

# Start development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to access the dashboard.

### 🐳 Docker Deployment

The fastest way to get the full stack running:

```bash
# Clone the repository
git clone https://github.com/vigourpt/The-Autonomous-AI-Startup-Architecture.git
cd The-Autonomous-AI-Startup-Architecture

# Configure environment
cp .env.example .env
# Edit .env with your settings (API keys, passwords, etc.)

# Build and start all services
docker-compose build
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down
```

This starts two services:
- **Mission Control UI** (Next.js) → [http://localhost:3000](http://localhost:3000)
- **Task Worker** (Node.js) → Automatically processes tasks every 5 seconds

Data is persisted in Docker named volumes. See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for advanced configuration.

### OpenClaw Gateway Setup

```bash
# Configure OpenClaw (optional)
# Edit .data/openclaw-config.json or set environment variables

export OPENCLAW_GATEWAY_HOST=127.0.0.1
export OPENCLAW_GATEWAY_PORT=18789

# Connect via API
curl -X POST http://localhost:3000/api/openclaw/connect
```

See [OpenClaw Integration Guide](docs/OPENCLAW_INTEGRATION.md) for detailed setup.

### Running Mission Control (Operational Layer)

Mission Control provides a Python-based operational layer for autonomous task execution:

```bash
# Install Python dependencies (if not already installed)
pip install pyyaml requests

# Run Mission Control (basic mode)
python run_mission_control.py

# With dependency-aware scheduler ✨
python run_mission_control.py --use-scheduler

# With metrics API ✨
python run_mission_control.py --metrics-port 9090

# List indexed agents ✨
python run_mission_control.py --list-agents

# Dry run
python run_mission_control.py --dry-run
```

Mission Control will:
1. Create a new **run session** for isolated tracking
2. Connect to the OpenClaw Gateway
3. Load **agent capabilities** from workspace/agents
4. Poll for pending tasks with **dependency resolution**
5. Execute tasks via agents with **metrics collection**
6. Track task state and maintain project context

See [RUNTIME.md](docs/RUNTIME.md) for detailed operational instructions.

### New Features (v2) ✨

| Feature | Description |
|---------|-------------|
| **Task Dependencies** | Define task order with `depends_on: [task_ids]` |
| **Run Sessions** | Isolated tracking in `runs/{run_id}/` |
| **Capability Index** | Match tasks to agents by skills |
| **Scheduler Layer** | Dependency-aware task dispatch |
| **Metrics API** | Observability at `http://localhost:9090/metrics` |

See example tasks in `tasks/examples/` demonstrating dependency chains.

## 📊 Agent Roster

**112+ agents** organized across **14 specialized divisions**:

| Division | Count | Examples |
|----------|-------|----------|
| 🎮 Game Development | 19 | Unity Architect, Unreal Engineer, Godot Developer |
| 💻 Engineering | 18 | AI Engineer, Backend Architect, DevOps, Security |
| 📣 Marketing | 18 | SEO Specialist, TikTok Strategist, Content Creator |
| 🧪 Testing | 8 | API Tester, Performance Benchmarker, QA |
| 🎨 Design | 8 | UX Architect, Brand Guardian, UI Designer |
| 💰 Paid Media | 7 | PPC Strategist, Programmatic Buyer, Auditor |
| ⚙️ Operations | 7 | Compliance Auditor, Finance Tracker |
| 📋 Project Management | 6 | Jira Steward, Studio Producer |
| 💬 Support | 6 | Support Responder, Infrastructure Maintainer |
| 🌐 Spatial Computing | 6 | visionOS Engineer, XR Developer |
| 📦 Product | 4 | Behavioral Nudge Engine, Sprint Prioritizer |
| ♟️ Strategy | 3 | NEXUS Framework |
| 👔 Executive | 1 | CEO |
| 💼 Sales | 1 | Chief Revenue Officer |

See [AGENTS.md](docs/AGENTS.md) for the complete agent directory.

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, OpenClaw integration, and monitoring |
| [RUNTIME.md](RUNTIME.md) | **Operational layer guide - Mission Control, task runner** |
| [AGENTS.md](docs/AGENTS.md) | Complete agent directory organized by division |
| [SETUP.md](docs/SETUP.md) | Installation and configuration guide |
| [DEPLOYMENT.md](docs/DEPLOYMENT.md) | Production deployment guide |
| [OPENCLAW_INTEGRATION.md](docs/OPENCLAW_INTEGRATION.md) | OpenClaw gateway setup and configuration |
| [API_REFERENCE.md](docs/API_REFERENCE.md) | Complete API documentation |
| [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Common issues and solutions |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Guidelines for extending the system |
| [PHASE_ROADMAP.md](docs/PHASE_ROADMAP.md) | Feature roadmap for all phases |

## 🧱 Technology Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router) |
| UI | React 19, Tailwind CSS 3.4 |
| Language | TypeScript 5.7 |
| Database | SQLite (better-sqlite3, WAL mode) |
| State | Zustand 5 |
| Real-time | WebSocket + SSE |
| Validation | Zod 4 |
| Logging | Pino |
| Caching | In-memory with TTL |

## 🏗️ Project Structure

```
autonomous-ai-startup/
├── src/
│   ├── app/                    # Next.js app router
│   │   └── api/               # REST API routes
│   │       ├── agents/        # Agent management
│   │       ├── tasks/         # Task management
│   │       ├── analytics/     # System analytics
│   │       └── openclaw/      # OpenClaw gateway
│   ├── components/             # React components
│   │   └── analytics/         # Analytics dashboard
│   ├── lib/                    # Core libraries
│   │   ├── db.ts              # SQLite database
│   │   ├── task-planner.ts    # Task routing & collaboration
│   │   ├── agent-hiring.ts    # Dynamic agent creation
│   │   ├── agent-sync.ts      # Bidirectional agent sync
│   │   ├── openclaw-client.ts # WebSocket gateway client
│   │   ├── openclaw-config.ts # Gateway configuration
│   │   ├── message-router.ts  # Channel message routing
│   │   ├── analytics.ts       # System metrics
│   │   ├── cache.ts           # Caching layer
│   │   └── performance-monitor.ts # Performance tracking
│   ├── store/                  # Zustand state management
│   └── types/                  # TypeScript definitions
├── connectors/                 # Operational Layer - External connectors
│   └── openclaw_client.py     # Python OpenClaw Gateway client
├── orchestration/              # Operational Layer - Task orchestration
│   ├── task_runner.py         # Execution loop for task processing
│   ├── project_memory.py      # Project context & state persistence
│   └── logger.py              # Structured logging system
├── run_mission_control.py      # Main entry point for operational layer
├── workspace/
│   └── agents/                 # 112+ agent soul.md files
├── scripts/
│   ├── seed-agents.ts          # Initial agent setup
│   ├── import-agents.ts        # Batch agent import
│   ├── db-optimize.ts          # Database optimization
│   └── import-specialized-agents.ts
├── docs/                       # Documentation
└── .data/                      # Runtime data (SQLite, config)
```

## 🔌 API Reference

### Agents

```bash
# List all agents
GET /api/agents

# Create agent
POST /api/agents
{"name": "New Agent", "division": "engineering"}

# Sync from workspace
POST /api/agents/sync

# Import from agency-agents
POST /api/agents/import
{"division": "game-development"}
```

### Tasks

```bash
# List tasks
GET /api/tasks?status=in_progress

# Create task (auto-assign)
POST /api/tasks
{"title": "Build feature", "autoAssign": true}

# Get next task for agent
GET /api/tasks/queue?agent=<agent_id>
```

### Analytics

```bash
# System health
GET /api/analytics/system

# Agent metrics
GET /api/analytics/agents

# Task analytics
GET /api/analytics/tasks

# Performance metrics
GET /api/analytics/performance
```

### OpenClaw

```bash
# Connection status
GET /api/openclaw/status

# Connect to gateway
POST /api/openclaw/connect

# List channels
GET /api/openclaw/channels

# Send message
POST /api/openclaw/send
{"channelId": "slack-general", "content": "Hello!"}

# Sync agents
POST /api/openclaw/sync
```

See [API Reference](docs/API_REFERENCE.md) for complete documentation.

## 📈 Roadmap

| Phase | Status | Features |
|-------|--------|----------|
| **Phase 1** | ✅ Complete | Core system, 6 essential agents, dashboard UI |
| **Phase 2** | ✅ Complete | 112+ agents, agent import system, multi-agent collaboration, task dependencies |
| **Phase 3** | ✅ Complete | OpenClaw integration, analytics dashboard, performance optimization |
| **Phase 4** | 🔮 Planned | Multi-tenant workspaces, advanced AI models, enterprise SSO |

See [PHASE_ROADMAP.md](docs/PHASE_ROADMAP.md) for details.

## 🤝 Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">
  <strong>Built with ❤️ for the autonomous AI future</strong>
</div>
