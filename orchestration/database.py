"""Database Module - SQLite database management for knowledge and reputation.

Manages SQLite database for:
- Agent knowledge storage (reusable insights from tasks)
- Agent reputation scoring (performance metrics)

Auto-initializes tables on startup.
"""

import os
import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from contextlib import contextmanager
from dataclasses import dataclass, asdict

from .logger import get_logger


# Database path
DB_PATH = os.getenv(
    'MC_DATABASE_PATH',
    os.path.join(os.path.dirname(__file__), '..', '.data', 'mission_control.db')
)


@dataclass
class KnowledgeEntry:
    """A knowledge entry captured from agent task execution."""
    id: str
    agent_name: str
    knowledge_type: str  # landing_page_pattern, pricing_strategy, etc.
    domain: str  # marketing, product, engineering, etc.
    content: str  # The actual knowledge/insight
    embedding: Optional[str] = None  # JSON-encoded embedding vector
    project_id: Optional[str] = None
    created_at: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return asdict(self)
    
    @classmethod
    def from_row(cls, row: sqlite3.Row) -> 'KnowledgeEntry':
        return cls(
            id=row['id'],
            agent_name=row['agent_name'],
            knowledge_type=row['knowledge_type'],
            domain=row['domain'],
            content=row['content'],
            embedding=row['embedding'],
            project_id=row['project_id'],
            created_at=row['created_at']
        )


@dataclass
class AgentReputation:
    """Agent reputation and performance metrics."""
    agent_name: str
    tasks_completed: int = 0
    tasks_failed: int = 0
    total_execution_time: float = 0.0  # seconds
    average_execution_time: float = 0.0  # seconds
    success_rate: float = 0.0
    last_updated: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return asdict(self)
    
    @classmethod
    def from_row(cls, row: sqlite3.Row) -> 'AgentReputation':
        return cls(
            agent_name=row['agent_name'],
            tasks_completed=row['tasks_completed'],
            tasks_failed=row['tasks_failed'],
            total_execution_time=row['total_execution_time'],
            average_execution_time=row['average_execution_time'],
            success_rate=row['success_rate'],
            last_updated=row['last_updated']
        )


class DatabaseManager:
    """SQLite database manager for Mission Control.
    
    Handles:
    - Database initialization
    - Knowledge entries CRUD
    - Agent reputation tracking
    - Connection pooling
    """
    
    def __init__(self, db_path: str = None):
        self.db_path = db_path or DB_PATH
        self.logger = get_logger()
        self._ensure_dir()
        self._initialized = False
    
    def _ensure_dir(self):
        """Ensure database directory exists."""
        Path(self.db_path).parent.mkdir(parents=True, exist_ok=True)
    
    @contextmanager
    def get_connection(self):
        """Get a database connection with row factory."""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def initialize(self):
        """Initialize database tables if they don't exist."""
        if self._initialized:
            return
        
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Create knowledge_entries table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS knowledge_entries (
                    id TEXT PRIMARY KEY,
                    agent_name TEXT NOT NULL,
                    knowledge_type TEXT NOT NULL,
                    domain TEXT NOT NULL,
                    content TEXT NOT NULL,
                    embedding TEXT,
                    project_id TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    
                    -- Indexes for common queries
                    CONSTRAINT valid_knowledge_type CHECK (
                        knowledge_type IN (
                            'landing_page_pattern',
                            'pricing_strategy', 
                            'architecture_pattern',
                            'marketing_strategy',
                            'coding_pattern',
                            'sales_approach',
                            'design_pattern',
                            'workflow_process',
                            'general_insight'
                        )
                    )
                )
            ''')
            
            # Create indexes for knowledge_entries
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_knowledge_agent ON knowledge_entries(agent_name)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_knowledge_type ON knowledge_entries(knowledge_type)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_knowledge_domain ON knowledge_entries(domain)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_knowledge_project ON knowledge_entries(project_id)')
            
            # Create agent_reputation table
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS agent_reputation (
                    agent_name TEXT PRIMARY KEY,
                    tasks_completed INTEGER DEFAULT 0,
                    tasks_failed INTEGER DEFAULT 0,
                    total_execution_time REAL DEFAULT 0.0,
                    average_execution_time REAL DEFAULT 0.0,
                    success_rate REAL DEFAULT 0.0,
                    last_updated TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Create index for sorting by performance
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_reputation_success ON agent_reputation(success_rate DESC)')
            cursor.execute('CREATE INDEX IF NOT EXISTS idx_reputation_completed ON agent_reputation(tasks_completed DESC)')
        
        self._initialized = True
        self.logger.info(f"Database initialized at {self.db_path}")
    
    def check_tables_exist(self) -> Dict[str, bool]:
        """Check if required tables exist."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            tables = {row['name'] for row in cursor.fetchall()}
            
            return {
                'knowledge_entries': 'knowledge_entries' in tables,
                'agent_reputation': 'agent_reputation' in tables
            }
    
    # --- Knowledge Entry Methods ---
    
    def insert_knowledge(self, entry: KnowledgeEntry) -> str:
        """Insert a new knowledge entry."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO knowledge_entries 
                (id, agent_name, knowledge_type, domain, content, embedding, project_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                entry.id,
                entry.agent_name,
                entry.knowledge_type,
                entry.domain,
                entry.content,
                entry.embedding,
                entry.project_id,
                entry.created_at or datetime.utcnow().isoformat()
            ))
            return entry.id
    
    def get_knowledge_by_id(self, knowledge_id: str) -> Optional[KnowledgeEntry]:
        """Get a knowledge entry by ID."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM knowledge_entries WHERE id = ?', (knowledge_id,))
            row = cursor.fetchone()
            return KnowledgeEntry.from_row(row) if row else None
    
    def get_knowledge_by_type(self, knowledge_type: str, limit: int = 10) -> List[KnowledgeEntry]:
        """Get knowledge entries by type."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT * FROM knowledge_entries WHERE knowledge_type = ? ORDER BY created_at DESC LIMIT ?',
                (knowledge_type, limit)
            )
            return [KnowledgeEntry.from_row(row) for row in cursor.fetchall()]
    
    def get_knowledge_by_domain(self, domain: str, limit: int = 10) -> List[KnowledgeEntry]:
        """Get knowledge entries by domain."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT * FROM knowledge_entries WHERE domain = ? ORDER BY created_at DESC LIMIT ?',
                (domain, limit)
            )
            return [KnowledgeEntry.from_row(row) for row in cursor.fetchall()]
    
    def get_all_knowledge(self, limit: int = 100) -> List[KnowledgeEntry]:
        """Get all knowledge entries."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT * FROM knowledge_entries ORDER BY created_at DESC LIMIT ?',
                (limit,)
            )
            return [KnowledgeEntry.from_row(row) for row in cursor.fetchall()]
    
    def get_knowledge_with_embeddings(self) -> List[KnowledgeEntry]:
        """Get all knowledge entries that have embeddings."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'SELECT * FROM knowledge_entries WHERE embedding IS NOT NULL'
            )
            return [KnowledgeEntry.from_row(row) for row in cursor.fetchall()]
    
    def update_knowledge_embedding(self, knowledge_id: str, embedding: str):
        """Update the embedding for a knowledge entry."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                'UPDATE knowledge_entries SET embedding = ? WHERE id = ?',
                (embedding, knowledge_id)
            )
    
    def delete_knowledge(self, knowledge_id: str):
        """Delete a knowledge entry."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('DELETE FROM knowledge_entries WHERE id = ?', (knowledge_id,))
    
    def count_knowledge(self) -> int:
        """Count total knowledge entries."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) as cnt FROM knowledge_entries')
            return cursor.fetchone()['cnt']
    
    # --- Agent Reputation Methods ---
    
    def get_reputation(self, agent_name: str) -> Optional[AgentReputation]:
        """Get reputation for an agent."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM agent_reputation WHERE agent_name = ?', (agent_name,))
            row = cursor.fetchone()
            return AgentReputation.from_row(row) if row else None
    
    def get_all_reputations(self) -> List[AgentReputation]:
        """Get all agent reputations, sorted by success rate."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM agent_reputation ORDER BY success_rate DESC, tasks_completed DESC')
            return [AgentReputation.from_row(row) for row in cursor.fetchall()]
    
    def upsert_reputation(self, reputation: AgentReputation):
        """Insert or update agent reputation."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO agent_reputation 
                (agent_name, tasks_completed, tasks_failed, total_execution_time, 
                 average_execution_time, success_rate, last_updated)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(agent_name) DO UPDATE SET
                    tasks_completed = excluded.tasks_completed,
                    tasks_failed = excluded.tasks_failed,
                    total_execution_time = excluded.total_execution_time,
                    average_execution_time = excluded.average_execution_time,
                    success_rate = excluded.success_rate,
                    last_updated = excluded.last_updated
            ''', (
                reputation.agent_name,
                reputation.tasks_completed,
                reputation.tasks_failed,
                reputation.total_execution_time,
                reputation.average_execution_time,
                reputation.success_rate,
                reputation.last_updated or datetime.utcnow().isoformat()
            ))
    
    def get_top_performers(self, limit: int = 10) -> List[AgentReputation]:
        """Get top performing agents by success rate."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT * FROM agent_reputation 
                WHERE tasks_completed >= 3
                ORDER BY success_rate DESC, tasks_completed DESC
                LIMIT ?
            ''', (limit,))
            return [AgentReputation.from_row(row) for row in cursor.fetchall()]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get overall database statistics."""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # Knowledge stats
            cursor.execute('SELECT COUNT(*) as cnt FROM knowledge_entries')
            knowledge_count = cursor.fetchone()['cnt']
            
            cursor.execute('SELECT COUNT(DISTINCT domain) as cnt FROM knowledge_entries')
            domain_count = cursor.fetchone()['cnt']
            
            # Reputation stats
            cursor.execute('SELECT COUNT(*) as cnt FROM agent_reputation')
            agent_count = cursor.fetchone()['cnt']
            
            cursor.execute('SELECT SUM(tasks_completed) as total FROM agent_reputation')
            total_tasks = cursor.fetchone()['total'] or 0
            
            cursor.execute('SELECT AVG(success_rate) as avg FROM agent_reputation WHERE tasks_completed > 0')
            avg_success = cursor.fetchone()['avg'] or 0.0
            
            return {
                'knowledge_entries': knowledge_count,
                'knowledge_domains': domain_count,
                'tracked_agents': agent_count,
                'total_tasks_completed': total_tasks,
                'average_success_rate': round(avg_success, 2)
            }


# Singleton instance
_db_manager: Optional[DatabaseManager] = None


def get_database() -> DatabaseManager:
    """Get the singleton database manager instance."""
    global _db_manager
    if _db_manager is None:
        _db_manager = DatabaseManager()
        _db_manager.initialize()
    return _db_manager


def initialize_database():
    """Initialize the database (create tables if needed)."""
    db = get_database()
    db.initialize()
    return db.check_tables_exist()
