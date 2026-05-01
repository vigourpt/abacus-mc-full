// Database layer using @libsql/client
// Uses libsql:// URL which uses the native libsql wire protocol over HTTP
import { createClient, type Client, type ResultSet } from '@libsql/client';
import { logger } from './logger';

const DATABASE_URL = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || '';
const AUTH_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

let _client: Client | null = null;

function getClient(): Client {
  if (_client !== null) return _client;
  _client = createClient({ 
    url: DATABASE_URL, 
    authToken: AUTH_TOKEN || undefined,
  });
  logger.info({ url: DATABASE_URL.substring(0, 50) }, 'Database client initialized');
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
    return (getClient() as any)[prop];
  },
});

export { db, getClient };
export default db;
