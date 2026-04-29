"""Knowledge Capture - Extract and store reusable knowledge from task outputs.

Analyzes completed task outputs to extract:
- Landing page patterns
- Pricing strategies
- Architecture patterns
- Marketing strategies
- Coding patterns
- Sales approaches
- Design patterns
- Workflow processes

Knowledge is stored with embeddings for semantic search.
"""

import os
import re
import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple

from .logger import get_logger
from .database import get_database, KnowledgeEntry
from .embeddings import get_embedding_system


# Knowledge type patterns and their domains
KNOWLEDGE_PATTERNS = {
    'landing_page_pattern': {
        'domain': 'marketing',
        'keywords': ['landing page', 'hero section', 'cta', 'call to action', 'headline',
                    'above the fold', 'conversion', 'testimonial', 'social proof'],
        'output_indicators': ['html', 'jsx', 'component', 'section', 'layout']
    },
    'pricing_strategy': {
        'domain': 'product',
        'keywords': ['pricing', 'tier', 'plan', 'subscription', 'freemium', 'enterprise',
                    'monthly', 'annual', 'discount', 'value proposition'],
        'output_indicators': ['price', 'plan', 'features', 'tier', '$']
    },
    'architecture_pattern': {
        'domain': 'engineering',
        'keywords': ['architecture', 'microservice', 'api', 'database', 'schema',
                    'infrastructure', 'scalability', 'deployment', 'docker', 'kubernetes'],
        'output_indicators': ['service', 'endpoint', 'model', 'schema', 'config']
    },
    'marketing_strategy': {
        'domain': 'marketing',
        'keywords': ['campaign', 'target audience', 'persona', 'channel', 'content',
                    'social media', 'email', 'seo', 'brand', 'messaging'],
        'output_indicators': ['strategy', 'audience', 'campaign', 'content', 'channel']
    },
    'coding_pattern': {
        'domain': 'engineering',
        'keywords': ['function', 'class', 'module', 'algorithm', 'pattern',
                    'implementation', 'refactor', 'optimization', 'test'],
        'output_indicators': ['def ', 'class ', 'function', 'const ', 'let ', 'import']
    },
    'sales_approach': {
        'domain': 'sales',
        'keywords': ['sales', 'pitch', 'objection', 'lead', 'prospect', 'demo',
                    'qualification', 'close', 'pipeline', 'crm'],
        'output_indicators': ['script', 'email', 'follow-up', 'proposal']
    },
    'design_pattern': {
        'domain': 'design',
        'keywords': ['design', 'ui', 'ux', 'wireframe', 'mockup', 'prototype',
                    'color', 'typography', 'layout', 'responsive'],
        'output_indicators': ['figma', 'style', 'component', 'theme', 'css']
    },
    'workflow_process': {
        'domain': 'operations',
        'keywords': ['workflow', 'process', 'automation', 'pipeline', 'checklist',
                    'procedure', 'sop', 'integration', 'trigger'],
        'output_indicators': ['step', 'stage', 'workflow', 'trigger', 'action']
    }
}

# Minimum content length for knowledge extraction
MIN_CONTENT_LENGTH = 100


class KnowledgeCapture:
    """Extract and store reusable knowledge from task outputs."""
    
    def __init__(self):
        self.logger = get_logger()
        self.db = get_database()
        self.embeddings = get_embedding_system()
        self.knowledge_dir = Path(os.getenv(
            'MC_KNOWLEDGE_DIR',
            os.path.join(os.path.dirname(__file__), '..', 'knowledge')
        ))
    
    def analyze_output(self, output: Any) -> List[Tuple[str, str, float]]:
        """Analyze task output to detect knowledge types.
        
        Args:
            output: The task output (string, dict, or list)
        
        Returns:
            List of (knowledge_type, domain, confidence) tuples
        """
        # Convert output to text
        if isinstance(output, dict):
            text = json.dumps(output, indent=2)
        elif isinstance(output, list):
            text = '\n'.join(str(item) for item in output)
        else:
            text = str(output)
        
        text_lower = text.lower()
        detected = []
        
        for knowledge_type, config in KNOWLEDGE_PATTERNS.items():
            # Count keyword matches
            keyword_matches = sum(
                1 for kw in config['keywords']
                if kw in text_lower
            )
            
            # Count output indicator matches
            indicator_matches = sum(
                1 for ind in config['output_indicators']
                if ind in text_lower
            )
            
            # Calculate confidence score
            total_keywords = len(config['keywords'])
            total_indicators = len(config['output_indicators'])
            
            keyword_score = keyword_matches / total_keywords if total_keywords > 0 else 0
            indicator_score = indicator_matches / total_indicators if total_indicators > 0 else 0
            
            # Combined confidence (weighted)
            confidence = 0.6 * keyword_score + 0.4 * indicator_score
            
            if confidence >= 0.3:  # Threshold
                detected.append((knowledge_type, config['domain'], confidence))
        
        # Sort by confidence
        detected.sort(key=lambda x: x[2], reverse=True)
        return detected
    
    def extract_insights(self, output: Any, knowledge_type: str) -> List[str]:
        """Extract specific insights from output based on knowledge type.
        
        Args:
            output: The task output
            knowledge_type: Type of knowledge to extract
        
        Returns:
            List of extracted insight strings
        """
        if isinstance(output, dict):
            text = json.dumps(output, indent=2)
        elif isinstance(output, list):
            text = '\n'.join(str(item) for item in output)
        else:
            text = str(output)
        
        insights = []
        
        # Split into meaningful chunks
        # Look for sections, code blocks, or structured data
        
        # Extract code blocks
        code_blocks = re.findall(r'```[\w]*\n([\s\S]*?)```', text)
        for block in code_blocks:
            if len(block.strip()) >= MIN_CONTENT_LENGTH:
                insights.append(block.strip())
        
        # Extract JSON objects
        json_matches = re.findall(r'\{[\s\S]*?\}', text)
        for match in json_matches:
            try:
                obj = json.loads(match)
                if len(json.dumps(obj)) >= MIN_CONTENT_LENGTH:
                    insights.append(json.dumps(obj, indent=2))
            except json.JSONDecodeError:
                pass
        
        # If no structured content found, use the full output
        if not insights and len(text) >= MIN_CONTENT_LENGTH:
            # Truncate to reasonable size
            insights.append(text[:5000])
        
        return insights[:3]  # Max 3 insights per output
    
    def store_knowledge(
        self,
        agent_name: str,
        content: str,
        knowledge_type: str,
        domain: str,
        project_id: Optional[str] = None
    ) -> Optional[KnowledgeEntry]:
        """Store a knowledge entry in the database.
        
        Args:
            agent_name: Name of the agent that produced this knowledge
            content: The knowledge content
            knowledge_type: Type of knowledge
            domain: Domain category
            project_id: Optional project identifier
        
        Returns:
            The created KnowledgeEntry or None on failure
        """
        try:
            # Generate embedding
            embedding = self.embeddings.generate_embedding(content)
            embedding_json = self.embeddings.embedding_to_json(embedding)
            
            # Create entry
            entry = KnowledgeEntry(
                id=str(uuid.uuid4()),
                agent_name=agent_name,
                knowledge_type=knowledge_type,
                domain=domain,
                content=content,
                embedding=embedding_json,
                project_id=project_id,
                created_at=datetime.utcnow().isoformat()
            )
            
            # Store in database
            self.db.insert_knowledge(entry)
            
            # Also save to markdown file
            self._save_to_markdown(entry)
            
            self.logger.info(
                f"Stored knowledge: {knowledge_type} from {agent_name}",
                extra={'knowledge_id': entry.id, 'domain': domain}
            )
            
            return entry
            
        except Exception as e:
            self.logger.error(f"Failed to store knowledge: {e}")
            return None
    
    def _save_to_markdown(self, entry: KnowledgeEntry):
        """Save knowledge entry as markdown file."""
        try:
            # Create domain directory
            domain_dir = self.knowledge_dir / entry.domain
            domain_dir.mkdir(parents=True, exist_ok=True)
            
            # Create markdown file
            filename = f"{entry.knowledge_type}_{entry.id[:8]}.md"
            filepath = domain_dir / filename
            
            content = f"""# {entry.knowledge_type.replace('_', ' ').title()}

**Agent:** {entry.agent_name}  
**Domain:** {entry.domain}  
**Created:** {entry.created_at}  
{f'**Project:** {entry.project_id}' if entry.project_id else ''}

---

{entry.content}
"""
            filepath.write_text(content)
            
        except Exception as e:
            self.logger.warning(f"Failed to save knowledge markdown: {e}")
    
    def capture_from_task(
        self,
        agent_name: str,
        task_output: Any,
        project_id: Optional[str] = None
    ) -> List[KnowledgeEntry]:
        """Main function to capture knowledge from a task output.
        
        Args:
            agent_name: Name of the agent that completed the task
            task_output: The output from the task
            project_id: Optional project identifier
        
        Returns:
            List of created KnowledgeEntry objects
        """
        entries = []
        
        # Analyze output for knowledge types
        detected = self.analyze_output(task_output)
        
        if not detected:
            self.logger.debug(f"No knowledge patterns detected in output from {agent_name}")
            return entries
        
        # Process top 2 most confident matches
        for knowledge_type, domain, confidence in detected[:2]:
            # Extract insights
            insights = self.extract_insights(task_output, knowledge_type)
            
            for insight in insights:
                entry = self.store_knowledge(
                    agent_name=agent_name,
                    content=insight,
                    knowledge_type=knowledge_type,
                    domain=domain,
                    project_id=project_id
                )
                if entry:
                    entries.append(entry)
        
        return entries


# Singleton instance
_knowledge_capture: Optional[KnowledgeCapture] = None


def get_knowledge_capture() -> KnowledgeCapture:
    """Get the singleton knowledge capture instance."""
    global _knowledge_capture
    if _knowledge_capture is None:
        _knowledge_capture = KnowledgeCapture()
    return _knowledge_capture


def store_agent_knowledge(
    agent_name: str,
    task_output: Any,
    project_id: Optional[str] = None
) -> List[KnowledgeEntry]:
    """Convenience function to capture knowledge from task output.
    
    Call this after successful task completion to extract and store
    reusable knowledge.
    
    Args:
        agent_name: Name of the agent that completed the task
        task_output: The output from the task
        project_id: Optional project identifier
    
    Returns:
        List of created KnowledgeEntry objects
    """
    return get_knowledge_capture().capture_from_task(
        agent_name=agent_name,
        task_output=task_output,
        project_id=project_id
    )
