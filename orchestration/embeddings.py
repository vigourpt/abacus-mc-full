"""Embedding System - Generate and search embeddings for knowledge.

Provides:
- Text embedding generation using available providers
- Semantic similarity search
- Cosine similarity computation

Supported providers (in order of preference):
1. OpenAI (if OPENAI_API_KEY set)
2. Sentence Transformers (local, fallback)
3. Simple TF-IDF (basic fallback)
"""

import os
import json
import math
import hashlib
from typing import Dict, List, Optional, Tuple
from collections import Counter

from .logger import get_logger


class EmbeddingProvider:
    """Base class for embedding providers."""
    
    def generate(self, text: str) -> List[float]:
        raise NotImplementedError
    
    def generate_batch(self, texts: List[str]) -> List[List[float]]:
        return [self.generate(t) for t in texts]


class OpenAIEmbeddings(EmbeddingProvider):
    """OpenAI embedding provider using text-embedding-3-small."""
    
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv('OPENAI_API_KEY')
        self.model = 'text-embedding-3-small'
        self.dimension = 1536
    
    def generate(self, text: str) -> List[float]:
        try:
            import openai
            client = openai.OpenAI(api_key=self.api_key)
            response = client.embeddings.create(
                model=self.model,
                input=text[:8000]  # Truncate to max tokens
            )
            return response.data[0].embedding
        except Exception as e:
            raise RuntimeError(f"OpenAI embedding failed: {e}")
    
    def generate_batch(self, texts: List[str]) -> List[List[float]]:
        try:
            import openai
            client = openai.OpenAI(api_key=self.api_key)
            response = client.embeddings.create(
                model=self.model,
                input=[t[:8000] for t in texts]
            )
            return [d.embedding for d in response.data]
        except Exception as e:
            raise RuntimeError(f"OpenAI batch embedding failed: {e}")


class SimpleTFIDFEmbeddings(EmbeddingProvider):
    """Simple TF-IDF based embeddings (fallback when no external API).
    
    Creates deterministic embeddings based on word frequencies.
    Not as good as neural embeddings but works offline.
    """
    
    def __init__(self, dimension: int = 256):
        self.dimension = dimension
        self.vocab: Dict[str, int] = {}
        self.idf: Dict[str, float] = {}
    
    def _tokenize(self, text: str) -> List[str]:
        """Simple tokenization."""
        import re
        text = text.lower()
        tokens = re.findall(r'\b[a-z]{2,}\b', text)
        return tokens
    
    def _hash_token(self, token: str) -> int:
        """Hash token to dimension index."""
        h = hashlib.md5(token.encode()).hexdigest()
        return int(h, 16) % self.dimension
    
    def generate(self, text: str) -> List[float]:
        """Generate a TF-IDF inspired embedding."""
        tokens = self._tokenize(text)
        if not tokens:
            return [0.0] * self.dimension
        
        # Compute term frequencies
        tf = Counter(tokens)
        max_tf = max(tf.values())
        
        # Create embedding vector
        embedding = [0.0] * self.dimension
        
        for token, count in tf.items():
            idx = self._hash_token(token)
            # Normalized TF
            score = 0.5 + 0.5 * (count / max_tf)
            embedding[idx] += score
        
        # Normalize to unit vector
        magnitude = math.sqrt(sum(x*x for x in embedding))
        if magnitude > 0:
            embedding = [x / magnitude for x in embedding]
        
        return embedding


class EmbeddingSystem:
    """Main embedding system with provider selection and similarity search."""
    
    def __init__(self):
        self.logger = get_logger()
        self.provider = self._select_provider()
        self.logger.info(f"Using embedding provider: {self.provider.__class__.__name__}")
    
    def _select_provider(self) -> EmbeddingProvider:
        """Select the best available embedding provider."""
        # Try OpenAI first
        if os.getenv('OPENAI_API_KEY'):
            try:
                provider = OpenAIEmbeddings()
                # Test with a simple query
                provider.generate("test")
                return provider
            except Exception as e:
                self.logger.warning(f"OpenAI embeddings unavailable: {e}")
        
        # Fall back to simple TF-IDF
        self.logger.info("Using simple TF-IDF embeddings (set OPENAI_API_KEY for better quality)")
        return SimpleTFIDFEmbeddings()
    
    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding for a text."""
        try:
            return self.provider.generate(text)
        except Exception as e:
            self.logger.error(f"Embedding generation failed: {e}")
            # Return zero vector on failure
            return [0.0] * getattr(self.provider, 'dimension', 256)
    
    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate embeddings for multiple texts."""
        try:
            return self.provider.generate_batch(texts)
        except Exception as e:
            self.logger.error(f"Batch embedding failed, falling back to sequential: {e}")
            return [self.generate_embedding(t) for t in texts]
    
    def embedding_to_json(self, embedding: List[float]) -> str:
        """Convert embedding to JSON string for storage."""
        return json.dumps(embedding)
    
    def embedding_from_json(self, json_str: str) -> List[float]:
        """Parse embedding from JSON string."""
        return json.loads(json_str)
    
    @staticmethod
    def cosine_similarity(a: List[float], b: List[float]) -> float:
        """Compute cosine similarity between two vectors."""
        if len(a) != len(b):
            return 0.0
        
        dot_product = sum(x * y for x, y in zip(a, b))
        magnitude_a = math.sqrt(sum(x * x for x in a))
        magnitude_b = math.sqrt(sum(x * x for x in b))
        
        if magnitude_a == 0 or magnitude_b == 0:
            return 0.0
        
        return dot_product / (magnitude_a * magnitude_b)
    
    def search_similar(
        self,
        query_embedding: List[float],
        embeddings: List[Tuple[str, List[float]]],  # [(id, embedding), ...]
        top_k: int = 5
    ) -> List[Tuple[str, float]]:
        """Search for similar embeddings.
        
        Args:
            query_embedding: The query vector
            embeddings: List of (id, embedding) tuples to search
            top_k: Number of results to return
        
        Returns:
            List of (id, similarity_score) tuples, sorted by similarity
        """
        similarities = []
        
        for item_id, item_embedding in embeddings:
            similarity = self.cosine_similarity(query_embedding, item_embedding)
            similarities.append((item_id, similarity))
        
        # Sort by similarity (descending)
        similarities.sort(key=lambda x: x[1], reverse=True)
        
        return similarities[:top_k]


# Singleton instance
_embedding_system: Optional[EmbeddingSystem] = None


def get_embedding_system() -> EmbeddingSystem:
    """Get the singleton embedding system instance."""
    global _embedding_system
    if _embedding_system is None:
        _embedding_system = EmbeddingSystem()
    return _embedding_system


def generate_embedding(text: str) -> List[float]:
    """Convenience function to generate an embedding."""
    return get_embedding_system().generate_embedding(text)


def search_similar_knowledge(
    query_embedding: List[float],
    embeddings: List[Tuple[str, List[float]]],
    top_k: int = 5
) -> List[Tuple[str, float]]:
    """Convenience function for similarity search."""
    return get_embedding_system().search_similar(query_embedding, embeddings, top_k)
