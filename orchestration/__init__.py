"""Orchestration module for Mission Control.

Provides task execution, scheduling, dependency management,
agent capabilities, metrics, and run session management.

Modules:
- task_runner: Core task execution loop
- scheduler: Task scheduling with dependency resolution
- task_dependencies: Dependency graph management
- capability_index: Agent capability matching
- metrics: Observability and metrics collection
- run_sessions: Execution run session management
- project_memory: Project data persistence
- logger: Structured logging
"""

from .logger import get_logger, Logger
from .task_runner import TaskRunner, TaskStateManager, Task, TaskState
from .project_memory import ProjectMemory, read_project, write_output, append_log
from .task_dependencies import (
    DependencyManager, 
    get_dependency_manager,
    can_execute_task,
    get_ready_tasks
)
from .run_sessions import (
    RunSession,
    RunSessionManager,
    get_session_manager,
    create_run,
    get_current_run
)
from .capability_index import (
    CapabilityIndex,
    get_capability_index,
    match_task_to_agents
)
from .scheduler import (
    Scheduler,
    get_scheduler,
    start_scheduler
)
from .metrics import (
    MetricsCollector,
    get_metrics_collector,
    increment,
    record
)

__all__ = [
    # Logger
    'get_logger', 'Logger',
    # Task Runner
    'TaskRunner', 'TaskStateManager', 'Task', 'TaskState',
    # Project Memory
    'ProjectMemory', 'read_project', 'write_output', 'append_log',
    # Dependencies
    'DependencyManager', 'get_dependency_manager', 'can_execute_task', 'get_ready_tasks',
    # Run Sessions
    'RunSession', 'RunSessionManager', 'get_session_manager', 'create_run', 'get_current_run',
    # Capabilities
    'CapabilityIndex', 'get_capability_index', 'match_task_to_agents',
    # Scheduler
    'Scheduler', 'get_scheduler', 'start_scheduler',
    # Metrics
    'MetricsCollector', 'get_metrics_collector', 'increment', 'record',
]
