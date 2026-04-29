"""Task Dependency Graph - IMPROVEMENT 1

Provides dependency management for tasks, allowing tasks to specify
other tasks they depend on using `depends_on: [task_id]` field.

Features:
- Check if all dependencies are satisfied before task execution
- Build dependency graph for visualization
- Topological sorting for execution order
- Circular dependency detection

Usage:
    from orchestration.task_dependencies import DependencyManager
    
    dm = DependencyManager()
    can_run = dm.can_execute('task_123')  # Check if dependencies met
    ready_tasks = dm.get_ready_tasks()     # Get all executable tasks
"""

import os
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple
from dataclasses import dataclass, asdict, field
from enum import Enum

from .logger import get_logger


class DependencyStatus(Enum):
    """Status of a dependency check."""
    SATISFIED = "satisfied"         # All dependencies completed
    PENDING = "pending"             # Some dependencies not yet complete
    BLOCKED = "blocked"             # Dependency failed
    CIRCULAR = "circular"           # Circular dependency detected
    MISSING = "missing"             # Dependency task not found


@dataclass
class DependencyInfo:
    """Information about a task's dependencies."""
    task_id: str
    depends_on: List[str] = field(default_factory=list)
    status: str = "pending"
    satisfied_deps: List[str] = field(default_factory=list)
    pending_deps: List[str] = field(default_factory=list)
    failed_deps: List[str] = field(default_factory=list)
    missing_deps: List[str] = field(default_factory=list)


class DependencyManager:
    """Manages task dependencies and execution order.
    
    Reads task files to determine dependency relationships and
    provides methods to check if tasks are ready for execution.
    """
    
    def __init__(self, tasks_dir: str = None):
        """Initialize dependency manager.
        
        Args:
            tasks_dir: Path to tasks directory (default: MC_TASKS_DIR or ./tasks)
        """
        self.tasks_dir = Path(tasks_dir or os.getenv(
            'MC_TASKS_DIR',
            os.path.join(os.path.dirname(__file__), '..', 'tasks')
        ))
        self.logger = get_logger()
        self._dependency_cache: Dict[str, List[str]] = {}
        self._status_cache: Dict[str, str] = {}
    
    def _load_task(self, task_id: str) -> Optional[dict]:
        """Load task data from any state folder."""
        for state in ['backlog', 'running', 'completed']:
            task_path = self.tasks_dir / state / f"{task_id}.json"
            if task_path.exists():
                with open(task_path) as f:
                    return json.load(f)
        return None
    
    def _get_task_status(self, task_id: str) -> Optional[str]:
        """Get the current status of a task."""
        if task_id in self._status_cache:
            return self._status_cache[task_id]
        
        for state in ['backlog', 'running', 'completed']:
            task_path = self.tasks_dir / state / f"{task_id}.json"
            if task_path.exists():
                with open(task_path) as f:
                    data = json.load(f)
                    status = data.get('status', state)
                    self._status_cache[task_id] = status
                    return status
        return None
    
    def _is_task_completed_successfully(self, task_id: str) -> bool:
        """Check if a task completed successfully (no error)."""
        task = self._load_task(task_id)
        if not task:
            return False
        
        status = task.get('status', '')
        error = task.get('error')
        
        # Task is complete only if in completed state with no error
        return status == 'completed' and not error
    
    def get_dependencies(self, task_id: str) -> List[str]:
        """Get list of task IDs this task depends on.
        
        Args:
            task_id: The task to check
            
        Returns:
            List of task IDs that must complete before this task
        """
        if task_id in self._dependency_cache:
            return self._dependency_cache[task_id]
        
        task = self._load_task(task_id)
        if not task:
            return []
        
        # Support both 'depends_on' field and nested 'context.depends_on'
        depends_on = task.get('depends_on', [])
        if not depends_on:
            context = task.get('context', {})
            depends_on = context.get('depends_on', [])
        
        # Ensure it's a list
        if isinstance(depends_on, str):
            depends_on = [depends_on]
        
        self._dependency_cache[task_id] = depends_on
        return depends_on
    
    def check_dependencies(self, task_id: str) -> DependencyInfo:
        """Check the status of all dependencies for a task.
        
        Args:
            task_id: The task to check
            
        Returns:
            DependencyInfo with detailed status information
        """
        depends_on = self.get_dependencies(task_id)
        
        info = DependencyInfo(
            task_id=task_id,
            depends_on=depends_on,
            satisfied_deps=[],
            pending_deps=[],
            failed_deps=[],
            missing_deps=[]
        )
        
        if not depends_on:
            info.status = DependencyStatus.SATISFIED.value
            return info
        
        for dep_id in depends_on:
            dep_task = self._load_task(dep_id)
            
            if not dep_task:
                info.missing_deps.append(dep_id)
                continue
            
            dep_status = dep_task.get('status', 'backlog')
            dep_error = dep_task.get('error')
            
            if dep_status == 'completed' and not dep_error:
                info.satisfied_deps.append(dep_id)
            elif dep_status == 'completed' and dep_error:
                info.failed_deps.append(dep_id)
            else:
                info.pending_deps.append(dep_id)
        
        # Determine overall status
        if info.missing_deps:
            info.status = DependencyStatus.MISSING.value
        elif info.failed_deps:
            info.status = DependencyStatus.BLOCKED.value
        elif info.pending_deps:
            info.status = DependencyStatus.PENDING.value
        else:
            info.status = DependencyStatus.SATISFIED.value
        
        return info
    
    def can_execute(self, task_id: str) -> bool:
        """Check if a task can be executed (all dependencies satisfied).
        
        Args:
            task_id: The task to check
            
        Returns:
            True if task can be executed, False otherwise
        """
        info = self.check_dependencies(task_id)
        return info.status == DependencyStatus.SATISFIED.value
    
    def get_ready_tasks(self, task_ids: List[str] = None) -> List[str]:
        """Get all tasks that are ready to execute.
        
        Args:
            task_ids: Optional list to check (default: all backlog tasks)
            
        Returns:
            List of task IDs ready for execution
        """
        if task_ids is None:
            # Get all backlog tasks
            backlog_dir = self.tasks_dir / 'backlog'
            if not backlog_dir.exists():
                return []
            task_ids = [p.stem for p in backlog_dir.glob('*.json')]
        
        ready = []
        for task_id in task_ids:
            if self.can_execute(task_id):
                ready.append(task_id)
        
        return ready
    
    def detect_circular_dependencies(self, task_id: str, visited: Set[str] = None) -> bool:
        """Detect if there's a circular dependency involving this task.
        
        Args:
            task_id: Starting task
            visited: Set of already visited tasks (for recursion)
            
        Returns:
            True if circular dependency detected
        """
        if visited is None:
            visited = set()
        
        if task_id in visited:
            return True
        
        visited.add(task_id)
        
        for dep_id in self.get_dependencies(task_id):
            if self.detect_circular_dependencies(dep_id, visited.copy()):
                return True
        
        return False
    
    def build_dependency_graph(self) -> Dict[str, List[str]]:
        """Build complete dependency graph for all tasks.
        
        Returns:
            Dict mapping task_id -> list of task IDs it depends on
        """
        graph = {}
        
        for state in ['backlog', 'running', 'completed']:
            state_dir = self.tasks_dir / state
            if not state_dir.exists():
                continue
            
            for task_file in state_dir.glob('*.json'):
                task_id = task_file.stem
                graph[task_id] = self.get_dependencies(task_id)
        
        return graph
    
    def get_execution_order(self) -> List[str]:
        """Get topologically sorted execution order for all tasks.
        
        Returns:
            List of task IDs in execution order
        """
        graph = self.build_dependency_graph()
        
        # Kahn's algorithm for topological sort
        in_degree = {task: 0 for task in graph}
        for task, deps in graph.items():
            for dep in deps:
                if dep in in_degree:
                    in_degree[task] += 1
        
        # Start with tasks having no dependencies
        queue = [task for task, degree in in_degree.items() if degree == 0]
        result = []
        
        while queue:
            task = queue.pop(0)
            result.append(task)
            
            # Reduce in-degree for dependent tasks
            for other_task, deps in graph.items():
                if task in deps:
                    in_degree[other_task] -= 1
                    if in_degree[other_task] == 0:
                        queue.append(other_task)
        
        return result
    
    def clear_cache(self):
        """Clear internal caches."""
        self._dependency_cache.clear()
        self._status_cache.clear()


# Singleton instance
_dependency_manager: Optional[DependencyManager] = None


def get_dependency_manager() -> DependencyManager:
    """Get singleton DependencyManager instance."""
    global _dependency_manager
    if _dependency_manager is None:
        _dependency_manager = DependencyManager()
    return _dependency_manager


def can_execute_task(task_id: str) -> bool:
    """Convenience function to check if task can execute."""
    return get_dependency_manager().can_execute(task_id)


def get_ready_tasks() -> List[str]:
    """Convenience function to get ready tasks."""
    return get_dependency_manager().get_ready_tasks()
