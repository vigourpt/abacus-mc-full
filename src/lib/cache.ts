// =====================================================
// Caching Layer - In-Memory Cache with TTL
// =====================================================

import { createChildLogger } from './logger';

const logger = createChildLogger('cache');

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
  createdAt: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
}

class InMemoryCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private stats: CacheStats = { hits: 0, misses: 0, sets: 0, deletes: 0, evictions: 0 };
  private maxSize: number;
  private defaultTTL: number;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(options: { maxSize?: number; defaultTTL?: number; cleanupIntervalMs?: number } = {}) {
    this.maxSize = options.maxSize || 1000;
    this.defaultTTL = options.defaultTTL || 60000; // 1 minute default

    // Start cleanup interval
    const cleanupMs = options.cleanupIntervalMs || 30000;
    this.cleanupInterval = setInterval(() => this.cleanup(), cleanupMs);

    logger.info({ maxSize: this.maxSize, defaultTTL: this.defaultTTL }, 'Cache initialized');
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      return null;
    }

    this.stats.hits++;
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs?: number): void {
    // Evict oldest entries if at max size
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      expiresAt: now + (ttlMs || this.defaultTTL),
      createdAt: now,
    });

    this.stats.sets++;
  }

  delete(key: string): boolean {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.stats.deletes++;
    }
    return deleted;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  clear(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  // Invalidate all keys matching a pattern
  invalidatePattern(pattern: string | RegExp): number {
    const regex = typeof pattern === 'string' ? new RegExp(pattern) : pattern;
    let count = 0;

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        count++;
      }
    }

    logger.debug({ pattern: pattern.toString(), count }, 'Pattern invalidation');
    return count;
  }

  // Get or set with factory function
  async getOrSet<T>(key: string, factory: () => Promise<T> | T, ttlMs?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await factory();
    this.set(key, value, ttlMs);
    return value;
  }

  // Bulk operations
  mget<T>(keys: string[]): Map<string, T | null> {
    const results = new Map<string, T | null>();
    for (const key of keys) {
      results.set(key, this.get<T>(key));
    }
    return results;
  }

  mset<T>(entries: Array<{ key: string; value: T; ttlMs?: number }>): void {
    for (const entry of entries) {
      this.set(entry.key, entry.value, entry.ttlMs);
    }
  }

  // Stats and monitoring
  getStats(): CacheStats & { size: number; hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: total > 0 ? (this.stats.hits / total) * 100 : 0,
    };
  }

  resetStats(): void {
    this.stats = { hits: 0, misses: 0, sets: 0, deletes: 0, evictions: 0 };
  }

  // Memory estimation
  getMemoryUsage(): { entries: number; estimatedBytes: number } {
    let estimatedBytes = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Rough estimate: key length + JSON stringify of value
      estimatedBytes += key.length * 2; // UTF-16
      try {
        estimatedBytes += JSON.stringify(entry.value).length * 2;
      } catch {
        estimatedBytes += 1000; // Default estimate for non-serializable
      }
    }

    return {
      entries: this.cache.size,
      estimatedBytes,
    };
  }

  // Internal cleanup
  private cleanup(): void {
    const now = Date.now();
    let evicted = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        evicted++;
      }
    }

    if (evicted > 0) {
      this.stats.evictions += evicted;
      logger.debug({ evicted }, 'Cache cleanup');
    }
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  // Destroy cache and cleanup
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    logger.info('Cache destroyed');
  }
}

// Specialized cache instances
export const cache = new InMemoryCache({
  maxSize: 500,
  defaultTTL: 60000, // 1 minute
  cleanupIntervalMs: 30000,
});

export const agentCache = new InMemoryCache({
  maxSize: 200,
  defaultTTL: 120000, // 2 minutes
  cleanupIntervalMs: 60000,
});

export const taskCache = new InMemoryCache({
  maxSize: 300,
  defaultTTL: 30000, // 30 seconds
  cleanupIntervalMs: 15000,
});

export const apiCache = new InMemoryCache({
  maxSize: 100,
  defaultTTL: 10000, // 10 seconds
  cleanupIntervalMs: 5000,
});

// Cache invalidation helpers
export function invalidateAgentCaches(agentId?: string): void {
  if (agentId) {
    cache.invalidatePattern(`agent_.*${agentId}`);
    agentCache.delete(`agent_${agentId}`);
  } else {
    cache.invalidatePattern('agent_');
    agentCache.clear();
  }
  cache.invalidatePattern('realtime_stats');
  cache.invalidatePattern('system_health');
}

export function invalidateTaskCaches(taskId?: string): void {
  if (taskId) {
    cache.invalidatePattern(`task_.*${taskId}`);
    taskCache.delete(`task_${taskId}`);
  } else {
    cache.invalidatePattern('task_');
    taskCache.clear();
  }
  cache.invalidatePattern('realtime_stats');
  cache.invalidatePattern('system_health');
}

export function invalidateAllCaches(): void {
  cache.clear();
  agentCache.clear();
  taskCache.clear();
  apiCache.clear();
  logger.info('All caches invalidated');
}

// Export class for custom instances
export { InMemoryCache };
