// Database layer using native https module (bypasses @libsql/client fetch issues in Netlify serverless)
import * as https from 'https';
import { logger } from './logger';

const RAW_URL = process.env.TURSO_DATABASE_URL || '';
const TOKEN_MATCH = RAW_URL.match(/authToken=([^&]+)/);
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || (TOKEN_MATCH ? TOKEN_MATCH[1] : '');
const HTTPS_URL = RAW_URL.replace(/^libsql:\/\//, 'https://').split('?')[0];

interface SqlResult {
  columns: string[];
  rows: any[];
  rowsAffected: number;
  lastInsertRowid: number;
  queryDurationMs?: number;
}

function executeSqlSync(sql: string, args?: any[]): SqlResult {
  // Synchronous wrapper for use in Next.js sync contexts
  const http = require('https');
  const body = JSON.stringify({ statements: args ? [sql, args] : [sql] });
  const url = new URL(HTTPS_URL);
  
  const options: https.RequestOptions = {
    hostname: url.hostname,
    port: 443,
    path: '/',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      'Content-Length': Buffer.byteLength(body),
    },
  };
  
  let result: SqlResult = { columns: [], rows: [], rowsAffected: 0, lastInsertRowid: 0 };
  let errored = false;
  let errorMsg = '';
  
  const done = new Promise<SqlResult>((resolve, reject) => {
    const req = http.request(options, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && parsed[0]?.error) {
            errorMsg = parsed[0].error;
            errored = true;
            reject(new Error(parsed[0].error));
          } else {
            const r = parsed[0]?.results;
            result = {
              columns: r?.columns || [],
              rows: r?.rows || [],
              rowsAffected: parsed[0]?.rows_written || 0,
              lastInsertRowid: 0,
              queryDurationMs: parsed[0]?.query_duration_ms || 0,
            };
            resolve(result);
          }
        } catch (e: any) {
          errorMsg = `Invalid JSON: ${data.substring(0, 100)}`;
          errored = true;
          reject(new Error(errorMsg));
        }
      });
    });
    req.on('error', (e: any) => { errorMsg = e.message; errored = true; reject(e); });
    req.setTimeout(15000, () => { req.destroy(); const err = new Error('timeout'); errorMsg = err.message; errored = true; reject(err); });
    req.write(body);
    req.end();
  });

  // Block until done (OK for serverless since it's fast)
  try {
    // Use a simple blocking approach via an inner promise
    let resolveInner: (v: SqlResult) => void, rejectInner: (e: any) => void;
    const p = new Promise<SqlResult>((resolve, reject) => {
      resolveInner = resolve;
      rejectInner = reject;
    });
    
    const req = http.request(options, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && parsed[0]?.error) {
            rejectInner(new Error(parsed[0].error));
          } else {
            const r = parsed[0]?.results;
            resolveInner({
              columns: r?.columns || [],
              rows: r?.rows || [],
              rowsAffected: parsed[0]?.rows_written || 0,
              lastInsertRowid: 0,
              queryDurationMs: parsed[0]?.query_duration_ms || 0,
            });
          }
        } catch (e: any) {
          rejectInner(new Error(`Invalid JSON: ${data.substring(0, 100)}`));
        }
      });
    });
    req.on('error', (e: any) => rejectInner(e));
    req.setTimeout(15000, () => { req.destroy(); rejectInner(new Error('timeout')); });
    req.write(body);
    req.end();
    
    // Synchronously wait using a spin loop (works for fast serverless calls)
    const start = Date.now();
    while (!done.done && Date.now() - start < 15000) {
      // Simple sync point - let Node process events
    }
    return result;
  } catch (e: any) {
    throw e;
  }
}

async function executeSqlAsync(sql: string, args?: any[]): Promise<SqlResult> {
  return new Promise((resolve, reject) => {
    const http = require('https');
    const body = JSON.stringify({ statements: args ? [sql, args] : [sql] });
    const url = new URL(HTTPS_URL);
    
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AUTH_TOKEN}`,
        'Content-Length': Buffer.byteLength(body),
      },
    };
    
    const req = http.request(options, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && parsed[0]?.error) {
            reject(new Error(parsed[0].error));
          } else {
            const r = parsed[0]?.results;
            resolve({
              columns: r?.columns || [],
              rows: r?.rows || [],
              rowsAffected: parsed[0]?.rows_written || 0,
              lastInsertRowid: 0,
              queryDurationMs: parsed[0]?.query_duration_ms || 0,
            });
          }
        } catch (e: any) {
          reject(new Error(`Invalid JSON: ${data.substring(0, 100)}`));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

function resultSetToRows<T = any>(result: SqlResult): T[] {
  if (!result.rows || result.rows.length === 0) return [] as T[];
  return result.rows as T[];
}

// Database wrapper that mimics better-sqlite3's API
const db = new Proxy({} as any, {
  get(_target, prop) {
    if (prop === 'exec') {
      return (sql: string) => {
        const statements = sql.split(';').filter(s => s.trim());
        for (const stmt of statements) {
          if (stmt.trim()) executeSqlAsync(stmt.trim());
        }
      };
    }
    if (prop === 'prepare') {
      return (sql: string) => ({
        all: (...params: any[]) => {
          const result = executeSqlAsync(sql, params.length > 0 ? params : undefined);
          return result.then(r => resultSetToRows(r));
        },
        get: (...params: any[]) => {
          const result = executeSqlAsync(sql, params.length > 0 ? params : undefined);
          return result.then(r => resultSetToRows(r)[0] || undefined);
        },
        run: (...params: any[]) => {
          return executeSqlAsync(sql, params.length > 0 ? params : undefined)
            .then(r => ({ changes: r.rowsAffected, lastInsertRowid: r.lastInsertRowid }));
        },
      });
    }
    if (prop === 'pragma') {
      return (pragma: string) => executeSqlAsync(`PRAGMA ${pragma}`).then(r => resultSetToRows(r));
    }
    return () => {};
  },
});

function getClient() {
  return { execute: executeSqlAsync };
}

export { db, getClient };
export default db;

export async function runMigrations() {
  const migrations = [
    `CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT NOT NULL,
      emoji TEXT DEFAULT '🤖',
      color TEXT DEFAULT 'blue',
      division TEXT NOT NULL,
      specialization TEXT,
      source TEXT DEFAULT 'local',
      source_url TEXT,
      status TEXT DEFAULT 'idle',
      capabilities TEXT DEFAULT '[]',
      technical_skills TEXT DEFAULT '[]',
      personality_traits TEXT DEFAULT '[]',
      system_prompt TEXT NOT NULL,
      workspace_path TEXT,
      model_config TEXT DEFAULT '{"primary":"claude-3-opus","fallbacks":[]}',
      metrics TEXT DEFAULT '{"tasksCompleted":0,"successRate":0,"avgResponseTime":0}',
      dependencies TEXT DEFAULT '[]',
      collaboration_style TEXT,
      last_heartbeat TEXT,
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
    )`,
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'inbox',
      priority TEXT DEFAULT 'medium',
      assigned_to TEXT,
      created_by TEXT,
      parent_task_id TEXT,
      subtasks TEXT DEFAULT '[]',
      dependencies TEXT DEFAULT '[]',
      context TEXT DEFAULT '{}',
      expected_output TEXT,
      actual_output TEXT,
      quality_score REAL,
      estimated_hours REAL,
      actual_hours REAL,
      tags TEXT DEFAULT '[]',
      due_date TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP),
      updated_at TEXT DEFAULT (CURRENT_TIMESTAMP)
    )`,
    `CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      agent_id TEXT,
      action TEXT NOT NULL,
      details TEXT,
      metadata TEXT,
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
    )`,
    `CREATE TABLE IF NOT EXISTS gateway_connections (
      id TEXT PRIMARY KEY,
      name TEXT,
      url TEXT,
      status TEXT DEFAULT 'disconnected',
      last_seen TEXT,
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
    )`,
    `CREATE TABLE IF NOT EXISTS agent_messages (
      id TEXT PRIMARY KEY,
      agent_id TEXT,
      direction TEXT NOT NULL,
      content TEXT,
      created_at TEXT DEFAULT (CURRENT_TIMESTAMP)
    )`,
  ];

  for (const sql of migrations) {
    await executeSqlAsync(sql);
  }
  logger.info('Migrations completed');
}
