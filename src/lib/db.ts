// Database layer using @libsql/client with HTTPS URL conversion
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
  return result.rows.map(row => {
    const obj: any = {};
    result.columns.forEach((col, idx) => { obj[col] = row[idx]; });
    return obj as T;
  });
}

// Create a statement-like wrapper that mimics better-sqlite3's prepared statement
// But ALL methods are ASYNC and return Promises (unlike better-sqlite3 which is sync)
function createStatement(sql: string) {
  return {
    all: async (...params: any[]) => {
      const result = await getClient().execute({ sql, args: params.length > 0 ? params : undefined });
      return resultSetToRows(result);
    },
    get: async (...params: any[]) => {
      const result = await getClient().execute({ sql, args: params.length > 0 ? params : undefined });
      return resultSetToRows(result)[0] || undefined;
    },
    run: async (...params: any[]) => {
      const result = await getClient().execute({ sql, args: params.length > 0 ? params : undefined });
      return {
        changes: result.rowsAffected || 0,
        lastInsertRowid: result.lastInsertRowid || 0,
      };
    },
  };
}

// Database wrapper that mimics better-sqlite3's API
// NOTE: prepare() returns async methods that MUST be awaited
const db = new Proxy({} as any, {
  get(_target, prop) {
    if (prop === 'exec') {
      return async (sql: string) => {
        const statements = sql.split(';').filter(s => s.trim());
        for (const stmt of statements) {
          if (stmt.trim()) await getClient().execute({ sql: stmt.trim(), args: undefined });
        }
      };
    }
    if (prop === 'pragma') {
      return async (pragma: string) => {
        const result = await getClient().execute({ sql: `PRAGMA ${pragma}`, args: undefined });
        return resultSetToRows(result);
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
