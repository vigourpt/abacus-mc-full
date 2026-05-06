// Database layer using @libsql/client
// Uses libsql:// URL which uses the native libsql wire protocol over HTTP
import { createClient, type Client, type ResultSet } from '@libsql/client';
import { logger } from './logger';

const DATABASE_URL = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || '';
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

// Detect if we're using a local file (sync) vs remote (async)
// Remote: libsql://, turso://, or ws:// (Turso can use WebSocket URLs)
const isRemote = DATABASE_URL.startsWith('libsql://') || DATABASE_URL.startsWith('turso://') || DATABASE_URL.startsWith('ws://') || DATABASE_URL.startsWith('wss://');
const isLocal = !isRemote;

let _client: Client | null = null;

function getClient(): Client {
  if (_client !== null) return _client;
  _client = createClient({
    url: DATABASE_URL || 'file:local.db',
    authToken: AUTH_TOKEN || undefined,
  });
  logger.info({ url: DATABASE_URL.substring(0, 50), isLocal }, 'Database client initialized');
  return _client;
}

// Transform libsql ResultSet to better-sqlite3-like format
function resultSetToRows<T = any>(result: ResultSet): T[] {
  if (!result.rows || result.rows.length === 0) return [] as T[];
  return result.rows.map(row => {
    const obj: any = {};
    result.columns.forEach((col, idx) => { obj[col] = row[idx]; });
    return obj as T;
  });
}

function createStatement(sql: string) {
  if (isLocal) {
    // Local SQLite: synchronous execution
    return {
      all: (...params: any[]) => {
        try {
          const result = getClient().execute({ sql, args: params.length > 0 ? params : undefined });
          return resultSetToRows(result);
        } catch (err) {
          logger.error({ err, sql }, 'db.all() error');
          return [];
        }
      },
      get: (...params: any[]) => {
        try {
          const result = getClient().execute({ sql, args: params.length > 0 ? params : undefined });
          return resultSetToRows(result)[0] || undefined;
        } catch (err) {
          logger.error({ err, sql }, 'db.get() error');
          return undefined;
        }
      },
      run: (...params: any[]) => {
        try {
          const result = getClient().execute({ sql, args: params.length > 0 ? params : undefined });
          return {
            changes: result.rowsAffected || 0,
            lastInsertRowid: result.lastInsertRowid || 0,
          };
        } catch (err) {
          logger.error({ err, sql }, 'db.run() error');
          return { changes: 0, lastInsertRowid: 0 };
        }
      },
    };
  } else {
    // Remote Turso: asynchronous execution
    return {
      all: async (...params: any[]) => {
        try {
          const result = await getClient().execute({ sql, args: params.length > 0 ? params : undefined });
          return resultSetToRows(result);
        } catch (err) {
          logger.error({ err, sql }, 'db.all() error');
          return [];
        }
      },
      get: async (...params: any[]) => {
        try {
          const result = await getClient().execute({ sql, args: params.length > 0 ? params : undefined });
          return resultSetToRows(result)[0] || undefined;
        } catch (err) {
          logger.error({ err, sql }, 'db.get() error');
          return undefined;
        }
      },
      run: async (...params: any[]) => {
        try {
          const result = await getClient().execute({ sql, args: params.length > 0 ? params : undefined });
          return {
            changes: result.rowsAffected || 0,
            lastInsertRowid: result.lastInsertRowid || 0,
          };
        } catch (err) {
          logger.error({ err, sql }, 'db.run() error');
          return { changes: 0, lastInsertRowid: 0 };
        }
      },
    };
  }
}

const db = new Proxy({} as any, {
  get(_target, prop) {
    if (prop === 'exec') {
      if (isLocal) {
        return (sql: string) => {
          const statements = sql.split(';').filter(s => s.trim());
          for (const stmt of statements) {
            if (stmt.trim()) {
              try {
                getClient().execute({ sql: stmt.trim(), args: undefined });
              } catch (err) {
                // Ignore errors for multi-statement exec
              }
            }
          }
        };
      } else {
        return async (sql: string) => {
          const statements = sql.split(';').filter(s => s.trim());
          for (const stmt of statements) {
            if (stmt.trim()) {
              try {
                await getClient().execute({ sql: stmt.trim(), args: undefined });
              } catch (err) {
                // Ignore errors for multi-statement exec
              }
            }
          }
        };
      }
    }
    if (prop === 'pragma') {
      return isLocal
        ? (pragma: string) => {
            try {
              const result = getClient().execute({ sql: `PRAGMA ${pragma}`, args: undefined });
              return resultSetToRows(result);
            } catch (err) {
              logger.error({ err }, 'db.pragma() error');
              return [];
            }
          }
        : async (pragma: string) => {
            try {
              const result = await getClient().execute({ sql: `PRAGMA ${pragma}`, args: undefined });
              return resultSetToRows(result);
            } catch (err) {
              logger.error({ err }, 'db.pragma() error');
              return [];
            }
          };
    }
    if (prop === 'prepare') {
      return createStatement;
    }
    return (getClient() as any)[prop];
  },
});

export { db, getClient };
export default db;

// Helper to run migrations
export async function runMigrations() {
  const migrations = [
    `CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL, emoji TEXT DEFAULT '🤖', color TEXT DEFAULT 'blue',
      division TEXT NOT NULL, specialization TEXT, source TEXT DEFAULT 'local',
      source_url TEXT, status TEXT DEFAULT 'idle',
      capabilities TEXT DEFAULT '[]', technical_skills TEXT DEFAULT '[]',
      personality_traits TEXT DEFAULT '[]', system_prompt TEXT NOT NULL,
      workspace_path TEXT, model_config TEXT DEFAULT '{"primary":"claude-3-opus","fallbacks":[]}',
      metrics TEXT DEFAULT '{"tasksCompleted":0,"successRate":0,"avgResponseTime":0}',
      dependencies TEXT DEFAULT '[]', collaboration_style TEXT, last_heartbeat TEXT,
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP), updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
    )`,
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
      status TEXT DEFAULT 'inbox', priority TEXT DEFAULT 'medium',
      assigned_to TEXT, created_by TEXT, parent_task_id TEXT,
      subtasks TEXT DEFAULT '[]', dependencies TEXT DEFAULT '[]',
      context TEXT DEFAULT '{}', expected_output TEXT, actual_output TEXT,
      quality_score REAL, estimated_hours REAL, actual_hours REAL,
      tags TEXT DEFAULT '[]', due_date TEXT, started_at TEXT, completed_at TEXT,
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP), updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
    )`,
    `CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY, agent_id TEXT, action TEXT NOT NULL,
      details TEXT, metadata TEXT, created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
    )`,
    `CREATE TABLE IF NOT EXISTS gateway_connections (
      id TEXT PRIMARY KEY, name TEXT, url TEXT,
      status TEXT DEFAULT 'disconnected', last_seen TEXT,
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
    )`,
    `CREATE TABLE IF NOT EXISTS agent_messages (
      id TEXT PRIMARY KEY, agent_id TEXT, direction TEXT NOT NULL,
      content TEXT, created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
    )`,
  ];

  for (const sql of migrations) {
    try {
      await getClient().execute({ sql, args: undefined });
    } catch (err) {
      // Ignore "already exists" errors
    }
  }
  logger.info('Migrations completed');
}
