// Database layer using @libsql/client with HTTPS URL conversion
// Netlify serverless: libsql:// uses HTTP which fails; use https:// instead
import { createClient, type Client, type ResultSet } from '@libsql/client';
import { logger } from './logger';

const RAW_URL = process.env.TURSO_DATABASE_URL || '';
const TOKEN_MATCH = RAW_URL.match(/authToken=([^&]+)/);
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || (TOKEN_MATCH ? TOKEN_MATCH[1] : '');
const HTTPS_URL = RAW_URL.replace(/^libsql:\/\//, 'https://').split('?')[0];

let _client: Client | null = null;

function getClient(): Client {
  if (_client !== null) return _client;
  _client = createClient({ url: HTTPS_URL, authToken: AUTH_TOKEN });
  logger.info({ url: HTTPS_URL.substring(0, 50) }, 'Database client initialized');
  return _client;
}

// Transform libsql ResultSet to better-sqlite3-like format
function resultSetToRows<T = any>(result: ResultSet): T[] {
  if (!result.rows || result.rows.length === 0) return [] as T[];
  // libsql returns rows as array of arrays (column-indexed)
  // Convert to array of objects keyed by column names
  return result.rows.map(row => {
    const obj: any = {};
    result.columns.forEach((col, idx) => { obj[col] = row[idx]; });
    return obj as T;
  });
}

// Create a statement-like wrapper that mimics better-sqlite3's prepared statement
function createStatement(sql: string) {
  return {
    all: (...params: any[]) => {
      return getClient().execute({ sql, args: params.length > 0 ? params : undefined })
        .then(result => resultSetToRows(result));
    },
    get: (...params: any[]) => {
      return getClient().execute({ sql, args: params.length > 0 ? params : undefined })
        .then(result => resultSetToRows(result)[0] || undefined);
    },
    run: (...params: any[]) => {
      return getClient().execute({ sql, args: params.length > 0 ? params : undefined })
        .then(result => ({
          changes: result.rowsAffected || 0,
          lastInsertRowid: result.lastInsertRowid || 0,
        }));
    },
  };
}

// Database wrapper that mimics better-sqlite3's API
const db = new Proxy({} as any, {
  get(_target, prop) {
    if (prop === 'exec') {
      return (sql: string) => {
        const statements = sql.split(';').filter(s => s.trim());
        for (const stmt of statements) {
          if (stmt.trim()) getClient().execute({ sql: stmt.trim(), args: undefined });
        }
      };
    }
    if (prop === 'pragma') {
      return (pragma: string) => {
        return getClient().execute({ sql: `PRAGMA ${pragma}`, args: undefined })
          .then(result => resultSetToRows(result));
      };
    }
    if (prop === 'prepare') {
      return createStatement;
    }
    const client = getClient();
    return (client as any)[prop];
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
    await getClient().execute({ sql, args: undefined });
  }
  logger.info('Migrations completed');
}
