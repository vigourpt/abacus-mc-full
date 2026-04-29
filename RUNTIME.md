# Runtime Guide - Operational Layer

This document provides detailed instructions for running and configuring the Operational Layer of The Autonomous AI Startup Architecture.

## Overview

The Operational Layer is a Python-based runtime that enables autonomous task execution through Mission Control. It provides:

- **OpenClaw Connector** - Communication with OpenClaw Gateway
- **Task Runner** - Execution loop for processing tasks
- **Project Memory** - Persistent context and state management
- **Structured Logging** - Configurable logging system

## Quick Start

```bash
# Install Python dependencies
pip install pyyaml requests

# Run Mission Control
python run_mission_control.py
```

## Prerequisites

- Python 3.9+
- `pyyaml` package
- `requests` package
- Running OpenClaw Gateway (optional, but required for agent execution)

### Installing Dependencies

```bash
# Using pip
pip install pyyaml requests

# Or using requirements.txt (if available)
pip install -r requirements.txt
```

## Running Mission Control

### Basic Usage

```bash
# Run with default configuration
python run_mission_control.py

# Run with custom config file
python run_mission_control.py --config my-config.yaml

# Run with environment variable config
MC_CONFIG=production.yaml python run_mission_control.py
```

### Command Line Options

| Option | Description |
|--------|-------------|
| `--config PATH` | Path to YAML configuration file |

## Configuration

Mission Control can be configured via YAML file or environment variables.

### Configuration File (config.yaml)

Create a `config.yaml` file in the project root:

```yaml
openclaw:
  endpoint: http://localhost:8080
  token: your-api-token
  timeout: 300
  retry_attempts: 3

task_processing:
  max_concurrent: 5
  poll_interval: 2.0

logging:
  level: INFO
  console: true

paths:
  tasks_dir: tasks
  projects_dir: projects
  logs_dir: logs
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENCLAW_GATEWAY_HOST` | OpenClaw Gateway URL | `http://localhost:8080` |
| `OPENCLAW_GATEWAY_TOKEN` | API authentication token | (none) |
| `MC_CONFIG` | Path to config file | `config.yaml` |
| `MC_TASKS_DIR` | Directory for task files | `tasks/` |
| `MC_PROJECTS_DIR` | Directory for project data | `projects/` |
| `LOG_LEVEL` | Logging level | `INFO` |

### Priority Order

Configuration is loaded in this order (later overrides earlier):
1. Default values
2. Configuration file
3. Environment variables

## Components

### OpenClaw Connector

The OpenClaw Connector (`connectors/openclaw_client.py`) handles communication with the OpenClaw Gateway.

#### Usage

```python
from connectors.openclaw_client import OpenClawClient, run_agent

# Create client
client = OpenClawClient(
    api_endpoint='http://localhost:8080',
    api_token='your-token',
    timeout=300,
    retry_attempts=3
)

# Check health
if client.health_check():
    print("Gateway is reachable")

# List available agents
agents = client.list_agents()

# Run an agent
result = client.run_agent(
    agent_name='developer',
    task='Create a Python function to parse JSON',
    context={'project': 'my-project'}
)

if result.success:
    print(f"Output: {result.output}")
else:
    print(f"Error: {result.error}")
```

#### Agent Result

```python
@dataclass
class AgentResult:
    success: bool          # Whether execution succeeded
    agent_name: str        # Name of the agent
    task_id: str           # Unique task identifier
    output: Any            # Agent output
    error: Optional[str]   # Error message if failed
    execution_time: float  # Time taken in seconds
    status: AgentStatus    # COMPLETED, FAILED, TIMEOUT
```

### Task Runner

The Task Runner (`orchestration/task_runner.py`) manages the execution loop.

#### Task States

| State | Description |
|-------|-------------|
| `backlog` | Task queued, waiting for execution |
| `running` | Task currently being executed |
| `completed` | Task finished successfully |
| `failed` | Task execution failed |

#### Task Structure

```python
@dataclass
class Task:
    task_id: str           # Unique identifier
    project: str           # Project name
    agent: str             # Target agent
    description: str       # Task description
    status: str            # Current state
    context: Dict          # Additional context
    created_at: str        # ISO timestamp
    updated_at: str        # ISO timestamp
    result: Optional[Any]  # Execution result
    error: Optional[str]   # Error if failed
    retries: int           # Retry count
    max_retries: int       # Maximum retries (default: 3)
```

#### Directory Structure

Tasks are stored as JSON files in state-based directories:

```
tasks/
├── backlog/          # Pending tasks
│   └── task_001.json
├── running/          # Currently executing
│   └── task_002.json
└── completed/        # Finished tasks
    └── task_003.json
```

### Project Memory

Project Memory (`orchestration/project_memory.py`) maintains context across sessions.

#### Project Structure

```
projects/
└── my-project/
    ├── brief.md      # Project description
    ├── outputs.md    # Agent results
    └── logs.md       # Execution logs
```

#### Usage

```python
from orchestration.project_memory import ProjectMemory

# Initialize
memory = ProjectMemory(base_path='projects')

# Create project
project = memory.create_project(
    project_name='my-startup',
    brief='Building an autonomous AI startup'
)

# Write output
from orchestration.project_memory import write_output, append_log

write_output('my-startup', 'developer', 'Created main.py with core logic')
append_log('my-startup', 'Task completed successfully')
```

### Logging

The logging system (`orchestration/logger.py`) provides structured output.

#### Log Levels

| Level | Usage |
|-------|-------|
| `DEBUG` | Detailed debugging information |
| `INFO` | General operational messages |
| `WARNING` | Warning conditions |
| `ERROR` | Error conditions |
| `CRITICAL` | Critical failures |

#### Configuration

```python
from orchestration.logger import get_logger

# Create logger
logger = get_logger(
    log_level='INFO',     # DEBUG, INFO, WARNING, ERROR, CRITICAL
    console_output=True   # Print to console
)

# Usage
logger.info("Mission Control starting...")
logger.debug(f"Processing task {task_id}")
logger.error(f"Task failed: {error}")
```

#### Log Format

```
2026-03-11 12:00:00,000 | INFO | mission_control | Initializing Mission Control...
2026-03-11 12:00:01,000 | INFO | openclaw_client | Connected to OpenClaw Gateway
2026-03-11 12:00:02,000 | DEBUG | task_runner | Polling for new tasks
2026-03-11 12:00:03,000 | INFO | task_runner | Executing task_001 with agent 'developer'
```

## Creating Tasks

### Programmatic Task Creation

```python
from orchestration.task_runner import TaskStateManager, Task

# Initialize manager
manager = TaskStateManager(tasks_dir='tasks')

# Create task
task = manager.create_task(Task(
    task_id='task_001',
    project='my-startup',
    agent='developer',
    description='Implement user authentication',
    status='backlog',
    context={
        'priority': 'high',
        'deadline': '2026-03-15'
    },
    created_at='',  # Will be set automatically
    updated_at=''   # Will be set automatically
))
```

### Manual Task Creation

Create a JSON file in `tasks/backlog/`:

```json
{
  "task_id": "task_002",
  "project": "my-startup",
  "agent": "marketing",
  "description": "Create launch announcement blog post",
  "status": "backlog",
  "context": {
    "target_audience": "developers",
    "key_features": ["ai-powered", "autonomous", "multi-agent"]
  },
  "created_at": "2026-03-11T10:00:00Z",
  "updated_at": "2026-03-11T10:00:00Z",
  "result": null,
  "error": null,
  "retries": 0,
  "max_retries": 3
}
```

## Graceful Shutdown

Mission Control handles shutdown signals gracefully:

- `SIGINT` (Ctrl+C) - Graceful shutdown
- `SIGTERM` - Graceful shutdown

During shutdown:
1. Stop accepting new tasks
2. Complete currently running tasks (with timeout)
3. Save project memory state
4. Close OpenClaw connection
5. Exit cleanly

## Troubleshooting

### Common Issues

#### OpenClaw Gateway Not Reachable

```
ERROR | openclaw_client | Connection error: Connection refused
```

**Solution:** Ensure OpenClaw Gateway is running and accessible at the configured endpoint.

```bash
# Check if gateway is running
curl http://localhost:8080/health
```

#### Tasks Not Processing

**Check:** Ensure tasks are in the `tasks/backlog/` directory with valid JSON.

```bash
# List pending tasks
ls -la tasks/backlog/

# Validate JSON
python -m json.tool tasks/backlog/task_001.json
```

#### Permission Errors

```
ERROR | project_memory | Permission denied: projects/my-project/outputs.md
```

**Solution:** Ensure the process has write permissions to the projects directory.

```bash
chmod -R 755 projects/
```

### Debug Mode

Run with debug logging for detailed output:

```bash
LOG_LEVEL=DEBUG python run_mission_control.py
```

## Integration with Web Dashboard

The Operational Layer works alongside the Next.js web dashboard:

1. **Web Dashboard** (`pnpm dev`) - UI at http://localhost:3000
2. **Mission Control** (`python run_mission_control.py`) - Task execution

Both can run simultaneously:

```bash
# Terminal 1: Start web dashboard
pnpm dev

# Terminal 2: Start Mission Control
python run_mission_control.py
```

Tasks created via the web API will be picked up by Mission Control for execution.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Mission Control                           │
│                   run_mission_control.py                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │   OpenClaw   │   │    Task      │   │   Project    │        │
│  │   Connector  │   │    Runner    │   │   Memory     │        │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘        │
│         │                  │                   │                 │
│         └──────────────────┼───────────────────┘                 │
│                            │                                     │
│                    ┌───────▼───────┐                            │
│                    │    Logger     │                            │
│                    └───────────────┘                            │
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
              ┌───────────────────────┐
              │   OpenClaw Gateway    │
              │  ws://127.0.0.1:18789 │
              └───────────────────────┘
```

## See Also

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) - System architecture documentation
- [OPENCLAW_INTEGRATION.md](docs/OPENCLAW_INTEGRATION.md) - OpenClaw setup guide
- [SETUP.md](docs/SETUP.md) - Installation guide
- [TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) - Common issues and solutions
