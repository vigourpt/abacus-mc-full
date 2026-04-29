// =====================================================
// Agent Sync - OpenClaw & Workspace Synchronization
// Phase 2 Enhanced
// =====================================================

import fs from 'fs';
import path from 'path';
import db from './db';
import { createChildLogger } from './logger';
import { generateId, slugify } from './utils';
import type { Agent, AgentDivision, AgentSource } from '@/types';

const logger = createChildLogger('agent-sync');

interface OpenClawAgent {
  id: string;
  name: string;
  workspace?: string;
  model?: {
    primary?: string;
    fallbacks?: string[];
  };
  identity?: {
    name?: string;
    theme?: string;
    emoji?: string;
  };
}

interface OpenClawConfig {
  agents?: OpenClawAgent[];
}

/**
 * Sync agents from OpenClaw configuration
 */
export async function syncFromOpenClaw(configPath?: string): Promise<number> {
  const openclawConfigPath =
    configPath ||
    process.env.OPENCLAW_CONFIG_PATH ||
    path.join(process.env.HOME || '', '.openclaw', 'openclaw.json');

  if (!fs.existsSync(openclawConfigPath)) {
    logger.warn({ path: openclawConfigPath }, 'OpenClaw config not found');
    return 0;
  }

  try {
    const config = JSON.parse(
      fs.readFileSync(openclawConfigPath, 'utf-8')
    ) as OpenClawConfig;

    if (!config.agents || config.agents.length === 0) {
      logger.info('No agents in OpenClaw config');
      return 0;
    }

    let synced = 0;

    for (const agent of config.agents) {
      const result = upsertAgent(agent);
      if (result) synced++;
    }

    logger.info({ count: synced }, 'Agents synced from OpenClaw');
    return synced;
  } catch (error) {
    logger.error({ error }, 'Failed to sync from OpenClaw');
    throw error;
  }
}

/**
 * Sync agents from workspace soul.md files
 */
export async function syncFromWorkspace(workspacePath?: string): Promise<number> {
  const agentsDir =
    workspacePath || path.join(process.cwd(), 'workspace', 'agents');

  if (!fs.existsSync(agentsDir)) {
    logger.warn({ path: agentsDir }, 'Workspace agents directory not found');
    return 0;
  }

  let synced = 0;
  const agentDirs = fs.readdirSync(agentsDir);

  for (const agentSlug of agentDirs) {
    const soulPath = path.join(agentsDir, agentSlug, 'soul.md');

    if (!fs.existsSync(soulPath)) {
      continue;
    }

    try {
      const soulContent = fs.readFileSync(soulPath, 'utf-8');
      const agent = parseSoulFile(agentSlug, soulContent);

      if (agent) {
        upsertAgentFromSoul(agent);
        synced++;
      }
    } catch (error) {
      logger.error({ agentSlug, error }, 'Failed to parse soul.md');
    }
  }

  logger.info({ count: synced }, 'Agents synced from workspace');
  return synced;
}

/**
 * Parse soul.md file to agent data with Phase 2 fields
 */
function parseSoulFile(
  slug: string,
  content: string
): Partial<Agent> | null {
  // Parse YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);

  if (!frontmatterMatch) {
    return null;
  }

  const frontmatter = frontmatterMatch[1];
  const data: Record<string, string> = {};

  // Simple YAML parsing with quoted values support
  for (const line of frontmatter.split('\n')) {
    const match = line.match(/^(\w+):\s*"?([^"]*)"?$/);
    if (match) {
      data[match[1]] = match[2].trim();
    }
  }

  // Extract division from description, path, or explicit field
  let division: AgentDivision = data.division as AgentDivision || 'engineering';
  const description = data.description?.toLowerCase() || '';
  
  if (!data.division) {
    if (description.includes('ceo') || description.includes('strategic') || description.includes('executive')) {
      division = 'executive';
    } else if (description.includes('marketing')) {
      division = 'marketing';
    } else if (description.includes('sales') || description.includes('revenue')) {
      division = 'sales';
    } else if (description.includes('operations')) {
      division = 'operations';
    } else if (description.includes('design') || description.includes('ui') || description.includes('ux')) {
      division = 'design';
    } else if (description.includes('test') || description.includes('qa')) {
      division = 'testing';
    } else if (description.includes('support')) {
      division = 'support';
    } else if (description.includes('product')) {
      division = 'product';
    }
  }

  // Determine source
  const source: AgentSource = data.source as AgentSource || 'local';

  return {
    slug,
    name: data.name || slug,
    description: data.description || '',
    emoji: data.emoji || '🤖',
    color: data.color || 'blue',
    division,
    specialization: data.specialization,
    source,
    sourceUrl: data.source_url,
    systemPrompt: content,
    capabilities: extractCapabilities(content),
    technicalSkills: extractTechnicalSkills(content),
    personalityTraits: extractPersonalityTraits(content),
  };
}

/**
 * Extract capabilities from soul.md content
 */
function extractCapabilities(content: string): string[] {
  const capabilities: string[] = [];

  // Look for capability-related patterns
  const patterns = [
    /capabilities?:?\s*([\w,\s-]+)/gi,
    /specializ\w+\s+in\s+([\w,\s-]+)/gi,
    /expert\w*\s+in\s+([\w,\s-]+)/gi,
    /##\s*(?:Core\s+)?Capabilities\n([\s\S]*?)(?=\n##|\n$)/gi,
  ];

  for (const pattern of patterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const caps = match[1].split(/[,\n]/).map((c) => c.trim().replace(/^[-*]\s*/, ''));
      capabilities.push(...caps.filter((c) => c.length > 2 && c.length < 50));
    }
  }

  // Deduplicate
  return [...new Set(capabilities)].slice(0, 20);
}

/**
 * Extract technical skills from content
 */
function extractTechnicalSkills(content: string): string[] {
  const skills: string[] = [];
  
  const techKeywords = [
    'react', 'vue', 'angular', 'typescript', 'javascript', 'python', 'go', 'rust',
    'nodejs', 'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'terraform',
    'graphql', 'rest', 'api', 'sql', 'nosql', 'mongodb', 'postgresql', 'redis',
    'figma', 'tailwind', 'css', 'html', 'git', 'ci/cd',
  ];

  const contentLower = content.toLowerCase();
  for (const keyword of techKeywords) {
    if (contentLower.includes(keyword)) {
      skills.push(keyword);
    }
  }

  return [...new Set(skills)];
}

/**
 * Extract personality traits from content
 */
function extractPersonalityTraits(content: string): string[] {
  const traits: string[] = [];
  
  const commonTraits = [
    'analytical', 'creative', 'detail-oriented', 'systematic', 'collaborative',
    'innovative', 'pragmatic', 'thorough', 'efficient', 'proactive',
    'visionary', 'decisive', 'strategic', 'empathetic', 'articulate',
  ];

  const contentLower = content.toLowerCase();
  for (const trait of commonTraits) {
    if (contentLower.includes(trait)) {
      traits.push(trait);
    }
  }

  return [...new Set(traits)];
}

/**
 * Upsert agent from OpenClaw config
 */
function upsertAgent(openclawAgent: OpenClawAgent): boolean {
  const slug = slugify(openclawAgent.name || openclawAgent.id);

  const existing = db
    .prepare('SELECT id FROM agents WHERE slug = ?')
    .get(slug) as { id: string } | undefined;

  if (existing) {
    const stmt = db.prepare(`
      UPDATE agents SET
        name = ?,
        workspace_path = ?,
        model_config = ?,
        source = 'openclaw',
        updated_at = datetime('now')
      WHERE slug = ?
    `);

    stmt.run(
      openclawAgent.name,
      openclawAgent.workspace || null,
      JSON.stringify({
        primary: openclawAgent.model?.primary || 'claude-3-opus',
        fallbacks: openclawAgent.model?.fallbacks || [],
      }),
      slug
    );
  } else {
    const stmt = db.prepare(`
      INSERT INTO agents (
        id, name, slug, description, emoji, color, division,
        source, status, capabilities, technical_skills, personality_traits,
        system_prompt, workspace_path, model_config, metrics
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      generateId(),
      openclawAgent.name,
      slug,
      `AI agent: ${openclawAgent.name}`,
      openclawAgent.identity?.emoji || '🤖',
      openclawAgent.identity?.theme || 'blue',
      'engineering',
      'openclaw',
      'idle',
      '[]',
      '[]',
      '[]',
      '',
      openclawAgent.workspace || null,
      JSON.stringify({
        primary: openclawAgent.model?.primary || 'claude-3-opus',
        fallbacks: openclawAgent.model?.fallbacks || [],
      }),
      JSON.stringify({ tasksCompleted: 0, successRate: 0, avgResponseTime: 0 })
    );
  }

  return true;
}

/**
 * Upsert agent from soul.md data with Phase 2 fields
 */
function upsertAgentFromSoul(agent: Partial<Agent>): boolean {
  const slug = agent.slug || slugify(agent.name || 'unknown');

  const existing = db
    .prepare('SELECT id FROM agents WHERE slug = ?')
    .get(slug) as { id: string } | undefined;

  if (existing) {
    const stmt = db.prepare(`
      UPDATE agents SET
        name = ?,
        description = ?,
        emoji = ?,
        color = ?,
        division = ?,
        specialization = ?,
        source = ?,
        source_url = ?,
        capabilities = ?,
        technical_skills = ?,
        personality_traits = ?,
        system_prompt = ?,
        updated_at = datetime('now')
      WHERE slug = ?
    `);

    stmt.run(
      agent.name,
      agent.description,
      agent.emoji,
      agent.color,
      agent.division,
      agent.specialization || null,
      agent.source || 'local',
      agent.sourceUrl || null,
      JSON.stringify(agent.capabilities || []),
      JSON.stringify(agent.technicalSkills || []),
      JSON.stringify(agent.personalityTraits || []),
      agent.systemPrompt,
      slug
    );
  } else {
    const stmt = db.prepare(`
      INSERT INTO agents (
        id, name, slug, description, emoji, color, division, specialization,
        source, source_url, status, capabilities, technical_skills, personality_traits,
        system_prompt, model_config, metrics
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      generateId(),
      agent.name,
      slug,
      agent.description,
      agent.emoji,
      agent.color,
      agent.division,
      agent.specialization || null,
      agent.source || 'local',
      agent.sourceUrl || null,
      'idle',
      JSON.stringify(agent.capabilities || []),
      JSON.stringify(agent.technicalSkills || []),
      JSON.stringify(agent.personalityTraits || []),
      agent.systemPrompt,
      JSON.stringify({ primary: 'claude-3-opus', fallbacks: [] }),
      JSON.stringify({ tasksCompleted: 0, successRate: 0, avgResponseTime: 0 })
    );
  }

  return true;
}

/**
 * Full sync from all sources
 */
export async function syncAll(): Promise<{ openclaw: number; workspace: number }> {
  const openclaw = await syncFromOpenClaw();
  const workspace = await syncFromWorkspace();

  return { openclaw, workspace };
}

/**
 * Get agent count by source
 */
export function getAgentCountBySource(): Record<string, number> {
  const stmt = db.prepare(`
    SELECT source, COUNT(*) as count FROM agents GROUP BY source
  `);
  const rows = stmt.all() as Array<{ source: string; count: number }>;
  
  return rows.reduce((acc, row) => {
    acc[row.source || 'local'] = row.count;
    return acc;
  }, {} as Record<string, number>);
}

/**
 * Get agent count by division
 */
export function getAgentCountByDivision(): Record<string, number> {
  const stmt = db.prepare(`
    SELECT division, COUNT(*) as count FROM agents GROUP BY division
  `);
  const rows = stmt.all() as Array<{ division: string; count: number }>;
  
  return rows.reduce((acc, row) => {
    acc[row.division] = row.count;
    return acc;
  }, {} as Record<string, number>);
}



// =====================================================
// Phase 3 Enhancements: Bidirectional OpenClaw Sync
// =====================================================

import { getOpenClawClient } from './openclaw-client';
import { getOpenClawConfig, type OpenClawChannel } from './openclaw-config';

// OpenClaw agent format for sync
export interface OpenClawAgentDefinition {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  systemPrompt: string;
  channels: string[];
  metadata: {
    division: AgentDivision;
    source: AgentSource;
    technicalSkills: string[];
    personalityTraits: string[];
  };
}

/**
 * Convert local agent to OpenClaw format
 */
export function convertToOpenClawFormat(agent: Agent): OpenClawAgentDefinition {
  const config = getOpenClawConfig();
  
  // Get channels mapped to this agent
  const channels = config.channels
    .filter(ch => ch.agentMappings.some(m => m.agentSlug === agent.slug))
    .map(ch => ch.id);

  return {
    id: agent.slug,
    name: agent.name,
    description: agent.description,
    capabilities: agent.capabilities,
    systemPrompt: agent.systemPrompt,
    channels,
    metadata: {
      division: agent.division,
      source: agent.source,
      technicalSkills: agent.technicalSkills,
      personalityTraits: agent.personalityTraits,
    },
  };
}

/**
 * Convert OpenClaw agent to local format
 */
export function convertFromOpenClawFormat(
  openclawAgent: OpenClawAgentDefinition
): Partial<Agent> {
  return {
    slug: openclawAgent.id,
    name: openclawAgent.name,
    description: openclawAgent.description,
    capabilities: openclawAgent.capabilities,
    systemPrompt: openclawAgent.systemPrompt,
    source: 'openclaw',
    division: openclawAgent.metadata?.division || 'engineering',
    technicalSkills: openclawAgent.metadata?.technicalSkills || [],
    personalityTraits: openclawAgent.metadata?.personalityTraits || [],
    emoji: '🤖',
    color: 'blue',
  };
}

/**
 * Sync a single agent to OpenClaw gateway
 */
export async function syncAgentToOpenClaw(agentSlug: string): Promise<boolean> {
  const agent = db
    .prepare('SELECT * FROM agents WHERE slug = ?')
    .get(agentSlug) as AgentRow | undefined;

  if (!agent) {
    logger.warn({ slug: agentSlug }, 'Agent not found for OpenClaw sync');
    return false;
  }

  try {
    const client = getOpenClawClient();
    
    if (client.getState() !== 'connected') {
      logger.warn('OpenClaw client not connected, skipping sync');
      return false;
    }

    const agentData: Agent = {
      id: agent.id,
      slug: agent.slug,
      name: agent.name,
      description: agent.description,
      emoji: agent.emoji,
      color: agent.color,
      division: agent.division as AgentDivision,
      specialization: agent.specialization || undefined,
      source: agent.source as AgentSource,
      sourceUrl: agent.source_url || undefined,
      status: agent.status as Agent['status'],
      capabilities: JSON.parse(agent.capabilities || '[]'),
      technicalSkills: JSON.parse(agent.technical_skills || '[]'),
      personalityTraits: JSON.parse(agent.personality_traits || '[]'),
      systemPrompt: agent.system_prompt,
      workspacePath: agent.workspace_path || undefined,
      model: JSON.parse(agent.model_config || '{}'),
      metrics: JSON.parse(agent.metrics || '{}'),
      dependencies: JSON.parse(agent.dependencies || '[]'),
      collaborationStyle: agent.collaboration_style || undefined,
      lastHeartbeat: agent.last_heartbeat ? new Date(agent.last_heartbeat) : undefined,
      createdAt: new Date(agent.created_at),
      updatedAt: new Date(agent.updated_at),
    };

    const openclawFormat = convertToOpenClawFormat(agentData);
    await client.syncAgent({
      slug: openclawFormat.id,
      name: openclawFormat.name,
      description: openclawFormat.description,
      capabilities: openclawFormat.capabilities,
      systemPrompt: openclawFormat.systemPrompt,
    });

    logger.info({ slug: agentSlug }, 'Agent synced to OpenClaw');
    return true;
  } catch (error) {
    logger.error({ error, slug: agentSlug }, 'Failed to sync agent to OpenClaw');
    return false;
  }
}

/**
 * Sync all agents to OpenClaw gateway
 */
export async function syncAllAgentsToOpenClaw(): Promise<{
  synced: number;
  failed: number;
  skipped: number;
}> {
  const client = getOpenClawClient();
  
  if (client.getState() !== 'connected') {
    logger.warn('OpenClaw client not connected, skipping bulk sync');
    return { synced: 0, failed: 0, skipped: 0 };
  }

  const agents = db.prepare('SELECT slug FROM agents').all() as Array<{ slug: string }>;
  
  let synced = 0;
  let failed = 0;
  let skipped = 0;

  for (const agent of agents) {
    try {
      const success = await syncAgentToOpenClaw(agent.slug);
      if (success) {
        synced++;
      } else {
        skipped++;
      }
    } catch {
      failed++;
    }
  }

  logger.info({ synced, failed, skipped }, 'Bulk OpenClaw sync completed');
  return { synced, failed, skipped };
}

/**
 * Pull agents from OpenClaw gateway
 */
export async function pullAgentsFromOpenClaw(): Promise<number> {
  const client = getOpenClawClient();
  
  if (client.getState() !== 'connected') {
    logger.warn('OpenClaw client not connected, cannot pull agents');
    return 0;
  }

  try {
    // Request agent list from OpenClaw
    const response = await client.send('agent_sync', { action: 'list' }, true) as {
      agents: OpenClawAgentDefinition[];
    };

    if (!response?.agents) {
      return 0;
    }

    let imported = 0;
    for (const openclawAgent of response.agents) {
      const localAgent = convertFromOpenClawFormat(openclawAgent);
      upsertAgentFromSoul(localAgent);
      imported++;
    }

    logger.info({ count: imported }, 'Agents pulled from OpenClaw');
    return imported;
  } catch (error) {
    logger.error({ error }, 'Failed to pull agents from OpenClaw');
    return 0;
  }
}

/**
 * Bidirectional sync with OpenClaw
 */
export async function bidirectionalSync(): Promise<{
  pushed: number;
  pulled: number;
  local: number;
  workspace: number;
}> {
  // First sync from local sources
  const { openclaw: fromOpenclawConfig, workspace } = await syncAll();
  
  // Then sync to OpenClaw gateway
  const pushResult = await syncAllAgentsToOpenClaw();
  
  // Finally pull any new agents from OpenClaw
  const pulled = await pullAgentsFromOpenClaw();

  return {
    pushed: pushResult.synced,
    pulled,
    local: fromOpenclawConfig,
    workspace,
  };
}

/**
 * Delete agent from OpenClaw
 */
export async function deleteAgentFromOpenClaw(agentSlug: string): Promise<boolean> {
  const client = getOpenClawClient();
  
  if (client.getState() !== 'connected') {
    logger.warn('OpenClaw client not connected, cannot delete agent');
    return false;
  }

  try {
    await client.send('agent_sync', { action: 'delete', agentId: agentSlug }, true);
    logger.info({ slug: agentSlug }, 'Agent deleted from OpenClaw');
    return true;
  } catch (error) {
    logger.error({ error, slug: agentSlug }, 'Failed to delete agent from OpenClaw');
    return false;
  }
}

/**
 * Update agent channels in OpenClaw
 */
export async function updateAgentChannels(
  agentSlug: string,
  channels: string[]
): Promise<boolean> {
  const client = getOpenClawClient();
  
  if (client.getState() !== 'connected') {
    logger.warn('OpenClaw client not connected');
    return false;
  }

  try {
    await client.send('agent_sync', {
      action: 'update_channels',
      agentId: agentSlug,
      channels,
    }, true);
    
    logger.info({ slug: agentSlug, channels }, 'Agent channels updated in OpenClaw');
    return true;
  } catch (error) {
    logger.error({ error, slug: agentSlug }, 'Failed to update agent channels');
    return false;
  }
}

// Type import for AgentRow
interface AgentRow {
  id: string;
  slug: string;
  name: string;
  description: string;
  emoji: string;
  color: string;
  division: string;
  specialization: string | null;
  source: string;
  source_url: string | null;
  status: string;
  capabilities: string;
  technical_skills: string;
  personality_traits: string;
  system_prompt: string;
  workspace_path: string | null;
  model_config: string;
  metrics: string;
  dependencies: string;
  collaboration_style: string | null;
  last_heartbeat: string | null;
  created_at: string;
  updated_at: string;
}
