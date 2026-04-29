"""Enhanced Observability - IMPROVEMENT 5 (Part 1: Metrics Collection)

Provides structured metrics tracking for Mission Control operations.

Metrics tracked:
- tasks_created: Total tasks created
- tasks_completed: Successfully completed tasks
- tasks_failed: Failed tasks
- tasks_dispatched: Tasks sent to agents
- agent_execution_time: Execution duration per agent
- agent_utilization: Time agents spend active
- scheduler_errors: Scheduling errors
- dispatch_errors: Dispatch failures

Usage:
    from orchestration.metrics import MetricsCollector, get_metrics_collector
    
    metrics = get_metrics_collector()
    metrics.increment('tasks_completed')
    metrics.record('agent_execution_time', 45.2, tags={'agent': 'developer'})
"""

import os
import json
import time
import threading
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Union
from dataclasses import dataclass, field, asdict
from enum import Enum
from collections import defaultdict


class MetricType(Enum):
    """Type of metric."""
    COUNTER = "counter"       # Monotonically increasing
    GAUGE = "gauge"           # Point-in-time value
    HISTOGRAM = "histogram"   # Distribution of values
    TIMER = "timer"           # Duration measurements


@dataclass
class MetricPoint:
    """Single metric data point."""
    name: str
    value: Union[int, float]
    timestamp: str
    type: str
    tags: Dict[str, str] = field(default_factory=dict)


@dataclass
class MetricSummary:
    """Summary statistics for a metric."""
    name: str
    type: str
    count: int
    total: float
    min: float
    max: float
    avg: float
    last_value: float
    last_updated: str


class MetricsCollector:
    """Collects and stores metrics for observability.
    
    Provides methods to increment counters, record values,
    and retrieve metric summaries.
    """
    
    # Predefined metrics
    METRICS = {
        'tasks_created': MetricType.COUNTER,
        'tasks_completed': MetricType.COUNTER,
        'tasks_failed': MetricType.COUNTER,
        'tasks_dispatched': MetricType.COUNTER,
        'tasks_blocked': MetricType.COUNTER,
        'agent_execution_time': MetricType.TIMER,
        'agent_utilization': MetricType.GAUGE,
        'scheduler_errors': MetricType.COUNTER,
        'dispatch_errors': MetricType.COUNTER,
        'dependency_wait_time': MetricType.TIMER,
        'queue_depth': MetricType.GAUGE,
        'concurrent_tasks': MetricType.GAUGE,
    }
    
    def __init__(self, run_dir: str = None, flush_interval: float = 30.0):
        """Initialize metrics collector.
        
        Args:
            run_dir: Directory to store metrics (e.g., runs/{run_id}/)
            flush_interval: Seconds between disk flushes
        """
        self.run_dir = Path(run_dir) if run_dir else None
        self.flush_interval = flush_interval
        
        # In-memory storage
        self._counters: Dict[str, int] = defaultdict(int)
        self._gauges: Dict[str, float] = {}
        self._timers: Dict[str, List[float]] = defaultdict(list)
        self._history: List[MetricPoint] = []
        
        # Thread safety
        self._lock = threading.Lock()
        
        # Flush thread
        self._last_flush = time.time()
        self._flush_thread: Optional[threading.Thread] = None
        self._running = False
    
    def set_run_dir(self, run_dir: str):
        """Set the run directory for metric storage."""
        self.run_dir = Path(run_dir)
        self.run_dir.mkdir(parents=True, exist_ok=True)
    
    def increment(self, name: str, amount: int = 1, tags: Dict = None):
        """Increment a counter metric.
        
        Args:
            name: Metric name
            amount: Amount to increment (default: 1)
            tags: Optional tags
        """
        with self._lock:
            key = self._make_key(name, tags)
            self._counters[key] += amount
            
            self._record_point(name, self._counters[key], 
                             MetricType.COUNTER, tags)
    
    def set_gauge(self, name: str, value: float, tags: Dict = None):
        """Set a gauge metric value.
        
        Args:
            name: Metric name
            value: Current value
            tags: Optional tags
        """
        with self._lock:
            key = self._make_key(name, tags)
            self._gauges[key] = value
            
            self._record_point(name, value, MetricType.GAUGE, tags)
    
    def record(self, name: str, value: float, tags: Dict = None):
        """Record a timer/histogram value.
        
        Args:
            name: Metric name
            value: Value to record
            tags: Optional tags
        """
        with self._lock:
            key = self._make_key(name, tags)
            self._timers[key].append(value)
            
            # Keep last 1000 values per metric
            if len(self._timers[key]) > 1000:
                self._timers[key] = self._timers[key][-1000:]
            
            self._record_point(name, value, MetricType.TIMER, tags)
    
    def time(self, name: str, tags: Dict = None):
        """Context manager for timing operations.
        
        Usage:
            with metrics.time('operation_duration'):
                # do something
        """
        return _TimerContext(self, name, tags)
    
    def _make_key(self, name: str, tags: Dict = None) -> str:
        """Create unique key for metric with tags."""
        if not tags:
            return name
        tag_str = ','.join(f"{k}={v}" for k, v in sorted(tags.items()))
        return f"{name}{{{tag_str}}}"
    
    def _record_point(self, name: str, value: float, 
                      metric_type: MetricType, tags: Dict = None):
        """Record a metric point to history."""
        point = MetricPoint(
            name=name,
            value=value,
            timestamp=datetime.utcnow().isoformat(),
            type=metric_type.value,
            tags=tags or {}
        )
        self._history.append(point)
        
        # Limit history size
        if len(self._history) > 10000:
            self._history = self._history[-5000:]
    
    def get_counter(self, name: str, tags: Dict = None) -> int:
        """Get current counter value."""
        key = self._make_key(name, tags)
        return self._counters.get(key, 0)
    
    def get_gauge(self, name: str, tags: Dict = None) -> Optional[float]:
        """Get current gauge value."""
        key = self._make_key(name, tags)
        return self._gauges.get(key)
    
    def get_timer_stats(self, name: str, tags: Dict = None) -> Optional[Dict]:
        """Get statistics for a timer metric."""
        key = self._make_key(name, tags)
        values = self._timers.get(key, [])
        
        if not values:
            return None
        
        return {
            'count': len(values),
            'total': sum(values),
            'min': min(values),
            'max': max(values),
            'avg': sum(values) / len(values),
            'last': values[-1]
        }
    
    def get_all_metrics(self) -> Dict[str, Any]:
        """Get all current metric values."""
        with self._lock:
            result = {
                'counters': dict(self._counters),
                'gauges': dict(self._gauges),
                'timers': {}
            }
            
            for key, values in self._timers.items():
                if values:
                    result['timers'][key] = {
                        'count': len(values),
                        'avg': sum(values) / len(values),
                        'min': min(values),
                        'max': max(values)
                    }
            
            result['collected_at'] = datetime.utcnow().isoformat()
            return result
    
    def get_summary(self) -> List[MetricSummary]:
        """Get summary of all metrics."""
        summaries = []
        
        with self._lock:
            # Counter summaries
            for key, value in self._counters.items():
                summaries.append(MetricSummary(
                    name=key,
                    type='counter',
                    count=1,
                    total=value,
                    min=value,
                    max=value,
                    avg=value,
                    last_value=value,
                    last_updated=datetime.utcnow().isoformat()
                ))
            
            # Gauge summaries
            for key, value in self._gauges.items():
                summaries.append(MetricSummary(
                    name=key,
                    type='gauge',
                    count=1,
                    total=value,
                    min=value,
                    max=value,
                    avg=value,
                    last_value=value,
                    last_updated=datetime.utcnow().isoformat()
                ))
            
            # Timer summaries
            for key, values in self._timers.items():
                if values:
                    summaries.append(MetricSummary(
                        name=key,
                        type='timer',
                        count=len(values),
                        total=sum(values),
                        min=min(values),
                        max=max(values),
                        avg=sum(values) / len(values),
                        last_value=values[-1],
                        last_updated=datetime.utcnow().isoformat()
                    ))
        
        return summaries
    
    def get_recent_history(self, limit: int = 100) -> List[dict]:
        """Get recent metric history."""
        with self._lock:
            return [asdict(p) for p in self._history[-limit:]]
    
    def flush_to_disk(self):
        """Write metrics to disk."""
        if not self.run_dir:
            return
        
        metrics_file = self.run_dir / 'metrics.json'
        
        with self._lock:
            data = {
                'flushed_at': datetime.utcnow().isoformat(),
                'counters': dict(self._counters),
                'gauges': dict(self._gauges),
                'timers': {k: list(v) for k, v in self._timers.items()},
                'history_count': len(self._history)
            }
        
        with open(metrics_file, 'w') as f:
            json.dump(data, f, indent=2)
        
        self._last_flush = time.time()
    
    def load_from_disk(self):
        """Load metrics from disk."""
        if not self.run_dir:
            return
        
        metrics_file = self.run_dir / 'metrics.json'
        if not metrics_file.exists():
            return
        
        with open(metrics_file) as f:
            data = json.load(f)
        
        with self._lock:
            self._counters = defaultdict(int, data.get('counters', {}))
            self._gauges = data.get('gauges', {})
            self._timers = defaultdict(list, {
                k: list(v) for k, v in data.get('timers', {}).items()
            })
    
    def reset(self):
        """Reset all metrics."""
        with self._lock:
            self._counters.clear()
            self._gauges.clear()
            self._timers.clear()
            self._history.clear()


class _TimerContext:
    """Context manager for timing operations."""
    
    def __init__(self, collector: MetricsCollector, name: str, tags: Dict = None):
        self.collector = collector
        self.name = name
        self.tags = tags
        self.start_time = None
    
    def __enter__(self):
        self.start_time = time.time()
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        duration = time.time() - self.start_time
        self.collector.record(self.name, duration, self.tags)
        return False


# Singleton instance
_metrics_collector: Optional[MetricsCollector] = None


def get_metrics_collector() -> MetricsCollector:
    """Get singleton MetricsCollector instance."""
    global _metrics_collector
    if _metrics_collector is None:
        _metrics_collector = MetricsCollector()
    return _metrics_collector


def increment(name: str, amount: int = 1, tags: Dict = None):
    """Convenience function to increment counter."""
    get_metrics_collector().increment(name, amount, tags)


def record(name: str, value: float, tags: Dict = None):
    """Convenience function to record timer value."""
    get_metrics_collector().record(name, value, tags)
