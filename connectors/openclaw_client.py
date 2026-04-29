"""OpenClaw Connector - Send tasks to OpenClaw agents.

This module provides the interface between Mission Control and OpenClaw runtime.
"""

import os
import json
import time
import requests
from typing import Any, Dict, Optional
from dataclasses import dataclass
from enum import Enum


class AgentStatus(Enum):
    IDLE = "idle"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    TIMEOUT = "timeout"


@dataclass
class AgentResult:
    """Result from an agent execution."""
    success: bool
    agent_name: str
    task_id: str
    output: Any
    error: Optional[str] = None
    execution_time: float = 0.0
    status: AgentStatus = AgentStatus.COMPLETED


class OpenClawClient:
    """Client for communicating with OpenClaw runtime."""
    
    def __init__(
        self,
        api_endpoint: str = None,
        api_token: str = None,
        timeout: int = 300,
        retry_attempts: int = 3
    ):
        self.api_endpoint = api_endpoint or os.getenv(
            'OPENCLAW_GATEWAY_HOST', 'http://localhost:8080'
        )
        self.api_token = api_token or os.getenv('OPENCLAW_GATEWAY_TOKEN', '')
        self.timeout = timeout
        self.retry_attempts = retry_attempts
        self._session = requests.Session()
        self._session.headers.update({
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.api_token}' if self.api_token else ''
        })
    
    def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        data: Optional[Dict] = None
    ) -> Dict:
        """Make HTTP request to OpenClaw API with retry logic."""
        url = f"{self.api_endpoint.rstrip('/')}/{endpoint.lstrip('/')}"
        last_error = None
        
        for attempt in range(self.retry_attempts):
            try:
                response = self._session.request(
                    method=method,
                    url=url,
                    json=data,
                    timeout=self.timeout
                )
                response.raise_for_status()
                return response.json()
            except requests.exceptions.Timeout:
                last_error = f"Request timed out after {self.timeout}s"
            except requests.exceptions.ConnectionError as e:
                last_error = f"Connection error: {str(e)}"
            except requests.exceptions.HTTPError as e:
                last_error = f"HTTP error: {str(e)}"
                if response.status_code < 500:
                    break  # Don't retry client errors
            except Exception as e:
                last_error = f"Unexpected error: {str(e)}"
            
            if attempt < self.retry_attempts - 1:
                time.sleep(2 ** attempt)  # Exponential backoff
        
        raise ConnectionError(last_error)
    
    def run_agent(
        self,
        agent_name: str,
        task: str,
        context: Optional[Dict] = None,
        task_id: Optional[str] = None
    ) -> AgentResult:
        """Execute a task on an OpenClaw agent.
        
        Args:
            agent_name: Name/slug of the agent to run
            task: Task description or instruction
            context: Additional context for the agent
            task_id: Optional task ID for tracking
            
        Returns:
            AgentResult with execution outcome
        """
        task_id = task_id or f"task_{int(time.time() * 1000)}"
        start_time = time.time()
        
        payload = {
            'agent': agent_name,
            'task': task,
            'context': context or {},
            'task_id': task_id
        }
        
        try:
            result = self._make_request('POST', '/api/agents/execute', payload)
            execution_time = time.time() - start_time
            
            return AgentResult(
                success=result.get('success', True),
                agent_name=agent_name,
                task_id=task_id,
                output=result.get('output', result),
                execution_time=execution_time,
                status=AgentStatus.COMPLETED
            )
        except Exception as e:
            return AgentResult(
                success=False,
                agent_name=agent_name,
                task_id=task_id,
                output=None,
                error=str(e),
                execution_time=time.time() - start_time,
                status=AgentStatus.FAILED
            )
    
    def get_agent_status(self, agent_name: str) -> Dict:
        """Get the current status of an agent."""
        try:
            return self._make_request('GET', f'/api/agents/{agent_name}/status')
        except Exception as e:
            return {'status': 'unknown', 'error': str(e)}
    
    def list_agents(self) -> list:
        """List all available agents in OpenClaw."""
        try:
            result = self._make_request('GET', '/api/agents')
            return result.get('agents', [])
        except Exception:
            return []
    
    def health_check(self) -> bool:
        """Check if OpenClaw gateway is reachable."""
        try:
            self._make_request('GET', '/health')
            return True
        except Exception:
            return False


# Convenience function for quick agent execution
def run_agent(
    agent_name: str,
    task: str,
    context: Optional[Dict] = None
) -> AgentResult:
    """Run an agent task using default client configuration.
    
    Args:
        agent_name: Name of the agent to execute
        task: Task description
        context: Optional context dictionary
        
    Returns:
        AgentResult with execution details
    """
    client = OpenClawClient()
    return client.run_agent(agent_name, task, context)
