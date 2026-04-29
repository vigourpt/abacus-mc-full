// =====================================================
// Database Layer - SQLite with better-sqlite3
// =====================================================

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { logger } from './logger';

const DATA_DIR = path.join(process.cwd(), '.data');
const DB_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, 'startup.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database with WAL mode
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

logger.info({ path: DB_PATH }, 'Database initialized');

export { db };
export default db;

// Helper to run migrations
export function runMigrations() {
  const migrations = [
    // Migration 1: Agents table (expanded for Phase 2)
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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,

    // Migration 2: Tasks table (expanded for Phase 2)
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT DEFAULT 'inbox',
      priority TEXT DEFAULT 'medium',
      assigned_to TEXT REFERENCES agents(id),
      created_by TEXT,
      parent_task_id TEXT REFERENCES tasks(id),
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
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,

    // Migration 3: Agent messages table
    `CREATE TABLE IF NOT EXISTS agent_messages (
      id TEXT PRIMARY KEY,
      from_agent_id TEXT NOT NULL REFERENCES agents(id),
      to_agent_id TEXT NOT NULL REFERENCES agents(id),
      content TEXT NOT NULL,
      type TEXT DEFAULT 'notification',
      task_id TEXT REFERENCES tasks(id),
      metadata TEXT DEFAULT '{}',
      read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    // Migration 4: Hiring requests table (expanded)
    `CREATE TABLE IF NOT EXISTS hiring_requests (
      id TEXT PRIMARY KEY,
      task_id TEXT REFERENCES tasks(id),
      required_capabilities TEXT NOT NULL,
      suggested_role TEXT NOT NULL,
      suggested_division TEXT,
      priority TEXT DEFAULT 'medium',
      justification TEXT,
      status TEXT DEFAULT 'pending',
      created_agent_id TEXT REFERENCES agents(id),
      approved_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    // Migration 5: Gateway connections table
    `CREATE TABLE IF NOT EXISTS gateway_connections (
      id TEXT PRIMARY KEY,
      host TEXT NOT NULL,
      port INTEGER NOT NULL,
      status TEXT DEFAULT 'disconnected',
      last_connected TEXT,
      device_identity TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,

    // Migration 6: Activity log
    `CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      agent_id TEXT REFERENCES agents(id),
      task_id TEXT REFERENCES tasks(id),
      message TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    // Migration 7: Token usage tracking
    `CREATE TABLE IF NOT EXISTS token_usage (
      id TEXT PRIMARY KEY,
      agent_id TEXT REFERENCES agents(id),
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cost REAL,
      task_id TEXT REFERENCES tasks(id),
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    // Migration 8: Task dependencies (Phase 2)
    `CREATE TABLE IF NOT EXISTS task_dependencies (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      depends_on_task_id TEXT NOT NULL REFERENCES tasks(id),
      dependency_type TEXT DEFAULT 'finish_to_start',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(task_id, depends_on_task_id)
    )`,

    // Migration 9: Agent collaborations (Phase 2)
    `CREATE TABLE IF NOT EXISTS agent_collaborations (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      lead_agent_id TEXT NOT NULL REFERENCES agents(id),
      collaborator_ids TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    )`,

    // Migration 10: Import history (Phase 2)
    `CREATE TABLE IF NOT EXISTS import_history (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      source_url TEXT,
      agents_imported INTEGER DEFAULT 0,
      agents_updated INTEGER DEFAULT 0,
      division TEXT,
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )`,

    // Migration 11: OpenClaw skills
    `CREATE TABLE IF NOT EXISTS openclaw_skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'missing',
      source TEXT,
      commands TEXT,
      auto_exec INTEGER DEFAULT 0,
      tags TEXT,
      synced_at TEXT
    )`,

    // Migration 12: OpenClaw tools
    `CREATE TABLE IF NOT EXISTS openclaw_tools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      description TEXT,
      enabled INTEGER DEFAULT 1,
      permissions TEXT,
      synced_at TEXT
    )`,

    // Migration 13: OpenClaw models
    `CREATE TABLE IF NOT EXISTS openclaw_models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider TEXT,
      input_modes TEXT,
      context_window INTEGER,
      local INTEGER DEFAULT 0,
      auth_required INTEGER DEFAULT 1,
      tags TEXT,
      aliases TEXT,
      synced_at TEXT
    )`,

    // Migration 14: Webhooks
    `CREATE TABLE IF NOT EXISTS webhooks (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      method TEXT DEFAULT 'POST',
      events TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )`,

    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to ON tasks(assigned_to)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)`,
    `CREATE INDEX IF NOT EXISTS idx_agents_status ON agents(status)`,
    `CREATE INDEX IF NOT EXISTS idx_agents_division ON agents(division)`,
    `CREATE INDEX IF NOT EXISTS idx_agents_specialization ON agents(specialization)`,
    `CREATE INDEX IF NOT EXISTS idx_agents_source ON agents(source)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_to_agent ON agent_messages(to_agent_id)`,
    `CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_log(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_task_dependencies_task ON task_dependencies(task_id)`,
    `CREATE INDEX IF NOT EXISTS idx_collaborations_task ON agent_collaborations(task_id)`,
    `CREATE INDEX IF NOT EXISTS idx_openclaw_skills_status ON openclaw_skills(status)`,
    `CREATE INDEX IF NOT EXISTS idx_openclaw_skills_source ON openclaw_skills(source)`,
    `CREATE INDEX IF NOT EXISTS idx_openclaw_tools_category ON openclaw_tools(category)`,
    `CREATE INDEX IF NOT EXISTS idx_openclaw_tools_enabled ON openclaw_tools(enabled)`,
    `CREATE INDEX IF NOT EXISTS idx_openclaw_models_provider ON openclaw_models(provider)`,
    `CREATE INDEX IF NOT EXISTS idx_openclaw_models_local ON openclaw_models(local)`,
  ];

  for (const migration of migrations) {
    try {
      db.exec(migration);
    } catch (error) {
      // Ignore "already exists" errors
      if (!(error as Error).message.includes('already exists')) {
        logger.error({ error, migration }, 'Migration failed');
        throw error;
      }
    }
  }

  // Add new columns to existing tables if they don't exist
  const alterTableMigrations = [
    'ALTER TABLE agents ADD COLUMN specialization TEXT',
    'ALTER TABLE agents ADD COLUMN source TEXT DEFAULT "local"',
    'ALTER TABLE agents ADD COLUMN source_url TEXT',
    'ALTER TABLE agents ADD COLUMN technical_skills TEXT DEFAULT "[]"',
    'ALTER TABLE agents ADD COLUMN personality_traits TEXT DEFAULT "[]"',
    'ALTER TABLE agents ADD COLUMN dependencies TEXT DEFAULT "[]"',
    'ALTER TABLE agents ADD COLUMN collaboration_style TEXT',
    'ALTER TABLE tasks ADD COLUMN dependencies TEXT DEFAULT "[]"',
    'ALTER TABLE tasks ADD COLUMN estimated_hours REAL',
    'ALTER TABLE tasks ADD COLUMN actual_hours REAL',
    'ALTER TABLE tasks ADD COLUMN tags TEXT DEFAULT "[]"',
    'ALTER TABLE hiring_requests ADD COLUMN suggested_division TEXT',
    'ALTER TABLE hiring_requests ADD COLUMN priority TEXT DEFAULT "medium"',
    'ALTER TABLE hiring_requests ADD COLUMN justification TEXT',
    'ALTER TABLE hiring_requests ADD COLUMN approved_by TEXT',
  ];

  for (const migration of alterTableMigrations) {
    try {
      db.exec(migration);
    } catch (error) {
      // Ignore "duplicate column" errors
      if (!(error as Error).message.includes('duplicate column')) {
        // Non-duplicate-column errors are fine to ignore for ALTER TABLE
      }
    }
  }

  logger.info('Database migrations completed');
}

// Run migrations on import
runMigrations();
