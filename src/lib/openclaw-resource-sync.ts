import { createChildLogger } from './logger';
import { getOpenClawClient } from './openclaw-client';
import db from './db';
import * as fs from 'fs';
import * as path from 'path';

const logger = createChildLogger('openclaw-resource-sync');

// OpenClaw workspace paths (mounted in the container)
const OPENCLAW_STATE_DIR = process.env.OPENCLAW_STATE_DIR || '/data/.openclaw';
const WORKSPACE_SKILLS_DIR = path.join(OPENCLAW_STATE_DIR, 'workspace', 'skills');
const WORKSPACE_DIR = path.join(OPENCLAW_STATE_DIR, 'workspace');

export interface OpenClawSkill {
  id: string;
  name: string;
  description: string;
  status: 'ready' | 'missing' | 'disabled';
  source: string;
  commands?: string[];
  autoExec?: boolean;
  tags?: string[];
}

export interface OpenClawTool {
  id: string;
  name: string;
  category: string;
  description: string;
  enabled: boolean;
  permissions?: string[];
}

export interface OpenClawModel {
  id: string;
  name: string;
  provider: string;
  inputModes: string[];
  contextWindow: number;
  local: boolean;
  authRequired: boolean;
  tags: string[];
  aliases?: string[];
}

export interface SyncResult {
  synced: number;
  failed: number;
  skipped: number;
  existing: number;
  errors: string[];
}

export interface MergeResult {
  skills: SyncResult;
  tools: SyncResult;
  models: SyncResult;
  summary: {
    totalNew: number;
    totalExisting: number;
    totalFailed: number;
    missionControlPreserved: boolean;
  };
}

/**
 * Read skill from filesystem
 */
function readSkillFromDir(skillDir: string): OpenClawSkill | null {
  try {
    const skillJsonPath = path.join(skillDir, 'skill.json');
    if (!fs.existsSync(skillJsonPath)) {
      return null;
    }
    const skillData = JSON.parse(fs.readFileSync(skillJsonPath, 'utf-8'));
    
    // Check if skill has a bin or manifest
    const binPath = path.join(skillDir, 'bin');
    const hasBin = fs.existsSync(binPath);
    const manifestPath = path.join(skillDir, 'manifest.json');
    const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) : null;
    
    return {
      id: path.basename(skillDir),
      name: skillData.name || path.basename(skillDir),
      description: skillData.description || '',
      status: hasBin ? 'ready' : 'missing',
      source: skillData.source || 'openclaw-workspace',
      commands: skillData.commands || [],
      autoExec: skillData.autoExec || false,
      tags: skillData.tags || [],
    };
  } catch (err) {
    logger.warn({ skillDir, error: err }, 'Failed to read skill from directory');
    return null;
  }
}

/**
 * MERGE skills from OpenClaw into Mission Control
 * - Adds NEW skills from OpenClaw that don't exist
 * - PRESERVES all existing Mission Control skills
 * - NEVER deletes or replaces existing data
 */
export async function mergeSkillsFromOpenClaw(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, failed: 0, skipped: 0, existing: 0, errors: [] };

  try {
    // First try to get skills from OpenClaw gateway
    let skills: OpenClawSkill[] = [];
    const client = getOpenClawClient();
    
    if (client.getState() === 'connected') {
      try {
        skills = await client.listSkills();
        logger.info({ count: skills.length, source: 'gateway' }, 'Fetched skills from OpenClaw gateway');
      } catch (err) {
        logger.warn({ error: err }, 'Failed to fetch skills from gateway, trying filesystem');
      }
    }
    
    // Fallback to filesystem if no skills from gateway
    if (skills.length === 0 && fs.existsSync(WORKSPACE_SKILLS_DIR)) {
      const skillDirs = fs.readdirSync(WORKSPACE_SKILLS_DIR).filter(dir => {
        const stat = fs.statSync(path.join(WORKSPACE_SKILLS_DIR, dir));
        return stat.isDirectory();
      });

      for (const dir of skillDirs) {
        const skill = readSkillFromDir(path.join(WORKSPACE_SKILLS_DIR, dir));
        if (skill) {
          skills.push(skill);
        }
      }
      logger.info({ count: skills.length, path: WORKSPACE_SKILLS_DIR }, 'Merging skills from filesystem');
    }

    // UPSERT: Only insert if not exists (preserves existing data)
    const upsertStmt = db.prepare(`
      INSERT OR IGNORE INTO openclaw_skills (
        id, name, description, status, source, commands, auto_exec, tags, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    // Also update status for existing skills (to sync latest status from OpenClaw)
    const updateStmt = db.prepare(`
      UPDATE openclaw_skills 
      SET status = ?, synced_at = datetime('now')
      WHERE id = ?
    `);

    // Check what exists
    const getStmt = db.prepare('SELECT id FROM openclaw_skills WHERE id = ?');

    for (const skill of skills) {
      try {
        const exists = getStmt.get(skill.id);
        
        if (exists) {
          // Update status only (preserve local data)
          updateStmt.run(skill.status, skill.id);
          result.existing++;
        } else {
          // Insert new skill (preserve existing data with INSERT OR IGNORE)
          upsertStmt.run(
            skill.id,
            skill.name,
            skill.description,
            skill.status,
            skill.source,
            JSON.stringify(skill.commands || []),
            skill.autoExec ? 1 : 0,
            JSON.stringify(skill.tags || [])
          );
          result.synced++;
        }
      } catch (err) {
        result.failed++;
        result.errors.push(`Skill ${skill.id}: ${err}`);
      }
    }

    logger.info(result, 'Skills merge completed (existing data preserved)');
    return result;

  } catch (err) {
    logger.error({ error: err }, 'Failed to merge skills');
    throw err;
  }
}

/**
 * MERGE tools from OpenClaw into Mission Control
 * Reads tools from the OpenClaw gateway or config file
 */
export async function mergeToolsFromOpenClaw(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, failed: 0, skipped: 0, existing: 0, errors: [] };

  try {
    // First try to get tools from OpenClaw gateway
    let tools: OpenClawTool[] = [];
    const client = getOpenClawClient();
    
    if (client.getState() === 'connected') {
      try {
        tools = await client.listTools();
        logger.info({ count: tools.length, source: 'gateway' }, 'Fetched tools from OpenClaw gateway');
      } catch (err) {
        logger.warn({ error: err }, 'Failed to fetch tools from gateway, trying filesystem');
      }
    }
    
    // Fallback to filesystem if no tools from gateway
    if (tools.length === 0) {
      const configPath = path.join(OPENCLAW_STATE_DIR, 'openclaw.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const toolsConfig = config.tools || {};
        
        // Extract web tools
        if (toolsConfig.web?.search?.enabled) {
          tools.push({
            id: 'web-search',
            name: 'Web Search',
            category: 'web',
            description: 'Search the web for information',
            enabled: true,
          });
        }
        if (toolsConfig.web?.fetch?.enabled) {
          tools.push({
            id: 'web-fetch',
            name: 'Web Fetch',
            category: 'web',
            description: 'Fetch content from URLs',
            enabled: true,
          });
        }
        if (toolsConfig.media?.image?.enabled) {
          tools.push({
            id: 'image-understanding',
            name: 'Image Understanding',
            category: 'media',
            description: 'Understand images using AI',
            enabled: true,
          });
        }
        logger.info({ count: tools.length }, 'Merging tools from OpenClaw config');
      } else {
        logger.warn({ path: configPath }, 'Config file not found');
      }
    }

    // UPSERT: Only insert if not exists
    const upsertStmt = db.prepare(`
      INSERT OR IGNORE INTO openclaw_tools (
        id, name, category, description, enabled, permissions, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    // Update enabled status for existing tools
    const updateStmt = db.prepare(`
      UPDATE openclaw_tools 
      SET enabled = ?, synced_at = datetime('now')
      WHERE id = ?
    `);

    // Check what exists
    const getStmt = db.prepare('SELECT id FROM openclaw_tools WHERE id = ?');

    for (const tool of tools) {
      try {
        const exists = getStmt.get(tool.id);
        
        if (exists) {
          updateStmt.run(tool.enabled ? 1 : 0, tool.id);
          result.existing++;
        } else {
          upsertStmt.run(
            tool.id,
            tool.name,
            tool.category,
            tool.description,
            tool.enabled ? 1 : 0,
            JSON.stringify(tool.permissions || [])
          );
          result.synced++;
        }
      } catch (err) {
        result.failed++;
        result.errors.push(`Tool ${tool.id}: ${err}`);
      }
    }

    logger.info(result, 'Tools merge completed (existing data preserved)');
    return result;

  } catch (err) {
    logger.error({ error: err }, 'Failed to merge tools');
    throw err;
  }
}

/**
 * MERGE models from OpenClaw into Mission Control
 * Reads models from the OpenClaw gateway or config file
 */
export async function mergeModelsFromOpenClaw(): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, failed: 0, skipped: 0, existing: 0, errors: [] };

  try {
    // First try to get models from OpenClaw gateway
    let models: OpenClawModel[] = [];
    const client = getOpenClawClient();
    
    if (client.getState() === 'connected') {
      try {
        models = await client.listModels();
        logger.info({ count: models.length, source: 'gateway' }, 'Fetched models from OpenClaw gateway');
      } catch (err) {
        logger.warn({ error: err }, 'Failed to fetch models from gateway, trying filesystem');
      }
    }
    
    // Fallback to filesystem if no models from gateway
    if (models.length === 0) {
      const configPath = path.join(OPENCLAW_STATE_DIR, 'openclaw.json');
      if (fs.existsSync(configPath)) {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        const modelsConfig = config.models?.providers || {};
        
        // Extract models from each provider
        for (const [providerName, providerConfig] of Object.entries(modelsConfig)) {
          const provider = providerConfig as any;
          if (provider.models && Array.isArray(provider.models)) {
            for (const model of provider.models) {
              models.push({
                id: `${providerName}/${model.id}`,
                name: model.name || model.id,
                provider: providerName,
                inputModes: model.input || ['text'],
                contextWindow: model.contextWindow || 32000,
                local: providerName === 'ollama',
                authRequired: providerName !== 'ollama',
                tags: model.tags || [],
                aliases: model.compat?.alias ? [model.compat.alias] : [],
              });
            }
          }
        }
        logger.info({ count: models.length }, 'Merging models from OpenClaw config');
      } else {
        logger.warn({ path: configPath }, 'Config file not found');
      }
    }

    // UPSERT: Only insert if not exists
    const upsertStmt = db.prepare(`
      INSERT OR IGNORE INTO openclaw_models (
        id, name, provider, input_modes, context_window, local, auth_required, tags, aliases, synced_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    // Update tags for existing models
    const updateStmt = db.prepare(`
      UPDATE openclaw_models 
      SET tags = ?, synced_at = datetime('now')
      WHERE id = ?
    `);

    // Check what exists
    const getStmt = db.prepare('SELECT id FROM openclaw_models WHERE id = ?');

    for (const model of models) {
      try {
        const exists = getStmt.get(model.id);
        
        if (exists) {
          updateStmt.run(JSON.stringify(model.tags), model.id);
          result.existing++;
        } else {
          upsertStmt.run(
            model.id,
            model.name,
            model.provider,
            JSON.stringify(model.inputModes),
            model.contextWindow,
            model.local ? 1 : 0,
            model.authRequired ? 1 : 0,
            JSON.stringify(model.tags),
            JSON.stringify(model.aliases || [])
          );
          result.synced++;
        }
      } catch (err) {
        result.failed++;
        result.errors.push(`Model ${model.id}: ${err}`);
      }
    }

    logger.info(result, 'Models merge completed (existing data preserved)');
    return result;

  } catch (err) {
    logger.error({ error: err }, 'Failed to merge models');
    throw err;
  }
}

/**
 * MERGE all resources from OpenClaw into Mission Control
 * - Combines data from OpenClaw with existing Mission Control data
 * - PRESERVES all existing Mission Control data
 * - NEVER deletes anything
 */
export async function mergeAllResourcesFromOpenClaw(): Promise<MergeResult> {
  const [skills, tools, models] = await Promise.all([
    mergeSkillsFromOpenClaw(),
    mergeToolsFromOpenClaw(),
    mergeModelsFromOpenClaw(),
  ]);

  return {
    skills,
    tools,
    models,
    summary: {
      totalNew: skills.synced + tools.synced + models.synced,
      totalExisting: skills.existing + tools.existing + models.existing,
      totalFailed: skills.failed + tools.failed + models.failed,
      missionControlPreserved: true,
    },
  };
}

// Alias for backward compatibility
export const syncSkillsFromOpenClaw = mergeSkillsFromOpenClaw;
export const syncToolsFromOpenClaw = mergeToolsFromOpenClaw;
export const syncModelsFromOpenClaw = mergeModelsFromOpenClaw;
export const syncAllResourcesFromOpenClaw = mergeAllResourcesFromOpenClaw;

/**
 * Initialize database tables for OpenClaw resources
 */
export function initializeResourceTables(): void {
  // Skills table
  db.exec(`
    CREATE TABLE IF NOT EXISTS openclaw_skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'missing',
      source TEXT,
      commands TEXT,
      auto_exec INTEGER DEFAULT 0,
      tags TEXT,
      synced_at TEXT
    )
  `);

  // Tools table
  db.exec(`
    CREATE TABLE IF NOT EXISTS openclaw_tools (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT,
      description TEXT,
      enabled INTEGER DEFAULT 1,
      permissions TEXT,
      synced_at TEXT
    )
  `);

  // Models table
  db.exec(`
    CREATE TABLE IF NOT EXISTS openclaw_models (
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
    )
  `);

  logger.info('Resource tables initialized');
}

/**
 * Get all synced skills
 */
export function getSyncedSkills(): OpenClawSkill[] {
  const stmt = db.prepare('SELECT * FROM openclaw_skills ORDER BY name');
  const rows = stmt.all() as any[];
  
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    description: row.description,
    status: row.status,
    source: row.source,
    commands: JSON.parse(row.commands || '[]'),
    autoExec: row.auto_exec === 1,
    tags: JSON.parse(row.tags || '[]')
  }));
}

/**
 * Get all synced tools
 */
export function getSyncedTools(): OpenClawTool[] {
  const stmt = db.prepare('SELECT * FROM openclaw_tools ORDER BY name');
  const rows = stmt.all() as any[];
  
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    enabled: row.enabled === 1,
    permissions: JSON.parse(row.permissions || '[]')
  }));
}

/**
 * Get all synced models
 */
export function getSyncedModels(): OpenClawModel[] {
  const stmt = db.prepare('SELECT * FROM openclaw_models ORDER BY provider, name');
  const rows = stmt.all() as any[];
  
  return rows.map(row => ({
    id: row.id,
    name: row.name,
    provider: row.provider,
    inputModes: JSON.parse(row.input_modes || '[]'),
    contextWindow: row.context_window,
    local: row.local === 1,
    authRequired: row.auth_required === 1,
    tags: JSON.parse(row.tags || '[]'),
    aliases: JSON.parse(row.aliases || '[]')
  }));
}

/**
 * Get counts of synced resources
 */
export function getResourceCounts(): { skills: number; tools: number; models: number } {
  const skillsCount = (db.prepare('SELECT COUNT(*) as count FROM openclaw_skills').get() as any).count;
  const toolsCount = (db.prepare('SELECT COUNT(*) as count FROM openclaw_tools').get() as any).count;
  const modelsCount = (db.prepare('SELECT COUNT(*) as count FROM openclaw_models').get() as any).count;
  
  return { skills: skillsCount, tools: toolsCount, models: modelsCount };
}
