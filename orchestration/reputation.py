"""Agent Reputation System - Track and score agent performance.

Tracks:
- Tasks completed
- Tasks failed
- Execution time
- Success rate

Used for intelligent agent selection - prefer agents with better
track records for similar tasks.
"""

import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from .logger import get_logger
from .database import get_database, AgentReputation


class ReputationManager:
    """Manages agent reputation scoring and updates."""
    
    def __init__(self):
        self.logger = get_logger()
        self.db = get_database()
    
    def get_reputation(self, agent_name: str) -> Optional[AgentReputation]:
        """Get reputation for an agent.
        
        Args:
            agent_name: Name/ID of the agent
        
        Returns:
            AgentReputation object or None if not tracked yet
        """
        return self.db.get_reputation(agent_name)
    
    def get_all_reputations(self) -> List[AgentReputation]:
        """Get all agent reputations, sorted by success rate."""
        return self.db.get_all_reputations()
    
    def update_reputation(
        self,
        agent_name: str,
        success: bool,
        execution_time: float
    ) -> AgentReputation:
        """Update agent reputation after task completion.
        
        Args:
            agent_name: Name/ID of the agent
            success: Whether the task completed successfully
            execution_time: Time taken in seconds
        
        Returns:
            Updated AgentReputation object
        """
        # Get current reputation or create new
        current = self.db.get_reputation(agent_name)
        
        if current:
            # Update existing
            tasks_completed = current.tasks_completed + (1 if success else 0)
            tasks_failed = current.tasks_failed + (0 if success else 1)
            total_time = current.total_execution_time + execution_time
            total_tasks = tasks_completed + tasks_failed
            
            avg_time = total_time / total_tasks if total_tasks > 0 else 0
            success_rate = tasks_completed / total_tasks if total_tasks > 0 else 0
            
            reputation = AgentReputation(
                agent_name=agent_name,
                tasks_completed=tasks_completed,
                tasks_failed=tasks_failed,
                total_execution_time=total_time,
                average_execution_time=avg_time,
                success_rate=success_rate,
                last_updated=datetime.utcnow().isoformat()
            )
        else:
            # Create new
            reputation = AgentReputation(
                agent_name=agent_name,
                tasks_completed=1 if success else 0,
                tasks_failed=0 if success else 1,
                total_execution_time=execution_time,
                average_execution_time=execution_time,
                success_rate=1.0 if success else 0.0,
                last_updated=datetime.utcnow().isoformat()
            )
        
        self.db.upsert_reputation(reputation)
        
        self.logger.info(
            f"Updated reputation for {agent_name}: "
            f"success_rate={reputation.success_rate:.2%}, "
            f"completed={reputation.tasks_completed}, "
            f"failed={reputation.tasks_failed}"
        )
        
        return reputation
    
    def get_top_performers(
        self,
        limit: int = 10,
        min_tasks: int = 3
    ) -> List[AgentReputation]:
        """Get top performing agents.
        
        Args:
            limit: Maximum number to return
            min_tasks: Minimum completed tasks required
        
        Returns:
            List of AgentReputation sorted by success rate
        """
        return self.db.get_top_performers(limit)
    
    def get_agent_score(self, agent_name: str) -> float:
        """Get a normalized score (0-1) for an agent.
        
        Considers:
        - Success rate (60%)
        - Experience (task count) (20%)
        - Efficiency (avg execution time) (20%)
        
        Args:
            agent_name: Name/ID of the agent
        
        Returns:
            Normalized score between 0 and 1
        """
        rep = self.get_reputation(agent_name)
        
        if not rep:
            return 0.5  # Neutral score for new agents
        
        total_tasks = rep.tasks_completed + rep.tasks_failed
        
        if total_tasks == 0:
            return 0.5
        
        # Success rate component (60%)
        success_component = rep.success_rate * 0.6
        
        # Experience component (20%) - logarithmic scale
        import math
        experience_component = min(1.0, math.log(total_tasks + 1) / 5) * 0.2
        
        # Efficiency component (20%) - faster is better
        # Assume 60 seconds is "average"
        if rep.average_execution_time > 0:
            efficiency = min(1.0, 60 / rep.average_execution_time)
        else:
            efficiency = 0.5
        efficiency_component = efficiency * 0.2
        
        return success_component + experience_component + efficiency_component
    
    def rank_agents(
        self,
        agent_names: List[str]
    ) -> List[Tuple[str, float]]:
        """Rank a list of agents by their reputation scores.
        
        Args:
            agent_names: List of agent names to rank
        
        Returns:
            List of (agent_name, score) tuples sorted by score
        """
        scores = [(name, self.get_agent_score(name)) for name in agent_names]
        scores.sort(key=lambda x: x[1], reverse=True)
        return scores
    
    def get_summary(self) -> Dict:
        """Get summary statistics for all agents."""
        stats = self.db.get_stats()
        top_performers = self.get_top_performers(5)
        
        return {
            'total_agents_tracked': stats['tracked_agents'],
            'total_tasks_completed': stats['total_tasks_completed'],
            'average_success_rate': stats['average_success_rate'],
            'top_performers': [
                {
                    'agent': r.agent_name,
                    'success_rate': r.success_rate,
                    'tasks_completed': r.tasks_completed
                }
                for r in top_performers
            ]
        }


# Singleton instance
_reputation_manager: Optional[ReputationManager] = None


def get_reputation_manager() -> ReputationManager:
    """Get the singleton reputation manager instance."""
    global _reputation_manager
    if _reputation_manager is None:
        _reputation_manager = ReputationManager()
    return _reputation_manager


def update_agent_reputation(
    agent_name: str,
    success: bool,
    execution_time: float
) -> AgentReputation:
    """Convenience function to update agent reputation.
    
    Call this after each task completion to track performance.
    
    Args:
        agent_name: Name/ID of the agent
        success: Whether the task completed successfully
        execution_time: Time taken in seconds
    
    Returns:
        Updated AgentReputation object
    """
    return get_reputation_manager().update_reputation(
        agent_name=agent_name,
        success=success,
        execution_time=execution_time
    )


def get_agent_score(agent_name: str) -> float:
    """Convenience function to get agent score."""
    return get_reputation_manager().get_agent_score(agent_name)


def rank_agents_by_reputation(agent_names: List[str]) -> List[Tuple[str, float]]:
    """Convenience function to rank agents."""
    return get_reputation_manager().rank_agents(agent_names)
