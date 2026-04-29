#!/usr/bin/env python3
"""Mission Control - Main Entry Point

Starts the orchestration loop to process tasks via OpenClaw.

Usage:
    python run_mission_control.py
    python run_mission_control.py --config config.yaml
"""

import os
import sys
import signal
import argparse
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent))

import yaml

from connectors.openclaw_client import OpenClawClient
from orchestration.task_runner import TaskRunner
from orchestration.logger import get_logger


class MissionControl:
    """Main Mission Control orchestrator."""
    
    def __init__(self, config_path: str = None):
        self.config = self._load_config(config_path)
        self.logger = get_logger(
            log_level=self.config.get('logging', {}).get('level', 'INFO'),
            console_output=self.config.get('logging', {}).get('console', True)
        )
        self.openclaw_client = None
        self.task_runner = None
        self._shutdown_requested = False
    
    def _load_config(self, config_path: str = None) -> dict:
        """Load configuration from YAML file."""
        if config_path is None:
            config_path = os.getenv('MC_CONFIG', 'config.yaml')
        
        config_file = Path(config_path)
        if config_file.exists():
            with open(config_file) as f:
                return yaml.safe_load(f) or {}
        
        # Return defaults if no config file
        return {
            'openclaw': {
                'endpoint': os.getenv('OPENCLAW_GATEWAY_HOST', 'http://localhost:8080'),
                'token': os.getenv('OPENCLAW_GATEWAY_TOKEN', ''),
                'timeout': 300,
                'retry_attempts': 3
            },
            'task_processing': {
                'max_concurrent': 5,
                'poll_interval': 2.0
            },
            'logging': {
                'level': os.getenv('LOG_LEVEL', 'INFO'),
                'console': True
            },
            'paths': {
                'tasks_dir': 'tasks',
                'projects_dir': 'projects',
                'logs_dir': 'logs'
            }
        }
    
    def _setup_signal_handlers(self):
        """Setup graceful shutdown handlers."""
        def handle_shutdown(signum, frame):
            self.logger.info(f"Received signal {signum}, initiating graceful shutdown...")
            self._shutdown_requested = True
            if self.task_runner:
                self.task_runner.stop()
        
        signal.signal(signal.SIGINT, handle_shutdown)
        signal.signal(signal.SIGTERM, handle_shutdown)
    
    def initialize(self):
        """Initialize all components."""
        self.logger.info("Initializing Mission Control...")
        
        # Setup OpenClaw client
        oc_config = self.config.get('openclaw', {})
        self.openclaw_client = OpenClawClient(
            api_endpoint=oc_config.get('endpoint'),
            api_token=oc_config.get('token'),
            timeout=oc_config.get('timeout', 300),
            retry_attempts=oc_config.get('retry_attempts', 3)
        )
        
        # Check OpenClaw connection
        if self.openclaw_client.health_check():
            self.logger.info("✓ OpenClaw Gateway connected")
        else:
            self.logger.warning("⚠ OpenClaw Gateway not reachable - tasks will queue")
        
        # Setup task runner
        tp_config = self.config.get('task_processing', {})
        self.task_runner = TaskRunner(
            openclaw_client=self.openclaw_client,
            max_concurrent=tp_config.get('max_concurrent', 5),
            poll_interval=tp_config.get('poll_interval', 2.0)
        )
        
        self.logger.info("✓ Task runner initialized")
        self._setup_signal_handlers()
    
    def start(self):
        """Start Mission Control."""
        self.logger.info("="*50)
        self.logger.info("   MISSION CONTROL - STARTING")
        self.logger.info("="*50)
        
        status = self.task_runner.get_status()
        self.logger.info(f"Backlog: {status['backlog_count']} tasks")
        self.logger.info(f"Running: {status['running_count']} tasks")
        self.logger.info(f"Max concurrent: {status['max_concurrent']}")
        self.logger.info("="*50)
        
        try:
            self.task_runner.run_loop()
        except KeyboardInterrupt:
            self.logger.info("Keyboard interrupt received")
        finally:
            self.shutdown()
    
    def shutdown(self):
        """Graceful shutdown."""
        self.logger.info("Shutting down Mission Control...")
        if self.task_runner:
            self.task_runner.stop()
        self.logger.info("Mission Control stopped")


def main():
    parser = argparse.ArgumentParser(
        description='Mission Control - AI Agent Orchestration'
    )
    parser.add_argument(
        '--config', '-c',
        default='config.yaml',
        help='Path to configuration file'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Initialize and show status without running'
    )
    args = parser.parse_args()
    
    mc = MissionControl(config_path=args.config)
    mc.initialize()
    
    if args.dry_run:
        status = mc.task_runner.get_status()
        print("\nMission Control Status:")
        print(f"  OpenClaw Connected: {status['openclaw_connected']}")
        print(f"  Backlog Tasks: {status['backlog_count']}")
        print(f"  Running Tasks: {status['running_count']}")
        print(f"  Max Concurrent: {status['max_concurrent']}")
    else:
        mc.start()


if __name__ == '__main__':
    main()
