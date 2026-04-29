"""Knowledge Retrieval - Retrieve relevant knowledge for task execution.

Provides semantic search over stored knowledge to inject context
into agent execution.

Features:
- Semantic similarity search using embeddings
- Domain and type filtering
- Context formatting for agent injection
"""

import json
from typing import Dict, List, Optional, Tuple, Any

from .logger import get_logger
from .database import get_database, KnowledgeEntry
from .embeddings import get_embedding_system


class KnowledgeRetrieval:
    """Retrieve relevant knowledge for task execution."""
    
    def __init__(self):
        self.logger = get_logger()
        self.db = get_database()
        self.embeddings = get_embedding_system()
    
    def retrieve_relevant(
        self,
        task_description: str,
        top_k: int = 5,
        domain_filter: Optional[str] = None,
        type_filter: Optional[str] = None,
        min_similarity: float = 0.3
    ) -> List[Tuple[KnowledgeEntry, float]]:
        """Retrieve relevant knowledge entries for a task.
        
        Args:
            task_description: Description of the task
            top_k: Maximum number of results
            domain_filter: Optional domain to filter by
            type_filter: Optional knowledge type to filter by
            min_similarity: Minimum similarity threshold
        
        Returns:
            List of (KnowledgeEntry, similarity_score) tuples
        """
        # Generate query embedding
        query_embedding = self.embeddings.generate_embedding(task_description)
        
        # Get all knowledge entries with embeddings
        entries = self.db.get_knowledge_with_embeddings()
        
        if not entries:
            self.logger.debug("No knowledge entries with embeddings found")
            return []
        
        # Apply filters
        if domain_filter:
            entries = [e for e in entries if e.domain == domain_filter]
        if type_filter:
            entries = [e for e in entries if e.knowledge_type == type_filter]
        
        if not entries:
            return []
        
        # Prepare embeddings for search
        embeddings_list = []
        for entry in entries:
            if entry.embedding:
                try:
                    embedding = self.embeddings.embedding_from_json(entry.embedding)
                    embeddings_list.append((entry.id, embedding))
                except json.JSONDecodeError:
                    continue
        
        if not embeddings_list:
            return []
        
        # Search for similar
        similar = self.embeddings.search_similar(
            query_embedding,
            embeddings_list,
            top_k=top_k * 2  # Get more than needed for filtering
        )
        
        # Map back to entries and filter by similarity
        entry_map = {e.id: e for e in entries}
        results = []
        
        for entry_id, similarity in similar:
            if similarity >= min_similarity and entry_id in entry_map:
                results.append((entry_map[entry_id], similarity))
        
        return results[:top_k]
    
    def retrieve_by_keywords(
        self,
        keywords: List[str],
        top_k: int = 5
    ) -> List[KnowledgeEntry]:
        """Retrieve knowledge entries by keyword matching.
        
        Args:
            keywords: List of keywords to search for
            top_k: Maximum number of results
        
        Returns:
            List of matching KnowledgeEntry objects
        """
        all_entries = self.db.get_all_knowledge(limit=500)
        
        # Score entries by keyword matches
        scored = []
        for entry in all_entries:
            content_lower = entry.content.lower()
            matches = sum(1 for kw in keywords if kw.lower() in content_lower)
            if matches > 0:
                scored.append((entry, matches))
        
        # Sort by match count
        scored.sort(key=lambda x: x[1], reverse=True)
        
        return [entry for entry, _ in scored[:top_k]]
    
    def format_context(
        self,
        entries: List[Tuple[KnowledgeEntry, float]],
        max_length: int = 4000
    ) -> str:
        """Format knowledge entries as context for agent injection.
        
        Args:
            entries: List of (KnowledgeEntry, similarity) tuples
            max_length: Maximum character length of output
        
        Returns:
            Formatted context string
        """
        if not entries:
            return ""
        
        parts = ["## Relevant Knowledge from Previous Projects\n"]
        current_length = len(parts[0])
        
        for entry, similarity in entries:
            header = f"\n### {entry.knowledge_type.replace('_', ' ').title()} ({entry.domain})\n"
            header += f"*From: {entry.agent_name} | Relevance: {similarity:.0%}*\n\n"
            
            # Truncate content if needed
            content = entry.content
            available = max_length - current_length - len(header) - 100
            if len(content) > available:
                content = content[:available] + "\n...(truncated)"
            
            section = header + content + "\n"
            
            if current_length + len(section) > max_length:
                break
            
            parts.append(section)
            current_length += len(section)
        
        return "".join(parts)
    
    def get_context_for_task(
        self,
        task_description: str,
        domain_hint: Optional[str] = None,
        max_entries: int = 5
    ) -> Dict[str, Any]:
        """Get context object for task execution.
        
        Args:
            task_description: Description of the task
            domain_hint: Optional domain to prioritize
            max_entries: Maximum number of entries to include
        
        Returns:
            Context dict with 'knowledge' key containing formatted context
        """
        entries = self.retrieve_relevant(
            task_description,
            top_k=max_entries,
            domain_filter=domain_hint
        )
        
        if not entries:
            return {'knowledge': None, 'knowledge_count': 0}
        
        context_text = self.format_context(entries)
        
        return {
            'knowledge': context_text,
            'knowledge_count': len(entries),
            'knowledge_sources': [
                {
                    'type': e.knowledge_type,
                    'domain': e.domain,
                    'agent': e.agent_name,
                    'similarity': s
                }
                for e, s in entries
            ]
        }


# Singleton instance
_knowledge_retrieval: Optional[KnowledgeRetrieval] = None


def get_knowledge_retrieval() -> KnowledgeRetrieval:
    """Get the singleton knowledge retrieval instance."""
    global _knowledge_retrieval
    if _knowledge_retrieval is None:
        _knowledge_retrieval = KnowledgeRetrieval()
    return _knowledge_retrieval


def retrieve_relevant_knowledge(
    task_description: str,
    top_k: int = 5
) -> List[Tuple[KnowledgeEntry, float]]:
    """Convenience function to retrieve relevant knowledge.
    
    Args:
        task_description: Description of the task
        top_k: Maximum number of results
    
    Returns:
        List of (KnowledgeEntry, similarity_score) tuples
    """
    return get_knowledge_retrieval().retrieve_relevant(
        task_description,
        top_k=top_k
    )


def get_knowledge_context(task_description: str) -> Dict[str, Any]:
    """Convenience function to get knowledge context for a task.
    
    Args:
        task_description: Description of the task
    
    Returns:
        Context dict suitable for injection into agent context
    """
    return get_knowledge_retrieval().get_context_for_task(task_description)
