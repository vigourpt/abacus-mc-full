"""Execution Run Sessions - IMPROVEMENT 2

Creates isolated run sessions for each Mission Control execution,
storing all runtime data in organized directories.

Directory Structure:
    runs/
    └── {run_id}/
        ├── tasks.json      # All tasks for this run
        ├── logs.json       # Execution logs (structured)
        ├── metrics.json    # Performance metrics
        └── outputs/        # Agent outputs by task
            └── {task_id}/
                └── output.json

Usage:
    from orchestration.run_sessions import RunSession, create_run
    
    run = create_run()  # Creates new run with unique ID
    run.log_event('task_started', {'task_id': 'task_123'})
    run.save_output('task_123', {'result': 'success'})
"""

import os
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict, field
from enum import Enum


class RunStatus(Enum):
    """Status of a run session."""
    INITIALIZING = "initializing"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class RunMetadata:
    """Metadata for a run session."""
    run_id: str
    status: str
    started_at: str
    ended_at: Optional[str] = None
    task_count: int = 0
    completed_count: int = 0
    failed_count: int = 0
    config: Dict = field(default_factory=dict)


class RunSession:
    """Manages a single execution run session.
    
    Provides isolated storage for all data generated during a run,
    including tasks, logs, outputs, and metrics.
    """
    
    def __init__(self, run_id: str = None, base_dir: str = None):
        """Initialize a run session.
        
        Args:
            run_id: Unique identifier (auto-generated if not provided)
            base_dir: Base directory for runs (default: ./runs)
        """
        self.run_id = run_id or self._generate_run_id()
        self.base_dir = Path(base_dir or os.getenv(
            'MC_RUNS_DIR',
            os.path.join(os.path.dirname(__file__), '..', 'runs')
        ))
        self.run_dir = self.base_dir / self.run_id
        self.outputs_dir = self.run_dir / 'outputs'
        
        self._metadata: Optional[RunMetadata] = None
        self._tasks: Dict[str, dict] = {}
        self._logs: List[dict] = []
        self._metrics: Dict[str, Any] = {}
        
        self._ensure_directories()
        self._initialize_metadata()
    
    def _generate_run_id(self) -> str:
        """Generate unique run ID with timestamp prefix."""
        timestamp = datetime.utcnow().strftime('%Y%m%d_%H%M%S')
        unique = uuid.uuid4().hex[:8]
        return f"run_{timestamp}_{unique}"
    
    def _ensure_directories(self):
        """Create run directory structure."""
        self.run_dir.mkdir(parents=True, exist_ok=True)
        self.outputs_dir.mkdir(exist_ok=True)
    
    def _initialize_metadata(self):
        """Initialize or load run metadata."""
        meta_file = self.run_dir / 'metadata.json'
        
        if meta_file.exists():
            with open(meta_file) as f:
                data = json.load(f)
            self._metadata = RunMetadata(**data)
        else:
            self._metadata = RunMetadata(
                run_id=self.run_id,
                status=RunStatus.INITIALIZING.value,
                started_at=datetime.utcnow().isoformat(),
                config={}
            )
            self._save_metadata()
    
    def _save_metadata(self):
        """Save metadata to file."""
        meta_file = self.run_dir / 'metadata.json'
        with open(meta_file, 'w') as f:
            json.dump(asdict(self._metadata), f, indent=2)
    
    @property
    def metadata(self) -> RunMetadata:
        """Get run metadata."""
        return self._metadata
    
    def set_status(self, status: RunStatus):
        """Update run status."""
        self._metadata.status = status.value
        if status in (RunStatus.COMPLETED, RunStatus.FAILED, RunStatus.CANCELLED):
            self._metadata.ended_at = datetime.utcnow().isoformat()
        self._save_metadata()
    
    def set_config(self, config: Dict):
        """Store run configuration."""
        self._metadata.config = config
        self._save_metadata()
    
    # Task Management
    def add_task(self, task_id: str, task_data: dict):
        """Add task to run session."""
        task_data['added_at'] = datetime.utcnow().isoformat()
        self._tasks[task_id] = task_data
        self._metadata.task_count = len(self._tasks)
        self._save_tasks()
        self._save_metadata()
    
    def update_task(self, task_id: str, updates: dict):
        """Update task data."""
        if task_id in self._tasks:
            self._tasks[task_id].update(updates)
            self._tasks[task_id]['updated_at'] = datetime.utcnow().isoformat()
            self._save_tasks()
    
    def complete_task(self, task_id: str, success: bool = True):
        """Mark task as complete."""
        if task_id in self._tasks:
            self._tasks[task_id]['completed_at'] = datetime.utcnow().isoformat()
            self._tasks[task_id]['success'] = success
            
            if success:
                self._metadata.completed_count += 1
            else:
                self._metadata.failed_count += 1
            
            self._save_tasks()
            self._save_metadata()
    
    def get_task(self, task_id: str) -> Optional[dict]:
        """Get task by ID."""
        return self._tasks.get(task_id)
    
    def get_all_tasks(self) -> Dict[str, dict]:
        """Get all tasks in this run."""
        return self._tasks.copy()
    
    def _save_tasks(self):
        """Save tasks to file."""
        tasks_file = self.run_dir / 'tasks.json'
        with open(tasks_file, 'w') as f:
            json.dump(self._tasks, f, indent=2)
    
    def _load_tasks(self):
        """Load tasks from file."""
        tasks_file = self.run_dir / 'tasks.json'
        if tasks_file.exists():
            with open(tasks_file) as f:
                self._tasks = json.load(f)
    
    # Logging
    def log_event(self, event_type: str, data: dict = None, level: str = "INFO"):
        """Log an event to the run session.
        
        Args:
            event_type: Type of event (e.g., 'task_started', 'agent_executed')
            data: Additional event data
            level: Log level (DEBUG, INFO, WARNING, ERROR)
        """
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'event': event_type,
            'level': level,
            'data': data or {}
        }
        self._logs.append(log_entry)
        self._save_logs()
    
    def get_logs(self, event_type: str = None, level: str = None) -> List[dict]:
        """Get logs with optional filtering."""
        logs = self._logs
        if event_type:
            logs = [l for l in logs if l['event'] == event_type]
        if level:
            logs = [l for l in logs if l['level'] == level]
        return logs
    
    def _save_logs(self):
        """Save logs to file."""
        logs_file = self.run_dir / 'logs.json'
        with open(logs_file, 'w') as f:
            json.dump(self._logs, f, indent=2)
    
    def _load_logs(self):
        """Load logs from file."""
        logs_file = self.run_dir / 'logs.json'
        if logs_file.exists():
            with open(logs_file) as f:
                self._logs = json.load(f)
    
    # Output Management
    def save_output(self, task_id: str, output: Any, output_type: str = "result"):
        """Save agent output for a task.
        
        Args:
            task_id: Task identifier
            output: Output data (any JSON-serializable type)
            output_type: Type of output (result, error, intermediate)
        """
        task_output_dir = self.outputs_dir / task_id
        task_output_dir.mkdir(exist_ok=True)
        
        output_file = task_output_dir / f"{output_type}.json"
        output_data = {
            'task_id': task_id,
            'type': output_type,
            'timestamp': datetime.utcnow().isoformat(),
            'content': output
        }
        
        with open(output_file, 'w') as f:
            json.dump(output_data, f, indent=2)
    
    def get_output(self, task_id: str, output_type: str = "result") -> Optional[Any]:
        """Get saved output for a task."""
        output_file = self.outputs_dir / task_id / f"{output_type}.json"
        if output_file.exists():
            with open(output_file) as f:
                data = json.load(f)
            return data.get('content')
        return None
    
    # Metrics
    def record_metric(self, name: str, value: Any, tags: Dict = None):
        """Record a metric value.
        
        Args:
            name: Metric name
            value: Metric value
            tags: Optional tags for the metric
        """
        if name not in self._metrics:
            self._metrics[name] = []
        
        self._metrics[name].append({
            'timestamp': datetime.utcnow().isoformat(),
            'value': value,
            'tags': tags or {}
        })
        self._save_metrics()
    
    def increment_metric(self, name: str, amount: int = 1):
        """Increment a counter metric."""
        if name not in self._metrics:
            self._metrics[name] = 0
        
        if isinstance(self._metrics[name], (int, float)):
            self._metrics[name] += amount
        self._save_metrics()
    
    def get_metrics(self) -> Dict[str, Any]:
        """Get all metrics."""
        return self._metrics.copy()
    
    def _save_metrics(self):
        """Save metrics to file."""
        metrics_file = self.run_dir / 'metrics.json'
        with open(metrics_file, 'w') as f:
            json.dump(self._metrics, f, indent=2)
    
    def _load_metrics(self):
        """Load metrics from file."""
        metrics_file = self.run_dir / 'metrics.json'
        if metrics_file.exists():
            with open(metrics_file) as f:
                self._metrics = json.load(f)
    
    # Summary
    def get_summary(self) -> dict:
        """Get run summary."""
        return {
            'run_id': self.run_id,
            'status': self._metadata.status,
            'started_at': self._metadata.started_at,
            'ended_at': self._metadata.ended_at,
            'task_count': self._metadata.task_count,
            'completed_count': self._metadata.completed_count,
            'failed_count': self._metadata.failed_count,
            'log_count': len(self._logs),
            'metrics': self._metrics
        }
    
    def load(self):
        """Load all data from files."""
        self._load_tasks()
        self._load_logs()
        self._load_metrics()


class RunSessionManager:
    """Manages multiple run sessions."""
    
    def __init__(self, base_dir: str = None):
        self.base_dir = Path(base_dir or os.getenv(
            'MC_RUNS_DIR',
            os.path.join(os.path.dirname(__file__), '..', 'runs')
        ))
        self.base_dir.mkdir(parents=True, exist_ok=True)
        self._current_run: Optional[RunSession] = None
    
    def create_run(self, config: Dict = None) -> RunSession:
        """Create a new run session."""
        run = RunSession(base_dir=str(self.base_dir))
        if config:
            run.set_config(config)
        run.set_status(RunStatus.RUNNING)
        self._current_run = run
        return run
    
    def get_run(self, run_id: str) -> Optional[RunSession]:
        """Get an existing run session."""
        run_dir = self.base_dir / run_id
        if run_dir.exists():
            run = RunSession(run_id=run_id, base_dir=str(self.base_dir))
            run.load()
            return run
        return None
    
    def list_runs(self, limit: int = 50) -> List[dict]:
        """List recent runs."""
        runs = []
        for run_dir in sorted(self.base_dir.iterdir(), reverse=True):
            if not run_dir.is_dir():
                continue
            meta_file = run_dir / 'metadata.json'
            if meta_file.exists():
                with open(meta_file) as f:
                    runs.append(json.load(f))
            if len(runs) >= limit:
                break
        return runs
    
    @property
    def current_run(self) -> Optional[RunSession]:
        """Get current active run."""
        return self._current_run


# Singleton instance
_session_manager: Optional[RunSessionManager] = None


def get_session_manager() -> RunSessionManager:
    """Get singleton RunSessionManager instance."""
    global _session_manager
    if _session_manager is None:
        _session_manager = RunSessionManager()
    return _session_manager


def create_run(config: Dict = None) -> RunSession:
    """Create a new run session (convenience function)."""
    return get_session_manager().create_run(config)


def get_current_run() -> Optional[RunSession]:
    """Get current run session."""
    return get_session_manager().current_run
