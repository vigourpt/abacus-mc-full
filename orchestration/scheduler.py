"""Scheduler Layer - IMPROVEMENT 4

Continuous polling scheduler that resolves task dependencies,
manages execution rate, and dispatches ready tasks to task_runner.

Features:
- Continuous polling for pending tasks
- Dependency resolution before dispatch
- Concurrency control
- Priority-based scheduling
- Rate limiting

Usage:
    from orchestration.scheduler import Scheduler
    
    scheduler = Scheduler(task_runner=runner, poll_interval=2.0)
    scheduler.start()  # Start scheduling loop
"""

import os
import json
import time
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass
from enum import Enum
from queue import PriorityQueue

from .logger import get_logger
from .task_dependencies import DependencyManager, can_execute_task
from .run_sessions import RunSession, get_current_run
from .metrics import MetricsCollector, get_metrics_collector


class SchedulerState(Enum):
    """Scheduler state."""
    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    PAUSED = "paused"
    STOPPING = "stopping"


@dataclass
class ScheduledTask:
    """Task ready for scheduling."""
    task_id: str
    priority: int  # Lower = higher priority
    created_at: str
    agent: str
    description: str
    data: Dict
    
    def __lt__(self, other):
        """For priority queue ordering."""
        if self.priority != other.priority:
            return self.priority < other.priority
        return self.created_at < other.created_at


class Scheduler:
    """Task scheduler with dependency resolution.
    
    Continuously polls for pending tasks, checks dependencies,
    and dispatches ready tasks to the task runner.
    """
    
    # Priority levels
    PRIORITY_CRITICAL = 0
    PRIORITY_HIGH = 1
    PRIORITY_NORMAL = 2
    PRIORITY_LOW = 3
    
    def __init__(
        self,
        task_runner = None,
        tasks_dir: str = None,
        poll_interval: float = 2.0,
        max_concurrent: int = 5,
        rate_limit: float = 0  # Tasks per second (0 = no limit)
    ):
        """Initialize scheduler.
        
        Args:
            task_runner: TaskRunner instance for execution
            tasks_dir: Path to tasks directory
            poll_interval: Seconds between polls
            max_concurrent: Maximum concurrent tasks
            rate_limit: Max tasks per second (0 = unlimited)
        """
        self.task_runner = task_runner
        self.tasks_dir = Path(tasks_dir or os.getenv(
            'MC_TASKS_DIR',
            os.path.join(os.path.dirname(__file__), '..', 'tasks')
        ))
        self.poll_interval = poll_interval
        self.max_concurrent = max_concurrent
        self.rate_limit = rate_limit
        
        self.logger = get_logger()
        self.dependency_manager = DependencyManager(str(self.tasks_dir))
        self.metrics = get_metrics_collector()
        
        self._state = SchedulerState.STOPPED
        self._thread: Optional[threading.Thread] = None
        self._ready_queue = PriorityQueue()
        self._running_tasks: Dict[str, datetime] = {}
        self._last_dispatch_time = 0.0
        self._lock = threading.Lock()
        
        # Callbacks
        self._on_task_dispatched: Optional[Callable] = None
        self._on_task_blocked: Optional[Callable] = None
    
    @property
    def state(self) -> SchedulerState:
        """Get current scheduler state."""
        return self._state
    
    def set_task_runner(self, task_runner):
        """Set the task runner for execution."""
        self.task_runner = task_runner
    
    def on_task_dispatched(self, callback: Callable):
        """Set callback for task dispatch events."""
        self._on_task_dispatched = callback
    
    def on_task_blocked(self, callback: Callable):
        """Set callback for blocked task events."""
        self._on_task_blocked = callback
    
    def _get_backlog_tasks(self) -> List[dict]:
        """Get all tasks in backlog."""
        backlog_dir = self.tasks_dir / 'backlog'
        if not backlog_dir.exists():
            return []
        
        tasks = []
        for task_file in backlog_dir.glob('*.json'):
            try:
                with open(task_file) as f:
                    data = json.load(f)
                tasks.append(data)
            except Exception as e:
                self.logger.warning(f"Failed to load task {task_file}: {e}")
        
        return tasks
    
    def _get_running_count(self) -> int:
        """Get count of currently running tasks."""
        running_dir = self.tasks_dir / 'running'
        if not running_dir.exists():
            return 0
        return len(list(running_dir.glob('*.json')))
    
    def _parse_priority(self, task: dict) -> int:
        """Parse priority from task data."""
        priority_str = task.get('priority', 'normal').lower()
        priority_map = {
            'critical': self.PRIORITY_CRITICAL,
            'high': self.PRIORITY_HIGH,
            'normal': self.PRIORITY_NORMAL,
            'low': self.PRIORITY_LOW
        }
        return priority_map.get(priority_str, self.PRIORITY_NORMAL)
    
    def _check_rate_limit(self) -> bool:
        """Check if we can dispatch within rate limit."""
        if self.rate_limit <= 0:
            return True
        
        min_interval = 1.0 / self.rate_limit
        elapsed = time.time() - self._last_dispatch_time
        return elapsed >= min_interval
    
    def _poll_and_schedule(self):
        """Single poll iteration: check tasks and schedule ready ones."""
        # Clear dependency cache for fresh data
        self.dependency_manager.clear_cache()
        
        # Get backlog tasks
        backlog_tasks = self._get_backlog_tasks()
        running_count = self._get_running_count()
        
        # Calculate available slots
        available_slots = self.max_concurrent - running_count
        
        if available_slots <= 0:
            self.logger.debug(f"No available slots (running: {running_count})")
            return
        
        # Check each backlog task for dependency satisfaction
        ready_tasks = []
        blocked_tasks = []
        
        for task in backlog_tasks:
            task_id = task.get('task_id')
            if not task_id:
                continue
            
            # Check dependencies
            if self.dependency_manager.can_execute(task_id):
                ready_tasks.append(task)
            else:
                dep_info = self.dependency_manager.check_dependencies(task_id)
                blocked_tasks.append((task, dep_info))
        
        # Log blocked tasks
        for task, dep_info in blocked_tasks:
            if dep_info.pending_deps:
                self.logger.debug(
                    f"Task {task['task_id']} waiting on: {dep_info.pending_deps}"
                )
            if self._on_task_blocked:
                self._on_task_blocked(task, dep_info)
        
        # Sort ready tasks by priority and creation time
        ready_tasks.sort(key=lambda t: (
            self._parse_priority(t),
            t.get('created_at', '')
        ))
        
        # Dispatch ready tasks up to available slots
        dispatched = 0
        for task in ready_tasks[:available_slots]:
            if not self._check_rate_limit():
                self.logger.debug("Rate limit reached, waiting...")
                break
            
            if self._dispatch_task(task):
                dispatched += 1
                self._last_dispatch_time = time.time()
        
        if dispatched > 0:
            self.logger.info(f"Dispatched {dispatched} tasks")
            self.metrics.increment('tasks_dispatched', dispatched)
    
    def _dispatch_task(self, task: dict) -> bool:
        """Dispatch a task to the task runner.
        
        Args:
            task: Task data dictionary
            
        Returns:
            True if dispatched successfully
        """
        task_id = task.get('task_id')
        
        if not self.task_runner:
            self.logger.error("No task runner configured")
            return False
        
        try:
            self.logger.info(f"Dispatching task {task_id} to runner")
            
            # Record dispatch time
            with self._lock:
                self._running_tasks[task_id] = datetime.utcnow()
            
            # Notify current run session
            run = get_current_run()
            if run:
                run.log_event('task_dispatched', {
                    'task_id': task_id,
                    'agent': task.get('agent'),
                    'priority': task.get('priority', 'normal')
                })
            
            # The task_runner will handle actual execution
            # We're just marking it for execution here
            if self._on_task_dispatched:
                self._on_task_dispatched(task)
            
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to dispatch task {task_id}: {e}")
            self.metrics.increment('dispatch_errors')
            return False
    
    def _scheduler_loop(self):
        """Main scheduler loop."""
        self.logger.info("Scheduler loop started")
        self._state = SchedulerState.RUNNING
        
        while self._state == SchedulerState.RUNNING:
            try:
                self._poll_and_schedule()
            except Exception as e:
                self.logger.error(f"Scheduler error: {e}")
                self.metrics.increment('scheduler_errors')
            
            # Sleep between polls
            time.sleep(self.poll_interval)
        
        self.logger.info("Scheduler loop stopped")
    
    def start(self, blocking: bool = False):
        """Start the scheduler.
        
        Args:
            blocking: If True, run in current thread (blocking)
        """
        if self._state != SchedulerState.STOPPED:
            self.logger.warning("Scheduler already running")
            return
        
        self._state = SchedulerState.STARTING
        self.logger.info("Starting scheduler...")
        
        if blocking:
            self._scheduler_loop()
        else:
            self._thread = threading.Thread(
                target=self._scheduler_loop,
                name="TaskScheduler",
                daemon=True
            )
            self._thread.start()
    
    def stop(self):
        """Stop the scheduler."""
        if self._state != SchedulerState.RUNNING:
            return
        
        self.logger.info("Stopping scheduler...")
        self._state = SchedulerState.STOPPING
        
        if self._thread:
            self._thread.join(timeout=self.poll_interval * 2)
        
        self._state = SchedulerState.STOPPED
        self.logger.info("Scheduler stopped")
    
    def pause(self):
        """Pause the scheduler."""
        if self._state == SchedulerState.RUNNING:
            self._state = SchedulerState.PAUSED
            self.logger.info("Scheduler paused")
    
    def resume(self):
        """Resume the scheduler."""
        if self._state == SchedulerState.PAUSED:
            self._state = SchedulerState.RUNNING
            self.logger.info("Scheduler resumed")
    
    def get_status(self) -> Dict[str, Any]:
        """Get scheduler status."""
        return {
            'state': self._state.value,
            'poll_interval': self.poll_interval,
            'max_concurrent': self.max_concurrent,
            'rate_limit': self.rate_limit,
            'running_tasks': len(self._running_tasks),
            'backlog_count': len(self._get_backlog_tasks())
        }


# Singleton instance
_scheduler: Optional[Scheduler] = None


def get_scheduler() -> Scheduler:
    """Get singleton Scheduler instance."""
    global _scheduler
    if _scheduler is None:
        _scheduler = Scheduler()
    return _scheduler


def start_scheduler(task_runner=None, **kwargs) -> Scheduler:
    """Start the scheduler with given configuration."""
    scheduler = get_scheduler()
    if task_runner:
        scheduler.set_task_runner(task_runner)
    for key, value in kwargs.items():
        if hasattr(scheduler, key):
            setattr(scheduler, key, value)
    scheduler.start()
    return scheduler
