// =====================================================
// Database Optimization - Indexes, Maintenance & Caching
// =====================================================

import db from './db';
import { createChildLogger } from './logger';
import { cache } from './cache';

const logger = createChildLogger('db-optimizer');

// Query result caching wrapper
export function cachedQuery<T>(
  key: string,
  query: () => T,
  ttlMs: number = 30000
): T {
  const cached = cache.get<T>(key);
  if (cached !== null) {
    return cached;
  }

  const result = query();
  cache.set(key, result, ttlMs);
  return result;
}

// Optimized agent queries
export const agentQueries = {
  getAll: () => cachedQuery('agents_all', () =>
    db.prepare(`
      SELECT * FROM agents ORDER BY division, name
    `).all(),
    60000
  ),

  getByDivision: (division: string) => cachedQuery(`agents_div_${division}`, () =>
    db.prepare(`
      SELECT * FROM agents WHERE division = ? ORDER BY name
    `).all(division),
    60000
  ),

  getActive: () => cachedQuery('agents_active', () =>
    db.prepare(`
      SELECT * FROM agents WHERE status = 'active' ORDER BY name
    `).all(),
    30000
  ),

  getWithWorkload: () => cachedQuery('agents_workload', () =>
    db.prepare(`
      SELECT 
        a.*,
        COUNT(t.id) as active_tasks,
        SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress_count
      FROM agents a
      LEFT JOIN tasks t ON t.assigned_to = a.id AND t.status IN ('todo', 'in_progress')
      GROUP BY a.id
      ORDER BY active_tasks DESC
    `).all(),
    30000
  ),

  search: (term: string) => {
    const pattern = `%${term}%`;
    return db.prepare(`
      SELECT * FROM agents
      WHERE name LIKE ? OR description LIKE ? OR specialization LIKE ?
      ORDER BY name
      LIMIT 50
    `).all(pattern, pattern, pattern);
  },
};

// Optimized task queries
export const taskQueries = {
  getAll: () => cachedQuery('tasks_all', () =>
    db.prepare(`
      SELECT * FROM tasks ORDER BY 
        CASE priority 
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        created_at DESC
    `).all(),
    30000
  ),

  getByStatus: (status: string) => cachedQuery(`tasks_status_${status}`, () =>
    db.prepare(`
      SELECT * FROM tasks WHERE status = ? ORDER BY priority, created_at DESC
    `).all(status),
    15000
  ),

  getByAgent: (agentId: string) =>
    db.prepare(`
      SELECT * FROM tasks WHERE assigned_to = ? ORDER BY status, priority, created_at DESC
    `).all(agentId),

  getPriority: () => cachedQuery('tasks_priority', () =>
    db.prepare(`
      SELECT * FROM tasks
      WHERE status IN ('inbox', 'backlog', 'todo')
      ORDER BY 
        CASE priority 
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END,
        created_at ASC
      LIMIT 100
    `).all(),
    15000
  ),

  getReady: () => cachedQuery('tasks_ready', () =>
    db.prepare(`
      SELECT t.* FROM tasks t
      WHERE t.status = 'todo'
      AND NOT EXISTS (
        SELECT 1 FROM task_dependencies td
        JOIN tasks dep ON dep.id = td.depends_on_task_id
        WHERE td.task_id = t.id AND dep.status != 'done'
      )
      ORDER BY 
        CASE t.priority 
          WHEN 'critical' THEN 1
          WHEN 'high' THEN 2
          WHEN 'medium' THEN 3
          WHEN 'low' THEN 4
        END
    `).all(),
    15000
  ),
};

// Database maintenance utilities
export const dbMaintenance = {
  // Run WAL checkpoint
  checkpoint: () => {
    try {
      const result = db.pragma('wal_checkpoint(TRUNCATE)');
      logger.info({ result }, 'WAL checkpoint completed');
      return result;
    } catch (error) {
      logger.error({ error }, 'WAL checkpoint failed');
      throw error;
    }
  },

  // Run VACUUM to reclaim space
  vacuum: () => {
    try {
      db.exec('VACUUM');
      logger.info('Database vacuum completed');
      return true;
    } catch (error) {
      logger.error({ error }, 'Database vacuum failed');
      throw error;
    }
  },

  // Analyze tables for query optimization
  analyze: () => {
    try {
      db.exec('ANALYZE');
      logger.info('Database analysis completed');
      return true;
    } catch (error) {
      logger.error({ error }, 'Database analysis failed');
      throw error;
    }
  },

  // Integrity check
  integrityCheck: () => {
    try {
      const result = db.pragma('integrity_check');
      const isOk = Array.isArray(result) && result[0]?.integrity_check === 'ok';
      logger.info({ result, isOk }, 'Integrity check completed');
      return { result, isOk };
    } catch (error) {
      logger.error({ error }, 'Integrity check failed');
      throw error;
    }
  },

  // Get database statistics
  getStats: () => {
    try {
      const pageCountResult = db.pragma('page_count') as { page_count: number }[];
      const pageSizeResult = db.pragma('page_size') as { page_size: number }[];
      const walPages = db.pragma('wal_checkpoint(PASSIVE)');
      const freelistResult = db.pragma('freelist_count') as { freelist_count: number }[];

      const pageCount = pageCountResult[0]?.page_count || 0;
      const pageSize = pageSizeResult[0]?.page_size || 0;
      const freelistCount = freelistResult[0]?.freelist_count || 0;

      const tables = db.prepare(`
        SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'
      `).all() as { name: string }[];

      const tableCounts: Record<string, number> = {};
      for (const table of tables) {
        const result = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get() as { count: number };
        tableCounts[table.name] = result.count;
      }

      return {
        sizeBytes: pageCount * pageSize,
        sizeMB: Math.round((pageCount * pageSize) / 1024 / 1024 * 100) / 100,
        pageCount,
        pageSize,
        freelistCount,
        walPages,
        tables: tableCounts,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to get database stats');
      throw error;
    }
  },

  // Run full optimization
  optimize: () => {
    logger.info('Starting database optimization');
    const results = {
      checkpoint: null as any,
      analyze: false,
      vacuum: false,
      integrity: null as any,
    };

    try {
      results.checkpoint = dbMaintenance.checkpoint();
      results.analyze = dbMaintenance.analyze();
      results.vacuum = dbMaintenance.vacuum();
      results.integrity = dbMaintenance.integrityCheck();

      logger.info({ results }, 'Database optimization completed');
      return results;
    } catch (error) {
      logger.error({ error, results }, 'Database optimization failed');
      throw error;
    }
  },
};

// Additional indexes for common queries (run on startup if needed)
export function ensureIndexes() {
  const indexes = [
    // Composite indexes for common queries
    'CREATE INDEX IF NOT EXISTS idx_tasks_status_priority ON tasks(status, priority)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status ON tasks(assigned_to, status)',
    'CREATE INDEX IF NOT EXISTS idx_agents_division_status ON agents(division, status)',
    'CREATE INDEX IF NOT EXISTS idx_activity_type_created ON activity_log(type, created_at)',
    'CREATE INDEX IF NOT EXISTS idx_messages_read_to ON agent_messages(read, to_agent_id)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)',
    'CREATE INDEX IF NOT EXISTS idx_tasks_completed_at ON tasks(completed_at)',
    'CREATE INDEX IF NOT EXISTS idx_token_usage_agent_created ON token_usage(agent_id, created_at)',
  ];

  for (const sql of indexes) {
    try {
      db.exec(sql);
    } catch (error) {
      // Ignore if already exists
    }
  }

  logger.info('Database indexes ensured');
}

// Run on import
ensureIndexes();
