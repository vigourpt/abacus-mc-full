# Mission Control Runtime Guide

This document explains how to run the orchestration layer that connects The Autonomous AI Startup architecture to OpenClaw for agent execution.

## Overview

Mission Control serves as the orchestration layer between your 112+ agent architecture and OpenClaw runtime. It:

- Manages task queues (backlog → running → completed)
- Routes tasks to appropriate agents via OpenClaw
- Stores results in project memory
- Provides logging and monitoring

```
┌─────────────────────────────────────────────────────────┐
│                    Mission Control                       │
├─────────────────────────────────────────────────────────┤
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │ Backlog  │ -> │ Running  │ -> │    Completed     │  │
│  │  Tasks   │    │  Tasks   │    │  Tasks/Results   │  │
│  └──────────┘    └──────────┘    └──────────────────┘  │
│        │              │                   │             │
│        v              v                   v             │
│  ┌──────────────────────────────────────────────────┐  │
│  │              OpenClaw Connector                   │  │
│  └──────────────────────────────────────────────────┘  │
│                         │                               │
└─────────────────────────│───────────────────────────────┘
                          v
                ┌──────────────────┐
                │  OpenClaw Runtime │
                │    (Agents)       │
                └──────────────────┘
```

## Quick Start

### 1. Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit with your OpenClaw settings
export OPENCLAW_GATEWAY_HOST="http://localhost:8080"
export OPENCLAW_GATEWAY_TOKEN="your-token-here"
```

### 2. Install Dependencies

```bash
# Python dependencies for orchestration
pip install pyyaml requests
```

### 3. Start Mission Control

```bash
# Run the orchestration loop
python run_mission_control.py

# Or with custom config
python run_mission_control.py --config config.yaml

# Dry run (check status without starting)
python run_mission_control.py --dry-run
```

## Creating Tasks

### Via Python

```python
from orchestration.task_runner import TaskRunner

runner = TaskRunner()

# Submit a task
task = runner.submit_task(
    project="website-redesign",
    agent="developer",
    description="Create a responsive navigation component",
    context={
        "framework": "React",
        "requirements": ["mobile-first", "accessible"]
    }
)

print(f"Task created: {task.task_id}")
```

### Via JSON Files

Create a JSON file in `tasks/backlog/`:

```json
{
  "task_id": "task_001",
  "project": "marketing-campaign",
  "agent": "marketing",
  "description": "Create social media content calendar for Q2",
  "status": "backlog",
  "context": {
    "platforms": ["twitter", "linkedin"],
    "themes": ["AI", "productivity"]
  },
  "created_at": "2026-03-11T10:00:00Z",
  "updated_at": "2026-03-11T10:00:00Z"
}
```

## Task Lifecycle

1. **Backlog** (`tasks/backlog/`) - Tasks waiting to be processed
2. **Running** (`tasks/running/`) - Currently executing via OpenClaw
3. **Completed** (`tasks/completed/`) - Finished tasks with results

Each task moves through these folders automatically.

## Project Memory

Results are stored in project directories:

```
projects/
└── website-redesign/
    ├── brief.md      # Project description
    ├── outputs.md    # Agent results (auto-appended)
    ├── logs.md       # Execution logs
    └── meta.json     # Timestamps
```

### Using Project Memory

```python
from orchestration.project_memory import ProjectMemory, read_project

# Create a project
memory = ProjectMemory()
memory.create_project("new-feature", "Build user authentication system")

# Read project data
project = read_project("new-feature")
print(project.brief)
```

## OpenClaw Integration

The OpenClaw connector sends tasks to your configured OpenClaw gateway.

### Direct Agent Execution

```python
from connectors.openclaw_client import OpenClawClient, run_agent

# Quick execution
result = run_agent(
    agent_name="developer",
    task="Write unit tests for auth module",
    context={"language": "python"}
)

if result.success:
    print(f"Output: {result.output}")
else:
    print(f"Error: {result.error}")
```

### Client Configuration

```python
client = OpenClawClient(
    api_endpoint="http://openclaw.example.com:8080",
    api_token="your-token",
    timeout=300,
    retry_attempts=3
)

# Check connection
if client.health_check():
    print("OpenClaw connected!")

# List available agents
agents = client.list_agents()
```

## Configuration Reference

### config.yaml

```yaml
openclaw:
  endpoint: http://localhost:8080
  token: ""  # Or use OPENCLAW_GATEWAY_TOKEN env var
  timeout: 300
  retry_attempts: 3

task_processing:
  max_concurrent: 5      # Parallel task limit
  poll_interval: 2.0     # Seconds between backlog checks

logging:
  level: INFO            # DEBUG, INFO, WARNING, ERROR
  console: true

paths:
  tasks_dir: tasks
  projects_dir: projects
  logs_dir: logs
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCLAW_GATEWAY_HOST` | OpenClaw API endpoint | `http://localhost:8080` |
| `OPENCLAW_GATEWAY_TOKEN` | Authentication token | (none) |
| `MC_CONFIG` | Path to config file | `config.yaml` |
| `MC_TASKS_DIR` | Tasks directory | `tasks` |
| `MC_PROJECTS_DIR` | Projects directory | `projects` |
| `MC_LOG_DIR` | Logs directory | `logs` |
| `LOG_LEVEL` | Logging level | `INFO` |

## Logging

Logs are written to:
- Console (if enabled)
- `logs/mission_control.log` - Main log file
- `logs/tasks/{task_id}.jsonl` - Per-task structured logs

### Log Levels

```python
from orchestration.logger import get_logger

logger = get_logger()

logger.info("Processing started")
logger.task_start("task_001", "developer", "Build feature X")
logger.agent_execution("task_001", "developer", "completed", output)
logger.task_complete("task_001", success=True)
logger.error("Something failed", task_id="task_001", exception=e)
```

## Example Workflows

### Multi-Agent Project

```python
from orchestration.task_runner import TaskRunner
from orchestration.project_memory import ProjectMemory

# Setup
runner = TaskRunner()
memory = ProjectMemory()

# Create project
memory.create_project("app-launch", "Launch new mobile app")

# Submit coordinated tasks
runner.submit_task("app-launch", "developer", "Finalize app features")
runner.submit_task("app-launch", "marketing", "Prepare launch campaign")
runner.submit_task("app-launch", "sales", "Create pricing strategy")

# Start processing
runner.run_loop()
```

### One-Off Task Execution

```python
from connectors import run_agent

# Quick execution without full orchestration
result = run_agent("ceo", "Review Q1 strategic priorities")
print(result.output)
```

## Troubleshooting

### OpenClaw Not Connecting

1. Check gateway is running: `curl http://localhost:8080/health`
2. Verify token: `echo $OPENCLAW_GATEWAY_TOKEN`
3. Check firewall/network access

### Tasks Stuck in Running

1. Check `tasks/running/` for stale tasks
2. Manually move back to backlog if needed
3. Review `logs/mission_control.log` for errors

### Agent Execution Failing

1. Check agent exists: `client.list_agents()`
2. Verify agent configuration in OpenClaw
3. Review task context for required fields

## Architecture

```
autonomous_ai_startup/
├── connectors/
│   ├── __init__.py
│   └── openclaw_client.py    # OpenClaw API client
├── orchestration/
│   ├── __init__.py
│   ├── logger.py             # Logging system
│   ├── project_memory.py     # Project data management
│   └── task_runner.py        # Task execution loop
├── tasks/
│   ├── backlog/              # Pending tasks
│   ├── running/              # In-progress tasks
│   └── completed/            # Finished tasks
├── projects/
│   └── {project-name}/       # Project outputs
├── logs/
│   └── mission_control.log   # System logs
├── config.yaml               # Configuration
└── run_mission_control.py    # Entry point
```

## Next Steps

- Configure your OpenClaw gateway connection
- Create your first project and tasks
- Start the orchestration loop
- Monitor results in project outputs
