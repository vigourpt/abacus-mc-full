"""Agent Capability Index - IMPROVEMENT 3

Loads agent capabilities from workspace/agents metadata and provides
capability-based routing for task assignment.

Features:
- Parse capabilities from agent soul.md files
- Match tasks to agents by capabilities
- Score agents based on capability match
- Fallback to rule-based routing

Capability Format (in soul.md):
    ## Core Capabilities
    - capability-one
    - capability-two
    
    specialization: "Some Specialization"
    division: "engineering"

Usage:
    from orchestration.capability_index import CapabilityIndex
    
    index = CapabilityIndex()
    index.load_agents()  # Load from workspace/agents
    matches = index.match_task_to_agents(task)  # Get ranked agents
"""

import os
import re
import yaml
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Any
from dataclasses import dataclass, field

from .logger import get_logger


@dataclass
class AgentCapabilities:
    """Agent capability data."""
    agent_id: str
    name: str
    division: str = "general"
    specialization: str = ""
    capabilities: List[str] = field(default_factory=list)
    technical_skills: List[str] = field(default_factory=list)
    keywords: Set[str] = field(default_factory=set)
    source: str = "local"
    path: str = ""


@dataclass
class CapabilityMatch:
    """Result of matching a task to an agent."""
    agent_id: str
    agent_name: str
    score: float
    matched_capabilities: List[str]
    reason: str


class CapabilityIndex:
    """Index of agent capabilities for intelligent task routing.
    
    Loads capabilities from agent soul.md files and provides
    methods to match tasks to the most suitable agents.
    """
    
    # Division keywords for classification
    DIVISION_KEYWORDS = {
        'engineering': ['code', 'develop', 'build', 'implement', 'api', 'backend', 
                       'frontend', 'database', 'deploy', 'architect', 'debug', 'test'],
        'marketing': ['marketing', 'content', 'social', 'seo', 'campaign', 'brand',
                     'advertise', 'promote', 'copywrite', 'blog'],
        'sales': ['sales', 'revenue', 'customer', 'lead', 'deal', 'prospect',
                 'pipeline', 'crm', 'quota', 'close'],
        'design': ['design', 'ui', 'ux', 'visual', 'graphic', 'figma', 'prototype',
                  'wireframe', 'mockup', 'layout'],
        'operations': ['operations', 'process', 'workflow', 'automation', 'efficiency',
                      'optimize', 'manage', 'coordinate', 'schedule'],
        'testing': ['test', 'qa', 'quality', 'bug', 'regression', 'automation',
                   'selenium', 'cypress', 'coverage'],
        'support': ['support', 'help', 'ticket', 'customer', 'issue', 'resolve',
                   'troubleshoot', 'documentation'],
        'data': ['data', 'analytics', 'report', 'metric', 'insight', 'dashboard',
                'sql', 'visualization', 'etl'],
        'ai': ['ai', 'ml', 'machine learning', 'model', 'nlp', 'neural', 'training',
              'prediction', 'inference', 'llm']
    }
    
    def __init__(self, agents_dir: str = None):
        """Initialize capability index.
        
        Args:
            agents_dir: Path to workspace/agents directory
        """
        self.agents_dir = Path(agents_dir or os.getenv(
            'MC_AGENTS_DIR',
            os.path.join(os.path.dirname(__file__), '..', 'workspace', 'agents')
        ))
        self.logger = get_logger()
        self._agents: Dict[str, AgentCapabilities] = {}
        self._capability_to_agents: Dict[str, List[str]] = {}
        self._loaded = False
    
    def load_agents(self, force_reload: bool = False):
        """Load all agents from workspace/agents directory.
        
        Args:
            force_reload: Force reload even if already loaded
        """
        if self._loaded and not force_reload:
            return
        
        self._agents.clear()
        self._capability_to_agents.clear()
        
        if not self.agents_dir.exists():
            self.logger.warning(f"Agents directory not found: {self.agents_dir}")
            return
        
        for agent_dir in self.agents_dir.iterdir():
            if not agent_dir.is_dir():
                continue
            
            soul_file = agent_dir / 'soul.md'
            if not soul_file.exists():
                continue
            
            try:
                agent = self._parse_agent(agent_dir.name, soul_file)
                if agent:
                    self._agents[agent.agent_id] = agent
                    self._index_capabilities(agent)
            except Exception as e:
                self.logger.warning(f"Failed to parse agent {agent_dir.name}: {e}")
        
        self._loaded = True
        self.logger.info(f"Loaded {len(self._agents)} agents into capability index")
    
    def _parse_agent(self, agent_id: str, soul_file: Path) -> Optional[AgentCapabilities]:
        """Parse agent capabilities from soul.md file."""
        content = soul_file.read_text()
        
        # Extract YAML frontmatter
        frontmatter = {}
        if content.startswith('---'):
            try:
                end = content.find('---', 3)
                if end > 0:
                    yaml_content = content[3:end]
                    frontmatter = yaml.safe_load(yaml_content) or {}
            except Exception:
                pass
        
        # Extract capabilities from content
        capabilities = []
        technical_skills = []
        keywords = set()
        
        # Parse "## Core Capabilities" section
        cap_match = re.search(
            r'##\s*(?:Core\s+)?Capabilities[\s\S]*?(?=\n##|$)',
            content, re.IGNORECASE
        )
        if cap_match:
            cap_section = cap_match.group()
            # Extract bullet points
            for line in cap_section.split('\n'):
                line = line.strip()
                if line.startswith('-'):
                    cap = line[1:].strip()
                    if cap:
                        capabilities.append(cap.lower())
                        keywords.update(cap.lower().split('-'))
        
        # Parse technical skills
        skills_match = re.search(
            r'(?:Technical\s+Skills?|Tools?)[:\s]*[\s\S]*?(?=\n##|$)',
            content, re.IGNORECASE
        )
        if skills_match:
            skills_section = skills_match.group()
            for line in skills_section.split('\n'):
                line = line.strip()
                if line.startswith('-') or line.startswith('*'):
                    skill = line[1:].strip()
                    if skill and ':' in skill:
                        skill = skill.split(':')[0].strip()
                    if skill:
                        technical_skills.append(skill.lower())
                        keywords.update(skill.lower().split())
        
        # Add keywords from name and specialization
        name = frontmatter.get('name', agent_id)
        keywords.update(name.lower().replace('-', ' ').split())
        
        specialization = frontmatter.get('specialization', '')
        if specialization:
            keywords.update(specialization.lower().split())
        
        return AgentCapabilities(
            agent_id=agent_id,
            name=name,
            division=frontmatter.get('division', 'general'),
            specialization=specialization,
            capabilities=capabilities,
            technical_skills=technical_skills,
            keywords=keywords,
            source=frontmatter.get('source', 'local'),
            path=str(soul_file)
        )
    
    def _index_capabilities(self, agent: AgentCapabilities):
        """Index agent by capabilities for quick lookup."""
        for cap in agent.capabilities:
            if cap not in self._capability_to_agents:
                self._capability_to_agents[cap] = []
            self._capability_to_agents[cap].append(agent.agent_id)
        
        # Also index by technical skills
        for skill in agent.technical_skills:
            if skill not in self._capability_to_agents:
                self._capability_to_agents[skill] = []
            self._capability_to_agents[skill].append(agent.agent_id)
    
    def get_agent(self, agent_id: str) -> Optional[AgentCapabilities]:
        """Get agent capabilities by ID."""
        self.load_agents()
        return self._agents.get(agent_id)
    
    def get_all_agents(self) -> List[AgentCapabilities]:
        """Get all indexed agents."""
        self.load_agents()
        return list(self._agents.values())
    
    def get_agents_by_division(self, division: str) -> List[AgentCapabilities]:
        """Get all agents in a division."""
        self.load_agents()
        return [a for a in self._agents.values() if a.division == division]
    
    def get_agents_by_capability(self, capability: str) -> List[str]:
        """Get agent IDs with a specific capability."""
        self.load_agents()
        return self._capability_to_agents.get(capability.lower(), [])
    
    def match_task_to_agents(
        self,
        task: Dict[str, Any],
        limit: int = 5,
        min_score: float = 0.1
    ) -> List[CapabilityMatch]:
        """Match a task to suitable agents based on capabilities.
        
        Args:
            task: Task dictionary with description, context, etc.
            limit: Maximum number of matches to return
            min_score: Minimum score to include in results
            
        Returns:
            List of CapabilityMatch objects, ranked by score
        """
        self.load_agents()
        
        # Extract keywords from task
        task_keywords = self._extract_task_keywords(task)
        task_division = self._detect_task_division(task_keywords)
        
        matches = []
        
        for agent in self._agents.values():
            score, matched_caps, reason = self._score_agent(
                agent, task_keywords, task_division
            )
            
            if score >= min_score:
                matches.append(CapabilityMatch(
                    agent_id=agent.agent_id,
                    agent_name=agent.name,
                    score=score,
                    matched_capabilities=matched_caps,
                    reason=reason
                ))
        
        # Sort by score descending
        matches.sort(key=lambda m: m.score, reverse=True)
        
        return matches[:limit]
    
    def _extract_task_keywords(self, task: Dict[str, Any]) -> Set[str]:
        """Extract keywords from task for matching."""
        keywords = set()
        
        # From description
        description = task.get('description', '')
        words = re.findall(r'\b[a-zA-Z]{3,}\b', description.lower())
        keywords.update(words)
        
        # From context
        context = task.get('context', {})
        if isinstance(context, dict):
            for key, value in context.items():
                if isinstance(value, str):
                    words = re.findall(r'\b[a-zA-Z]{3,}\b', value.lower())
                    keywords.update(words)
        
        # From tags if present
        tags = task.get('tags', [])
        if isinstance(tags, list):
            keywords.update(t.lower() for t in tags if isinstance(t, str))
        
        return keywords
    
    def _detect_task_division(self, keywords: Set[str]) -> Optional[str]:
        """Detect likely division from task keywords."""
        scores = {}
        
        for division, div_keywords in self.DIVISION_KEYWORDS.items():
            score = len(keywords & set(div_keywords))
            if score > 0:
                scores[division] = score
        
        if scores:
            return max(scores, key=scores.get)
        return None
    
    def _score_agent(
        self,
        agent: AgentCapabilities,
        task_keywords: Set[str],
        task_division: Optional[str]
    ) -> Tuple[float, List[str], str]:
        """Score how well an agent matches a task.
        
        Returns:
            Tuple of (score, matched_capabilities, reason)
        """
        score = 0.0
        matched = []
        reasons = []
        
        # Division match (highest weight)
        if task_division and agent.division == task_division:
            score += 0.4
            reasons.append(f"division match ({task_division})")
        
        # Keyword overlap with capabilities
        cap_keywords = set()
        for cap in agent.capabilities:
            cap_keywords.update(cap.split('-'))
        
        keyword_overlap = task_keywords & agent.keywords
        if keyword_overlap:
            overlap_score = min(len(keyword_overlap) * 0.1, 0.3)
            score += overlap_score
            matched.extend(list(keyword_overlap)[:5])
            reasons.append(f"{len(keyword_overlap)} keyword matches")
        
        # Direct capability match
        for cap in agent.capabilities:
            cap_words = set(cap.split('-'))
            if cap_words & task_keywords:
                score += 0.15
                matched.append(cap)
        
        # Technical skill match
        for skill in agent.technical_skills:
            skill_words = set(skill.split())
            if skill_words & task_keywords:
                score += 0.1
                matched.append(skill)
        
        # Specialization bonus
        if agent.specialization:
            spec_words = set(agent.specialization.lower().split())
            if spec_words & task_keywords:
                score += 0.2
                reasons.append(f"specialization match")
        
        reason = '; '.join(reasons) if reasons else "no specific match"
        return (min(score, 1.0), matched, reason)
    
    def get_capability_summary(self) -> Dict[str, Any]:
        """Get summary of indexed capabilities."""
        self.load_agents()
        
        divisions = {}
        for agent in self._agents.values():
            if agent.division not in divisions:
                divisions[agent.division] = 0
            divisions[agent.division] += 1
        
        return {
            'total_agents': len(self._agents),
            'total_capabilities': len(self._capability_to_agents),
            'agents_by_division': divisions,
            'indexed_at': datetime.utcnow().isoformat()
        }


# Singleton instance
_capability_index: Optional[CapabilityIndex] = None


def get_capability_index() -> CapabilityIndex:
    """Get singleton CapabilityIndex instance."""
    global _capability_index
    if _capability_index is None:
        _capability_index = CapabilityIndex()
    return _capability_index


def match_task_to_agents(task: Dict[str, Any], limit: int = 5) -> List[CapabilityMatch]:
    """Convenience function to match task to agents."""
    return get_capability_index().match_task_to_agents(task, limit)
