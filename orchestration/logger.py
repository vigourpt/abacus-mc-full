"""Logging system for Mission Control orchestration.

Provides structured logging with timestamps, task IDs, and multiple outputs.
"""

import os
import sys
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Optional, Any
from enum import Enum


class LogLevel(Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


class Logger:
    """Mission Control logging system."""
    
    _instance = None
    
    def __init__(
        self,
        log_dir: str = None,
        log_level: str = "INFO",
        console_output: bool = True
    ):
        self.log_dir = Path(log_dir or os.getenv(
            'MC_LOG_DIR', 
            os.path.join(os.path.dirname(__file__), '..', 'logs')
        ))
        self.log_dir.mkdir(parents=True, exist_ok=True)
        self.console_output = console_output
        
        # Setup Python logger
        self.logger = logging.getLogger('mission_control')
        self.logger.setLevel(getattr(logging, log_level.upper()))
        self.logger.handlers = []  # Clear existing handlers
        
        # File handler - main log
        main_log = self.log_dir / 'mission_control.log'
        file_handler = logging.FileHandler(main_log)
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s | %(levelname)-8s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        ))
        self.logger.addHandler(file_handler)
        
        # Console handler
        if console_output:
            console_handler = logging.StreamHandler(sys.stdout)
            console_handler.setFormatter(logging.Formatter(
                '\033[90m%(asctime)s\033[0m | %(levelname)-8s | %(message)s',
                datefmt='%H:%M:%S'
            ))
            self.logger.addHandler(console_handler)
    
    @classmethod
    def get_instance(cls, **kwargs) -> 'Logger':
        if cls._instance is None:
            cls._instance = cls(**kwargs)
        return cls._instance
    
    def _format_message(self, message: str, task_id: Optional[str] = None, **extra) -> str:
        """Format log message with optional metadata."""
        parts = []
        if task_id:
            parts.append(f"[{task_id}]")
        parts.append(message)
        if extra:
            parts.append(f"| {json.dumps(extra)}")
        return ' '.join(parts)
    
    def task_start(self, task_id: str, agent: str, description: str):
        """Log task start event."""
        self.logger.info(self._format_message(
            f"TASK START - Agent: {agent}",
            task_id=task_id,
            description=description[:100]
        ))
        self._write_task_log(task_id, 'start', {'agent': agent, 'description': description})
    
    def agent_execution(self, task_id: str, agent: str, status: str, details: Any = None):
        """Log agent execution event."""
        self.logger.info(self._format_message(
            f"AGENT EXEC - {agent}: {status}",
            task_id=task_id
        ))
        self._write_task_log(task_id, 'execution', {
            'agent': agent, 
            'status': status,
            'details': str(details)[:500] if details else None
        })
    
    def task_complete(self, task_id: str, success: bool, result: Any = None):
        """Log task completion event."""
        status = "SUCCESS" if success else "FAILED"
        level = logging.INFO if success else logging.ERROR
        self.logger.log(level, self._format_message(
            f"TASK COMPLETE - {status}",
            task_id=task_id
        ))
        self._write_task_log(task_id, 'complete', {'success': success, 'result': str(result)[:500]})
    
    def error(self, message: str, task_id: Optional[str] = None, exception: Optional[Exception] = None):
        """Log error event."""
        self.logger.error(self._format_message(
            f"ERROR - {message}",
            task_id=task_id,
            exception=str(exception) if exception else None
        ))
    
    def info(self, message: str, task_id: Optional[str] = None, **extra):
        """Log info event."""
        self.logger.info(self._format_message(message, task_id, **extra))
    
    def debug(self, message: str, task_id: Optional[str] = None, **extra):
        """Log debug event."""
        self.logger.debug(self._format_message(message, task_id, **extra))
    
    def warning(self, message: str, task_id: Optional[str] = None, **extra):
        """Log warning event."""
        self.logger.warning(self._format_message(message, task_id, **extra))
    
    def _write_task_log(self, task_id: str, event_type: str, data: dict):
        """Write structured task log to file."""
        task_log_dir = self.log_dir / 'tasks'
        task_log_dir.mkdir(exist_ok=True)
        
        log_entry = {
            'timestamp': datetime.utcnow().isoformat(),
            'task_id': task_id,
            'event': event_type,
            'data': data
        }
        
        log_file = task_log_dir / f"{task_id}.jsonl"
        with open(log_file, 'a') as f:
            f.write(json.dumps(log_entry) + '\n')


# Convenience function
def get_logger(**kwargs) -> Logger:
    """Get the singleton logger instance."""
    return Logger.get_instance(**kwargs)
