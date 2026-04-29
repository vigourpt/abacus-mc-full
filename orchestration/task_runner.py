"""Execution Loop - Task orchestration and execution.

Pulls tasks from backlog, sends to OpenClaw agents, and manages completion.
"""

import os
import json
import time
import asyncio
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from enum import Enum

from .logger import get_logger
from .project_memory import ProjectMemory, write_output, append_log
from ..connectors.openclaw_client import OpenClawClient, AgentResult, AgentStatus


class TaskState(Enum):
    BACKLOG = "backlog"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


@dataclass
class Task:
    """Task definition for orchestration."""
    task_id: str
    project: str
    agent: str
    description: str
    status: str
    context: Dict
    created_at: str
    updated_at: str
    result: Optional[Any] = None
    error: Optional[str] = None
    retries: int = 0
    max_retries: int = 3


class TaskStateManager:
    """Manage task state using JSON files."""
    
    def __init__(self, tasks_dir: str = None):
        self.tasks_dir = Path(tasks_dir or os.getenv(
            'MC_TASKS_DIR',
            os.path.join(os.path.dirname(__file__), '..', 'tasks')
        ))
        # Ensure directories exist
        (self.tasks_dir / 'backlog').mkdir(parents=True, exist_ok=True)
        (self.tasks_dir / 'running').mkdir(parents=True, exist_ok=True)
        (self.tasks_dir / 'completed').mkdir(parents=True, exist_ok=True)
    
    def _get_task_path(self, task_id: str, state: TaskState) -> Path:
        return self.tasks_dir / state.value / f"{task_id}.json"
    
    def _find_task(self, task_id: str) -> Optional[tuple]:
        """Find task in any state folder."""
        for state in TaskState:
            path = self._get_task_path(task_id, state)
            if path.exists():
                return (path, state)
        return None
    
    def create_task(self, task: Task) -> Task:
        """Create a new task in backlog."""
        task.status = TaskState.BACKLOG.value
        task.created_at = datetime.utcnow().isoformat()
        task.updated_at = task.created_at
        
        path = self._get_task_path(task.task_id, TaskState.BACKLOG)
        with open(path, 'w') as f:
            json.dump(asdict(task), f, indent=2)
        
        return task
    
    def get_task(self, task_id: str) -> Optional[Task]:
        """Get task by ID from any state."""
        result = self._find_task(task_id)
        if not result:
            return None
        
        path, _ = result
        with open(path) as f:
            data = json.load(f)
        return Task(**data)
    
    def move_task(self, task_id: str, new_state: TaskState) -> Optional[Task]:
        """Move task to a new state folder."""
        result = self._find_task(task_id)
        if not result:
            return None
        
        old_path, old_state = result
        if old_state == new_state:
            return self.get_task(task_id)
        
        # Read task data
        with open(old_path) as f:
            data = json.load(f)
        
        # Update status and timestamp
        data['status'] = new_state.value
        data['updated_at'] = datetime.utcnow().isoformat()
        
        # Write to new location
        new_path = self._get_task_path(task_id, new_state)
        with open(new_path, 'w') as f:
            json.dump(data, f, indent=2)
        
        # Remove old file
        old_path.unlink()
        
        return Task(**data)
    
    def update_task(self, task: Task) -> Task:
        """Update task data in place."""
        result = self._find_task(task.task_id)
        if not result:
            raise ValueError(f"Task {task.task_id} not found")
        
        path, _ = result
        task.updated_at = datetime.utcnow().isoformat()
        
        with open(path, 'w') as f:
            json.dump(asdict(task), f, indent=2)
        
        return task
    
    def get_backlog(self) -> List[Task]:
        """Get all tasks in backlog."""
        backlog_dir = self.tasks_dir / 'backlog'
        tasks = []
        for path in backlog_dir.glob('*.json'):
            with open(path) as f:
                data = json.load(f)
            tasks.append(Task(**data))
        return tasks
    
    def get_running(self) -> List[Task]:
        """Get all running tasks."""
        running_dir = self.tasks_dir / 'running'
        tasks = []
        for path in running_dir.glob('*.json'):
            with open(path) as f:
                data = json.load(f)
            tasks.append(Task(**data))
        return tasks


class TaskRunner:
    """Orchestration loop for task execution."""
    
    def __init__(
        self,
        openclaw_client: OpenClawClient = None,
        max_concurrent: int = 5,
        poll_interval: float = 2.0
    ):
        self.client = openclaw_client or OpenClawClient()
        self.state_manager = TaskStateManager()
        self.project_memory = ProjectMemory()
        self.logger = get_logger()
        self.max_concurrent = max_concurrent
        self.poll_interval = poll_interval
        self._running = False
        self._executor = ThreadPoolExecutor(max_workers=max_concurrent)
    
    def submit_task(
        self,
        project: str,
        agent: str,
        description: str,
        context: Dict = None,
        task_id: str = None
    ) -> Task:
        """Submit a new task to the backlog."""
        task = Task(
            task_id=task_id or f"task_{int(time.time() * 1000)}",
            project=project,
            agent=agent,
            description=description,
            status=TaskState.BACKLOG.value,
            context=context or {},
            created_at="",
            updated_at=""
        )
        return self.state_manager.create_task(task)
    
    def _execute_task(self, task: Task) -> Task:
        """Execute a single task via OpenClaw."""
        self.logger.task_start(task.task_id, task.agent, task.description)
        
        # Move to running
        self.state_manager.move_task(task.task_id, TaskState.RUNNING)
        
        try:
            # Execute via OpenClaw
            result = self.client.run_agent(
                agent_name=task.agent,
                task=task.description,
                context=task.context,
                task_id=task.task_id
            )
            
            self.logger.agent_execution(
                task.task_id, 
                task.agent, 
                result.status.value,
                result.output
            )
            
            if result.success:
                task.result = result.output
                task.status = TaskState.COMPLETED.value
                
                # Store result in project memory
                write_output(task.project, task.agent, task.task_id, result.output)
                append_log(task.project, f"Task {task.task_id} completed by {task.agent}")
                
                self.state_manager.move_task(task.task_id, TaskState.COMPLETED)
                self.logger.task_complete(task.task_id, True, result.output)
            else:
                raise Exception(result.error or "Agent execution failed")
                
        except Exception as e:
            task.error = str(e)
            task.retries += 1
            
            if task.retries < task.max_retries:
                # Move back to backlog for retry
                self.logger.warning(
                    f"Task failed, retry {task.retries}/{task.max_retries}",
                    task_id=task.task_id
                )
                self.state_manager.move_task(task.task_id, TaskState.BACKLOG)
                self.state_manager.update_task(task)
            else:
                # Max retries exceeded
                task.status = TaskState.COMPLETED.value  # Move to completed (failed)
                self.state_manager.move_task(task.task_id, TaskState.COMPLETED)
                self.state_manager.update_task(task)
                
                append_log(
                    task.project, 
                    f"Task {task.task_id} failed after {task.retries} retries: {e}",
                    level="ERROR"
                )
                self.logger.task_complete(task.task_id, False, str(e))
        
        return task
    
    def process_backlog(self) -> List[Task]:
        """Process all tasks in backlog (one iteration)."""
        backlog = self.state_manager.get_backlog()
        running = self.state_manager.get_running()
        
        # Respect concurrency limit
        available_slots = self.max_concurrent - len(running)
        if available_slots <= 0:
            return []
        
        tasks_to_run = backlog[:available_slots]
        completed = []
        
        # Execute concurrently
        futures = {
            self._executor.submit(self._execute_task, task): task
            for task in tasks_to_run
        }
        
        for future in as_completed(futures):
            try:
                result = future.result()
                completed.append(result)
            except Exception as e:
                task = futures[future]
                self.logger.error(f"Unexpected error executing task", task.task_id, e)
        
        return completed
    
    def run_loop(self):
        """Run continuous orchestration loop."""
        self.logger.info("Starting task runner loop")
        self._running = True
        
        while self._running:
            try:
                completed = self.process_backlog()
                if completed:
                    self.logger.info(f"Processed {len(completed)} tasks")
            except Exception as e:
                self.logger.error(f"Error in orchestration loop: {e}")
            
            time.sleep(self.poll_interval)
    
    def stop(self):
        """Stop the orchestration loop."""
        self.logger.info("Stopping task runner")
        self._running = False
        self._executor.shutdown(wait=True)
    
    def get_status(self) -> Dict:
        """Get current runner status."""
        return {
            'running': self._running,
            'backlog_count': len(self.state_manager.get_backlog()),
            'running_count': len(self.state_manager.get_running()),
            'max_concurrent': self.max_concurrent,
            'openclaw_connected': self.client.health_check()
        }
