// =====================================================
// Agent Import Tool - Phase 2
// =====================================================
// Fetches agent profiles from agency-agents repository
// and converts them to soul.md format compatible with our system.

import fs from 'fs';
import path from 'path';
import db from './db';
import { createChildLogger } from './logger';
import { generateId, slugify } from './utils';
import type { 
  Agent, 
  AgentDivision, 
  AgentSource, 
  ParsedAgent,
  ImportHistory,
  AgentRow 
} from '@/types';

const logger = createChildLogger('agent-importer');

// Agency-agents repository configuration
const AGENCY_AGENTS_BASE_URL = 'https://raw.githubusercontent.com/msitarzewski/agency-agents/main';
const AGENCY_AGENTS_API_URL = 'https://api.github.com/repos/msitarzewski/agency-agents/contents';

// Division mappings
const DIVISION_MAP: Record<string, AgentDivision> = {
  'engineering': 'engineering',
  'design': 'design',
  'marketing': 'marketing',
  'paid-media': 'paid-media',
  'product': 'product',
  'project-management': 'project-management',
  'testing': 'testing',
  'support': 'support',
  'operations': 'operations',
  'spatial-computing': 'spatial-computing',
  'specialized': 'specialized',
  'game-development': 'game-development',
  'strategy': 'strategy',
};

// Emoji mappings for agent types
const AGENT_EMOJI_MAP: Record<string, string> = {
  'frontend': '🎨',
  'backend': '🏛️',
  'devops': '🚀',
  'ai': '🤖',
  'mobile': '📱',
  'security': '🔐',
  'data': '📊',
  'senior': '👨‍💻',
  'technical-writer': '📝',
  'prototyper': '⚡',
  'architect': '🏗️',
  'incident': '🚨',
  'embedded': '🔧',
  'solidity': '⛓️',
  'wechat': '💬',
  'optimization': '⚙️',
  'threat': '🛡️',
  'designer': '🎨',
  'ux': '👤',
  'product': '📦',
  'project': '📋',
  'qa': '✅',
  'tester': '🧪',
  'support': '💬',
  'spatial': '🌐',
  'vr': '🥽',
  'ar': '📲',
  'game': '🎮',
  'unity': '🎯',
  'unreal': '🎬',
  'godot': '🎲',
  'roblox': '🧱',
  'marketing': '📣',
  'seo': '🔍',
  'content': '✍️',
  'social': '📱',
  'paid': '💰',
  'ppc': '🎯',
  'analytics': '📈',
  'brand': '™️',
  'strategy': '♟️',
  // Sales-related
  'sales': '💼',
  'account': '🤝',
  'revenue': '💵',
  'business': '📊',
  'partnership': '🤝',
  'sdr': '📞',
  'enterprise': '🏢',
  'customer-success': '⭐',
  'enablement': '📚',
  'growth': '🚀',
  'community': '👥',
  'influencer': '✨',
  'email': '📧',
  'automation': '⚡',
  'copywriter': '✏️',
  'performance': '🎯',
  // Operations & Support
  'operations': '⚙️',
  'compliance': '📋',
  'legal': '⚖️',
  'finance': '💳',
  'payable': '💸',
  'receivable': '💰',
  'infrastructure': '🏗️',
  'orchestrat': '🎭',
  'consolidat': '📊',
  'report': '📑',
  'responder': '📞',
  'workflow': '🔄',
  'jira': '📌',
  'producer': '🎬',
  'shepherd': '👨‍💼',
  'tracker': '📍',
  'executive': '👔',
  'summary': '📋',
};

// Color mappings for divisions
const DIVISION_COLORS: Record<string, string> = {
  'engineering': '#3b82f6',
  'design': '#ec4899',
  'marketing': '#8b5cf6',
  'paid-media': '#f97316',
  'product': '#06b6d4',
  'project-management': '#84cc16',
  'testing': '#22c55e',
  'support': '#eab308',
  'spatial-computing': '#6366f1',
  'specialized': '#a855f7',
  'game-development': '#ef4444',
  'strategy': '#0ea5e9',
  'executive': '#f59e0b',
  'sales': '#f97316',
  'operations': '#10b981',
};

/**
 * Agent Importer Class
 */
export class AgentImporter {
  private workspaceDir: string;

  constructor(workspaceDir?: string) {
    this.workspaceDir = workspaceDir || path.join(process.cwd(), 'workspace', 'agents');
  }

  /**
   * Fetch list of agents from a division
   */
  async fetchDivisionAgents(division: string): Promise<string[]> {
    const url = `${AGENCY_AGENTS_API_URL}/${division}`;
    logger.info({ division, url }, 'Fetching division agents list');

    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Autonomous-AI-Startup'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch division: ${response.status}`);
      }

      const files = await response.json() as Array<{ name: string; download_url: string }>;
      return files
        .filter(f => f.name.endsWith('.md') && !f.name.startsWith('README'))
        .map(f => f.name);
    } catch (error) {
      logger.error({ error, division }, 'Failed to fetch division agents');
      throw error;
    }
  }

  /**
   * Fetch agent markdown content from repository
   */
  async fetchAgentMarkdown(division: string, filename: string): Promise<string> {
    const url = `${AGENCY_AGENTS_BASE_URL}/${division}/${filename}`;
    logger.debug({ url }, 'Fetching agent markdown');

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch agent: ${response.status}`);
      }
      return await response.text();
    } catch (error) {
      logger.error({ error, division, filename }, 'Failed to fetch agent markdown');
      throw error;
    }
  }

  /**
   * Parse agency-agents markdown to ParsedAgent
   */
  parseAgentMarkdown(content: string, filename: string, division: string): ParsedAgent {
    const lines = content.split('\n');
    
    // Extract name from first H1 or filename
    let name = filename.replace('.md', '').replace(`${division}-`, '');
    const h1Match = content.match(/^#\s+(.+)$/m);
    if (h1Match) {
      name = h1Match[1].trim();
    }

    // Generate slug
    const slug = slugify(name);

    // Extract description from first paragraph after H1
    let description = '';
    const descMatch = content.match(/^#\s+.+\n\n([^#\n].+)/m);
    if (descMatch) {
      description = descMatch[1].trim();
    }

    // Extract emoji from name or use default
    const emoji = this.detectEmoji(name, filename) || '🤖';

    // Extract capabilities from content
    const capabilities = this.extractCapabilities(content);

    // Extract technical skills
    const technicalSkills = this.extractTechnicalSkills(content);

    // Extract personality traits
    const personalityTraits = this.extractPersonalityTraits(content);

    // Get specialization from filename
    const specialization = this.extractSpecialization(filename, division);

    // Get color from division
    const color = DIVISION_COLORS[division] || '#6b7280';

    return {
      name,
      slug,
      description: description || `AI agent specializing in ${specialization || division}`,
      emoji,
      color,
      division: DIVISION_MAP[division] || 'engineering',
      specialization,
      capabilities,
      technicalSkills,
      personalityTraits,
      systemPrompt: this.convertToSoulFormat(content, name, capabilities),
      source: 'agency-agents',
      sourceUrl: `${AGENCY_AGENTS_BASE_URL}/${division}/${filename}`,
    };
  }

  /**
   * Detect appropriate emoji for agent
   */
  private detectEmoji(name: string, filename: string): string {
    const combined = `${name} ${filename}`.toLowerCase();
    
    for (const [key, emoji] of Object.entries(AGENT_EMOJI_MAP)) {
      if (combined.includes(key)) {
        return emoji;
      }
    }
    return '🤖';
  }

  /**
   * Extract capabilities from markdown content
   */
  private extractCapabilities(content: string): string[] {
    const capabilities: string[] = [];
    
    // Look for capabilities section
    const capSection = content.match(/##\s*(?:Core\s+)?(?:Capabilities|Skills|Expertise)[^\n]*\n([\s\S]*?)(?=\n##|\n$)/i);
    if (capSection) {
      const lines = capSection[1].split('\n');
      for (const line of lines) {
        const match = line.match(/^[-*]\s*\*?\*?([^:*]+)/);
        if (match) {
          capabilities.push(match[1].trim().toLowerCase().replace(/\s+/g, '-'));
        }
      }
    }

    // Look for keyword patterns
    const patterns = [
      /(?:expert|specialize|focus)\s+(?:in|on)\s+([^.]+)/gi,
      /(?:capabilities?|skills?):\s*([^.]+)/gi,
    ];

    for (const pattern of patterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        const skills = match[1].split(/[,;&]/).map(s => s.trim().toLowerCase().replace(/\s+/g, '-'));
        capabilities.push(...skills.filter(s => s.length > 2 && s.length < 30));
      }
    }

    // Deduplicate and limit
    return [...new Set(capabilities)].slice(0, 15);
  }

  /**
   * Extract technical skills from content
   */
  private extractTechnicalSkills(content: string): string[] {
    const skills: string[] = [];
    
    // Common technical keywords
    const techKeywords = [
      'react', 'vue', 'angular', 'typescript', 'javascript', 'python', 'go', 'rust',
      'nodejs', 'docker', 'kubernetes', 'aws', 'gcp', 'azure', 'terraform', 'ci/cd',
      'graphql', 'rest', 'api', 'sql', 'nosql', 'mongodb', 'postgresql', 'redis',
      'figma', 'sketch', 'adobe', 'tailwind', 'css', 'html', 'webpack', 'vite',
      'git', 'jira', 'agile', 'scrum', 'devops', 'sre', 'security', 'testing',
      'unity', 'unreal', 'godot', 'roblox', 'c#', 'c++', 'lua', 'swift', 'kotlin',
      'flutter', 'react-native', 'ios', 'android', 'solidity', 'blockchain', 'web3',
    ];

    const contentLower = content.toLowerCase();
    for (const keyword of techKeywords) {
      if (contentLower.includes(keyword)) {
        skills.push(keyword);
      }
    }

    return [...new Set(skills)].slice(0, 20);
  }

  /**
   * Extract personality traits from content
   */
  private extractPersonalityTraits(content: string): string[] {
    const traits: string[] = [];
    
    // Look for personality/identity section
    const personalitySection = content.match(/##\s*(?:Your\s+)?(?:Identity|Personality|Character)[^\n]*\n([\s\S]*?)(?=\n##|\n$)/i);
    if (personalitySection) {
      const traitPatterns = [
        /(?:you\s+are|as\s+a[n]?)\s+(\w+)/gi,
        /^[-*]\s*(\w+[-\s]?\w*)/gm,
      ];

      for (const pattern of traitPatterns) {
        const matches = personalitySection[1].matchAll(pattern);
        for (const match of matches) {
          const trait = match[1].trim().toLowerCase();
          if (trait.length > 3 && trait.length < 20) {
            traits.push(trait);
          }
        }
      }
    }

    // Common personality traits
    const commonTraits = [
      'analytical', 'creative', 'detail-oriented', 'systematic', 'collaborative',
      'innovative', 'pragmatic', 'thorough', 'efficient', 'proactive',
    ];

    const contentLower = content.toLowerCase();
    for (const trait of commonTraits) {
      if (contentLower.includes(trait)) {
        traits.push(trait);
      }
    }

    return [...new Set(traits)].slice(0, 10);
  }

  /**
   * Extract specialization from filename
   */
  private extractSpecialization(filename: string, division: string): string {
    // Remove division prefix and .md extension
    let spec = filename.replace('.md', '').replace(`${division}-`, '');
    
    // Convert to title case
    return spec
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Convert markdown to soul.md format
   */
  private convertToSoulFormat(content: string, name: string, capabilities: string[]): string {
    // Clean up content
    let cleaned = content
      .replace(/^#\s+.+\n\n?/m, '') // Remove first H1
      .replace(/\n{3,}/g, '\n\n')   // Normalize newlines
      .trim();

    // Add soul.md structure
    return `## Your Identity
You are ${name}, an AI agent with deep expertise in your domain.

${cleaned}

## Core Capabilities
${capabilities.map(c => `- ${c}`).join('\n')}

## Critical Rules
1. Stay within your area of expertise
2. Ask for clarification when requirements are unclear
3. Provide detailed, actionable outputs
4. Report progress and blockers promptly
5. Collaborate with other agents when needed
6. Maintain quality standards at all times

## Communication Style
- Be professional and precise
- Provide structured responses
- Include relevant examples when applicable
- Use technical terminology appropriately
`;
  }

  /**
   * Create workspace directory for agent
   */
  createAgentWorkspace(slug: string): string {
    const agentDir = path.join(this.workspaceDir, slug);
    
    if (!fs.existsSync(agentDir)) {
      fs.mkdirSync(agentDir, { recursive: true });
    }

    return agentDir;
  }

  /**
   * Generate soul.md file for agent
   */
  generateSoulMd(agent: ParsedAgent): string {
    const frontmatter = [
      '---',
      `name: "${agent.name}"`,
      `description: "${agent.description}"`,
      `emoji: "${agent.emoji}"`,
      `color: "${agent.color}"`,
      `division: "${agent.division}"`,
      agent.specialization ? `specialization: "${agent.specialization}"` : null,
      `source: "${agent.source}"`,
      agent.sourceUrl ? `source_url: "${agent.sourceUrl}"` : null,
      `vibe: "professional, skilled, collaborative"`,
      '---',
    ].filter(Boolean).join('\n');

    return `${frontmatter}

# ${agent.name}

${agent.systemPrompt}
`;
  }

  /**
   * Save agent to workspace
   */
  saveAgentToWorkspace(agent: ParsedAgent): string {
    const agentDir = this.createAgentWorkspace(agent.slug);
    const soulPath = path.join(agentDir, 'soul.md');
    const soulContent = this.generateSoulMd(agent);
    
    fs.writeFileSync(soulPath, soulContent, 'utf-8');
    logger.info({ slug: agent.slug, path: soulPath }, 'Soul.md created');

    return soulPath;
  }

  /**
   * Import agent to database
   */
  importAgentToDb(agent: ParsedAgent): { id: string; isNew: boolean } {
    const existing = db
      .prepare('SELECT id FROM agents WHERE slug = ?')
      .get(agent.slug) as { id: string } | undefined;

    if (existing) {
      // Update existing agent
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
          workspace_path = ?,
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
        agent.source,
        agent.sourceUrl || null,
        JSON.stringify(agent.capabilities),
        JSON.stringify(agent.technicalSkills),
        JSON.stringify(agent.personalityTraits),
        agent.systemPrompt,
        path.join(this.workspaceDir, agent.slug),
        agent.slug
      );

      return { id: existing.id, isNew: false };
    } else {
      // Insert new agent
      const id = generateId();
      const stmt = db.prepare(`
        INSERT INTO agents (
          id, name, slug, description, emoji, color, division, specialization,
          source, source_url, status, capabilities, technical_skills,
          personality_traits, system_prompt, workspace_path, model_config, metrics
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        agent.name,
        agent.slug,
        agent.description,
        agent.emoji,
        agent.color,
        agent.division,
        agent.specialization || null,
        agent.source,
        agent.sourceUrl || null,
        'idle',
        JSON.stringify(agent.capabilities),
        JSON.stringify(agent.technicalSkills),
        JSON.stringify(agent.personalityTraits),
        agent.systemPrompt,
        path.join(this.workspaceDir, agent.slug),
        JSON.stringify({ primary: 'claude-3-opus', fallbacks: ['claude-3-sonnet'] }),
        JSON.stringify({ tasksCompleted: 0, successRate: 0, avgResponseTime: 0 })
      );

      return { id, isNew: true };
    }
  }

  /**
   * Import all agents from a division
   */
  async importDivision(division: string): Promise<ImportHistory> {
    logger.info({ division }, 'Starting division import');
    
    const importId = generateId();
    let agentsImported = 0;
    let agentsUpdated = 0;

    try {
      const agentFiles = await this.fetchDivisionAgents(division);
      logger.info({ division, count: agentFiles.length }, 'Found agents to import');

      for (const filename of agentFiles) {
        try {
          const content = await this.fetchAgentMarkdown(division, filename);
          const parsed = this.parseAgentMarkdown(content, filename, division);
          
          // Save to workspace
          this.saveAgentToWorkspace(parsed);
          
          // Import to database
          const result = this.importAgentToDb(parsed);
          
          if (result.isNew) {
            agentsImported++;
          } else {
            agentsUpdated++;
          }

          logger.info({ 
            slug: parsed.slug, 
            name: parsed.name, 
            isNew: result.isNew 
          }, 'Agent imported');

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          logger.error({ error, filename }, 'Failed to import agent');
        }
      }

      // Record import history
      const historyStmt = db.prepare(`
        INSERT INTO import_history (id, source, source_url, agents_imported, agents_updated, division, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      historyStmt.run(
        importId,
        'agency-agents',
        `${AGENCY_AGENTS_BASE_URL}/${division}`,
        agentsImported,
        agentsUpdated,
        division,
        JSON.stringify({ files: agentFiles })
      );

      logger.info({ 
        division, 
        imported: agentsImported, 
        updated: agentsUpdated 
      }, 'Division import completed');

      return {
        id: importId,
        source: 'agency-agents',
        sourceUrl: `${AGENCY_AGENTS_BASE_URL}/${division}`,
        agentsImported,
        agentsUpdated,
        division,
        metadata: { files: agentFiles },
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error({ error, division }, 'Failed to import division');
      throw error;
    }
  }

  /**
   * Get all available divisions from repository
   */
  async getAvailableDivisions(): Promise<string[]> {
    const url = AGENCY_AGENTS_API_URL;
    
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Autonomous-AI-Startup'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch divisions: ${response.status}`);
      }

      const contents = await response.json() as Array<{ name: string; type: string }>;
      return contents
        .filter(item => item.type === 'dir' && DIVISION_MAP[item.name])
        .map(item => item.name);
    } catch (error) {
      logger.error({ error }, 'Failed to fetch divisions');
      throw error;
    }
  }

  /**
   * Get import history
   */
  getImportHistory(limit = 20): ImportHistory[] {
    const stmt = db.prepare(`
      SELECT * FROM import_history 
      ORDER BY created_at DESC 
      LIMIT ?
    `);

    const rows = stmt.all(limit) as Array<{
      id: string;
      source: string;
      source_url: string | null;
      agents_imported: number;
      agents_updated: number;
      division: string | null;
      metadata: string;
      created_at: string;
    }>;

    return rows.map(row => ({
      id: row.id,
      source: row.source,
      sourceUrl: row.source_url || undefined,
      agentsImported: row.agents_imported,
      agentsUpdated: row.agents_updated,
      division: row.division || undefined,
      metadata: JSON.parse(row.metadata),
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Get agents by division
   */
  getAgentsByDivision(division: string): Agent[] {
    const stmt = db.prepare('SELECT * FROM agents WHERE division = ?');
    const rows = stmt.all(division) as AgentRow[];
    return rows.map(this.rowToAgent);
  }

  /**
   * Get agents by source
   */
  getAgentsBySource(source: AgentSource): Agent[] {
    const stmt = db.prepare('SELECT * FROM agents WHERE source = ?');
    const rows = stmt.all(source) as AgentRow[];
    return rows.map(this.rowToAgent);
  }

  /**
   * Convert database row to Agent
   */
  private rowToAgent(row: AgentRow): Agent {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      emoji: row.emoji,
      color: row.color,
      division: row.division as AgentDivision,
      specialization: row.specialization || undefined,
      source: (row.source || 'local') as AgentSource,
      sourceUrl: row.source_url || undefined,
      status: row.status as Agent['status'],
      capabilities: JSON.parse(row.capabilities || '[]'),
      technicalSkills: JSON.parse(row.technical_skills || '[]'),
      personalityTraits: JSON.parse(row.personality_traits || '[]'),
      systemPrompt: row.system_prompt,
      workspacePath: row.workspace_path || undefined,
      model: JSON.parse(row.model_config || '{"primary":"claude-3-opus","fallbacks":[]}'),
      metrics: JSON.parse(row.metrics || '{"tasksCompleted":0,"successRate":0,"avgResponseTime":0}'),
      dependencies: JSON.parse(row.dependencies || '[]'),
      collaborationStyle: row.collaboration_style || undefined,
      lastHeartbeat: row.last_heartbeat ? new Date(row.last_heartbeat) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// Singleton instance
let importerInstance: AgentImporter | null = null;

export function getAgentImporter(): AgentImporter {
  if (!importerInstance) {
    importerInstance = new AgentImporter();
  }
  return importerInstance;
}

// Export for direct use
export { DIVISION_MAP, DIVISION_COLORS, AGENT_EMOJI_MAP };
