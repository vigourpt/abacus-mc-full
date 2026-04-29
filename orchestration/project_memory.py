"""Project Memory Bridge - Manage project data and outputs.

Each project stores its data in: projects/{project_name}/
  - brief.md: Project description
  - outputs.md: Agent results
  - logs.md: Execution logs
"""

import os
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Optional, Any
from dataclasses import dataclass, asdict


@dataclass
class ProjectData:
    """Project data structure."""
    name: str
    brief: str
    outputs: list
    logs: list
    created_at: str
    updated_at: str


class ProjectMemory:
    """Helper module for project data management."""
    
    def __init__(self, base_path: str = None):
        self.base_path = Path(base_path or os.getenv(
            'MC_PROJECTS_DIR',
            os.path.join(os.path.dirname(__file__), '..', 'projects')
        ))
        self.base_path.mkdir(parents=True, exist_ok=True)
    
    def _get_project_dir(self, project_name: str) -> Path:
        """Get or create project directory."""
        project_dir = self.base_path / project_name
        project_dir.mkdir(parents=True, exist_ok=True)
        return project_dir
    
    def create_project(self, project_name: str, brief: str) -> ProjectData:
        """Create a new project with initial brief."""
        project_dir = self._get_project_dir(project_name)
        now = datetime.utcnow().isoformat()
        
        # Write brief
        brief_file = project_dir / 'brief.md'
        with open(brief_file, 'w') as f:
            f.write(f"# {project_name}\n\n")
            f.write(f"Created: {now}\n\n")
            f.write(f"## Description\n\n{brief}\n")
        
        # Initialize outputs
        outputs_file = project_dir / 'outputs.md'
        with open(outputs_file, 'w') as f:
            f.write(f"# {project_name} - Agent Outputs\n\n")
            f.write(f"_Last updated: {now}_\n\n")
        
        # Initialize logs
        logs_file = project_dir / 'logs.md'
        with open(logs_file, 'w') as f:
            f.write(f"# {project_name} - Execution Logs\n\n")
            f.write(f"## {now} - Project Created\n\n")
        
        return ProjectData(
            name=project_name,
            brief=brief,
            outputs=[],
            logs=[f"Project created at {now}"],
            created_at=now,
            updated_at=now
        )
    
    def read_project(self, project_name: str) -> Optional[ProjectData]:
        """Read all project data."""
        project_dir = self.base_path / project_name
        if not project_dir.exists():
            return None
        
        brief = ""
        brief_file = project_dir / 'brief.md'
        if brief_file.exists():
            brief = brief_file.read_text()
        
        outputs = []
        outputs_file = project_dir / 'outputs.md'
        if outputs_file.exists():
            outputs = [outputs_file.read_text()]
        
        logs = []
        logs_file = project_dir / 'logs.md'
        if logs_file.exists():
            logs = [logs_file.read_text()]
        
        # Get timestamps from metadata if available
        meta_file = project_dir / 'meta.json'
        created_at = updated_at = datetime.utcnow().isoformat()
        if meta_file.exists():
            meta = json.loads(meta_file.read_text())
            created_at = meta.get('created_at', created_at)
            updated_at = meta.get('updated_at', updated_at)
        
        return ProjectData(
            name=project_name,
            brief=brief,
            outputs=outputs,
            logs=logs,
            created_at=created_at,
            updated_at=updated_at
        )
    
    def write_output(
        self, 
        project_name: str, 
        agent: str, 
        task_id: str,
        result: Any
    ):
        """Append agent result to project outputs."""
        project_dir = self._get_project_dir(project_name)
        outputs_file = project_dir / 'outputs.md'
        now = datetime.utcnow().isoformat()
        
        # Format output entry
        output_entry = f"\n---\n\n"
        output_entry += f"## {agent} - {task_id}\n\n"
        output_entry += f"_Executed: {now}_\n\n"
        
        if isinstance(result, dict):
            output_entry += f"```json\n{json.dumps(result, indent=2)}\n```\n"
        else:
            output_entry += f"{result}\n"
        
        with open(outputs_file, 'a') as f:
            f.write(output_entry)
        
        self._update_meta(project_name)
    
    def append_log(
        self,
        project_name: str,
        message: str,
        level: str = "INFO"
    ):
        """Append execution log entry."""
        project_dir = self._get_project_dir(project_name)
        logs_file = project_dir / 'logs.md'
        now = datetime.utcnow().isoformat()
        
        log_entry = f"\n### [{level}] {now}\n\n{message}\n"
        
        with open(logs_file, 'a') as f:
            f.write(log_entry)
        
        self._update_meta(project_name)
    
    def _update_meta(self, project_name: str):
        """Update project metadata."""
        project_dir = self._get_project_dir(project_name)
        meta_file = project_dir / 'meta.json'
        
        meta = {}
        if meta_file.exists():
            meta = json.loads(meta_file.read_text())
        
        if 'created_at' not in meta:
            meta['created_at'] = datetime.utcnow().isoformat()
        meta['updated_at'] = datetime.utcnow().isoformat()
        
        with open(meta_file, 'w') as f:
            json.dump(meta, f, indent=2)
    
    def list_projects(self) -> list:
        """List all projects."""
        return [
            d.name for d in self.base_path.iterdir()
            if d.is_dir() and not d.name.startswith('.')
        ]


# Convenience functions
_memory = None

def _get_memory() -> ProjectMemory:
    global _memory
    if _memory is None:
        _memory = ProjectMemory()
    return _memory

def read_project(project_name: str) -> Optional[ProjectData]:
    """Read project data."""
    return _get_memory().read_project(project_name)

def write_output(project_name: str, agent: str, task_id: str, result: Any):
    """Write agent output to project."""
    _get_memory().write_output(project_name, agent, task_id, result)

def append_log(project_name: str, message: str, level: str = "INFO"):
    """Append log to project."""
    _get_memory().append_log(project_name, message, level)
