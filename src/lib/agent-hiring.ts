// =====================================================
// Agent Hiring Logic Framework - Phase 2 Enhanced
// =====================================================
// Automatically creates new agents when tasks cannot
// be handled by existing agents. Integrates with the
// agent importer for template-based generation.

import db from './db';
import { createChildLogger } from './logger';
import { generateId, slugify } from './utils';
import { getAgentImporter, DIVISION_COLORS, AGENT_EMOJI_MAP } from './agent-importer';
import type { 
  Agent, 
  Task, 
  HiringRequest, 
  AgentCapability, 
  AgentRow, 
  TaskRow,
  AgentDivision,
  TaskPriority 
} from '@/types';

const logger = createChildLogger('agent-hiring');

// Enhanced Capability definitions for task analysis
const CAPABILITY_REGISTRY: AgentCapability[] = [
  // Engineering capabilities
  {
    id: 'frontend',
    name: 'Frontend Development',
    description: 'Web UI development with React, Vue, Angular',
    keywords: ['react', 'vue', 'angular', 'css', 'html', 'ui', 'component', 'frontend', 'tailwind', 'nextjs'],
    taskTypes: ['development'],
    requiredSkills: ['javascript', 'typescript', 'css'],
    complexity: 'medium',
    division: 'engineering',
  },
  {
    id: 'backend',
    name: 'Backend Development',
    description: 'Server-side development and APIs',
    keywords: ['api', 'server', 'database', 'backend', 'node', 'python', 'rest', 'graphql', 'microservices'],
    taskTypes: ['development'],
    requiredSkills: ['nodejs', 'python', 'sql'],
    complexity: 'high',
    division: 'engineering',
  },
  {
    id: 'devops',
    name: 'DevOps & Infrastructure',
    description: 'CI/CD, deployment, cloud infrastructure',
    keywords: ['deploy', 'ci', 'cd', 'docker', 'kubernetes', 'aws', 'cloud', 'infrastructure', 'terraform'],
    taskTypes: ['development', 'operations'],
    requiredSkills: ['docker', 'kubernetes', 'aws'],
    complexity: 'high',
    division: 'engineering',
  },
  {
    id: 'mobile',
    name: 'Mobile Development',
    description: 'iOS and Android app development',
    keywords: ['ios', 'android', 'mobile', 'react-native', 'flutter', 'swift', 'kotlin', 'app'],
    taskTypes: ['development'],
    requiredSkills: ['mobile', 'react-native', 'swift'],
    complexity: 'high',
    division: 'engineering',
  },
  {
    id: 'ai-ml',
    name: 'AI/ML Engineering',
    description: 'Machine learning and AI development',
    keywords: ['ai', 'ml', 'machine-learning', 'neural', 'model', 'training', 'llm', 'gpt', 'tensorflow'],
    taskTypes: ['development'],
    requiredSkills: ['python', 'tensorflow', 'pytorch'],
    complexity: 'high',
    division: 'engineering',
  },
  {
    id: 'security',
    name: 'Security Engineering',
    description: 'Security architecture and implementation',
    keywords: ['security', 'auth', 'authentication', 'encryption', 'vulnerability', 'penetration', 'threat'],
    taskTypes: ['development', 'operations'],
    requiredSkills: ['security', 'cryptography'],
    complexity: 'high',
    division: 'engineering',
  },
  {
    id: 'data-engineering',
    name: 'Data Engineering',
    description: 'Data pipelines and infrastructure',
    keywords: ['data', 'pipeline', 'etl', 'warehouse', 'analytics', 'spark', 'kafka', 'streaming'],
    taskTypes: ['development'],
    requiredSkills: ['sql', 'python', 'spark'],
    complexity: 'high',
    division: 'engineering',
  },

  // Marketing capabilities
  {
    id: 'content',
    name: 'Content Creation',
    description: 'Blog posts, social media, copywriting',
    keywords: ['content', 'blog', 'article', 'copy', 'write', 'post', 'social'],
    taskTypes: ['marketing'],
    requiredSkills: ['copywriting', 'seo'],
    complexity: 'medium',
    division: 'marketing',
  },
  {
    id: 'seo',
    name: 'Search Engine Optimization',
    description: 'SEO strategy and implementation',
    keywords: ['seo', 'search', 'ranking', 'keyword', 'organic', 'traffic', 'serp'],
    taskTypes: ['marketing'],
    requiredSkills: ['seo', 'analytics'],
    complexity: 'medium',
    division: 'marketing',
  },
  {
    id: 'paid-media',
    name: 'Paid Advertising',
    description: 'PPC, social ads, programmatic',
    keywords: ['ads', 'ppc', 'advertising', 'paid', 'campaign', 'google-ads', 'facebook', 'meta'],
    taskTypes: ['marketing'],
    requiredSkills: ['google-ads', 'facebook-ads'],
    complexity: 'medium',
    division: 'paid-media',
  },
  {
    id: 'brand',
    name: 'Brand Strategy',
    description: 'Brand identity and positioning',
    keywords: ['brand', 'identity', 'positioning', 'messaging', 'voice', 'guidelines'],
    taskTypes: ['marketing'],
    requiredSkills: ['branding', 'strategy'],
    complexity: 'medium',
    division: 'marketing',
  },

  // Sales capabilities
  {
    id: 'sales-outreach',
    name: 'Sales Outreach',
    description: 'Lead generation and outbound sales',
    keywords: ['outreach', 'lead', 'prospect', 'cold', 'email', 'call', 'pipeline'],
    taskTypes: ['sales'],
    requiredSkills: ['crm', 'communication'],
    complexity: 'medium',
    division: 'sales',
  },
  {
    id: 'account-management',
    name: 'Account Management',
    description: 'Customer relationship management',
    keywords: ['account', 'customer', 'relationship', 'retention', 'upsell', 'renewal'],
    taskTypes: ['sales'],
    requiredSkills: ['crm', 'negotiation'],
    complexity: 'medium',
    division: 'sales',
  },

  // Design capabilities
  {
    id: 'ui-design',
    name: 'UI Design',
    description: 'Visual design and UI components',
    keywords: ['design', 'ui', 'visual', 'figma', 'sketch', 'mockup', 'interface'],
    taskTypes: ['design'],
    requiredSkills: ['figma', 'design'],
    complexity: 'medium',
    division: 'design',
  },
  {
    id: 'ux-research',
    name: 'UX Research',
    description: 'User experience research and testing',
    keywords: ['ux', 'research', 'user', 'usability', 'testing', 'interview', 'persona'],
    taskTypes: ['design'],
    requiredSkills: ['ux', 'research'],
    complexity: 'medium',
    division: 'design',
  },

  // Operations capabilities
  {
    id: 'finance',
    name: 'Financial Management',
    description: 'Budgeting, accounting, financial planning',
    keywords: ['budget', 'finance', 'accounting', 'revenue', 'cost', 'invoice', 'forecast'],
    taskTypes: ['operations'],
    requiredSkills: ['accounting', 'excel'],
    complexity: 'medium',
    division: 'operations',
  },
  {
    id: 'legal',
    name: 'Legal & Compliance',
    description: 'Contracts, compliance, regulatory',
    keywords: ['legal', 'contract', 'compliance', 'regulation', 'policy', 'terms', 'gdpr'],
    taskTypes: ['operations'],
    requiredSkills: ['legal', 'compliance'],
    complexity: 'high',
    division: 'operations',
  },
  {
    id: 'hr',
    name: 'Human Resources',
    description: 'Hiring, culture, employee management',
    keywords: ['hr', 'hiring', 'recruit', 'employee', 'culture', 'onboarding', 'performance'],
    taskTypes: ['operations'],
    requiredSkills: ['hr', 'recruiting'],
    complexity: 'medium',
    division: 'operations',
  },

  // Testing capabilities
  {
    id: 'qa',
    name: 'Quality Assurance',
    description: 'Testing and quality control',
    keywords: ['qa', 'test', 'quality', 'bug', 'regression', 'automation', 'e2e'],
    taskTypes: ['testing'],
    requiredSkills: ['testing', 'automation'],
    complexity: 'medium',
    division: 'testing',
  },
];

// Enhanced Agent templates for common roles
const AGENT_TEMPLATES: Record<string, Partial<Agent>> = {
  'frontend-developer': {
    name: 'Frontend Developer',
    emoji: '🎨',
    color: DIVISION_COLORS['engineering'],
    division: 'engineering',
    specialization: 'Frontend Development',
    capabilities: ['frontend', 'react', 'typescript', 'css', 'ui-components'],
    technicalSkills: ['react', 'typescript', 'tailwind', 'nextjs'],
    personalityTraits: ['detail-oriented', 'creative', 'collaborative'],
  },
  'backend-architect': {
    name: 'Backend Architect',
    emoji: '🏛️',
    color: DIVISION_COLORS['engineering'],
    division: 'engineering',
    specialization: 'Backend Architecture',
    capabilities: ['backend', 'api', 'database', 'nodejs', 'python'],
    technicalSkills: ['nodejs', 'python', 'postgresql', 'redis'],
    personalityTraits: ['analytical', 'systematic', 'thorough'],
  },
  'devops-engineer': {
    name: 'DevOps Automator',
    emoji: '🚀',
    color: DIVISION_COLORS['engineering'],
    division: 'engineering',
    specialization: 'DevOps & Infrastructure',
    capabilities: ['devops', 'ci-cd', 'docker', 'kubernetes', 'cloud'],
    technicalSkills: ['docker', 'kubernetes', 'terraform', 'aws'],
    personalityTraits: ['efficient', 'proactive', 'systematic'],
  },
  'mobile-developer': {
    name: 'Mobile App Builder',
    emoji: '📱',
    color: DIVISION_COLORS['engineering'],
    division: 'engineering',
    specialization: 'Mobile Development',
    capabilities: ['mobile', 'react-native', 'ios', 'android'],
    technicalSkills: ['react-native', 'swift', 'kotlin', 'flutter'],
    personalityTraits: ['innovative', 'user-focused', 'adaptable'],
  },
  'ai-engineer': {
    name: 'AI Engineer',
    emoji: '🤖',
    color: DIVISION_COLORS['engineering'],
    division: 'engineering',
    specialization: 'AI/ML Engineering',
    capabilities: ['ai-ml', 'machine-learning', 'llm', 'model-training'],
    technicalSkills: ['python', 'tensorflow', 'pytorch', 'langchain'],
    personalityTraits: ['analytical', 'innovative', 'research-oriented'],
  },
  'security-engineer': {
    name: 'Security Engineer',
    emoji: '🔐',
    color: DIVISION_COLORS['engineering'],
    division: 'engineering',
    specialization: 'Security Engineering',
    capabilities: ['security', 'authentication', 'encryption', 'penetration-testing'],
    technicalSkills: ['security', 'cryptography', 'owasp'],
    personalityTraits: ['vigilant', 'thorough', 'paranoid'],
  },
  'data-engineer': {
    name: 'Data Engineer',
    emoji: '📊',
    color: DIVISION_COLORS['engineering'],
    division: 'engineering',
    specialization: 'Data Engineering',
    capabilities: ['data-engineering', 'etl', 'pipeline', 'analytics'],
    technicalSkills: ['python', 'sql', 'spark', 'kafka'],
    personalityTraits: ['analytical', 'systematic', 'detail-oriented'],
  },
  'content-creator': {
    name: 'Content Creator',
    emoji: '✍️',
    color: DIVISION_COLORS['marketing'],
    division: 'marketing',
    specialization: 'Content Marketing',
    capabilities: ['content', 'copywriting', 'blog', 'social-media'],
    technicalSkills: ['copywriting', 'seo', 'cms'],
    personalityTraits: ['creative', 'articulate', 'empathetic'],
  },
  'seo-specialist': {
    name: 'SEO Specialist',
    emoji: '🔍',
    color: DIVISION_COLORS['marketing'],
    division: 'marketing',
    specialization: 'SEO',
    capabilities: ['seo', 'keyword-research', 'analytics', 'content-optimization'],
    technicalSkills: ['seo', 'google-analytics', 'ahrefs'],
    personalityTraits: ['analytical', 'patient', 'detail-oriented'],
  },
  'paid-media-specialist': {
    name: 'Paid Media Specialist',
    emoji: '💰',
    color: DIVISION_COLORS['paid-media'],
    division: 'paid-media',
    specialization: 'Paid Advertising',
    capabilities: ['paid-media', 'ppc', 'campaign-management', 'analytics'],
    technicalSkills: ['google-ads', 'facebook-ads', 'analytics'],
    personalityTraits: ['analytical', 'strategic', 'data-driven'],
  },
  'sales-rep': {
    name: 'Sales Representative',
    emoji: '🤝',
    color: DIVISION_COLORS['sales'],
    division: 'sales',
    specialization: 'Sales',
    capabilities: ['sales-outreach', 'lead-generation', 'crm', 'negotiation'],
    technicalSkills: ['crm', 'salesforce', 'hubspot'],
    personalityTraits: ['persuasive', 'resilient', 'relationship-focused'],
  },
  'ui-designer': {
    name: 'UI Designer',
    emoji: '🎨',
    color: DIVISION_COLORS['design'],
    division: 'design',
    specialization: 'UI Design',
    capabilities: ['ui-design', 'figma', 'visual-design', 'prototyping'],
    technicalSkills: ['figma', 'sketch', 'adobe-xd'],
    personalityTraits: ['creative', 'detail-oriented', 'aesthetic'],
  },
  'ux-researcher': {
    name: 'UX Researcher',
    emoji: '👤',
    color: DIVISION_COLORS['design'],
    division: 'design',
    specialization: 'UX Research',
    capabilities: ['ux-research', 'user-testing', 'personas', 'journey-mapping'],
    technicalSkills: ['user-research', 'usability-testing', 'analytics'],
    personalityTraits: ['empathetic', 'analytical', 'curious'],
  },
  'qa-engineer': {
    name: 'QA Engineer',
    emoji: '✅',
    color: DIVISION_COLORS['testing'],
    division: 'testing',
    specialization: 'Quality Assurance',
    capabilities: ['qa', 'test-automation', 'manual-testing', 'regression'],
    technicalSkills: ['selenium', 'cypress', 'jest', 'playwright'],
    personalityTraits: ['thorough', 'patient', 'systematic'],
  },
  'finance-manager': {
    name: 'Finance Manager',
    emoji: '💵',
    color: DIVISION_COLORS['operations'],
    division: 'operations',
    specialization: 'Finance',
    capabilities: ['finance', 'budgeting', 'accounting', 'reporting'],
    technicalSkills: ['excel', 'quickbooks', 'financial-modeling'],
    personalityTraits: ['precise', 'analytical', 'organized'],
  },
};

/**
 * Enhanced Agent Hiring Framework
 */
export class AgentHiringFramework {
  private importer = getAgentImporter();

  /**
   * Detect required capabilities from task with enhanced scoring
   */
  detectCapabilities(task: Task): { capabilities: string[]; scores: Record<string, number> } {
    const content = `${task.title} ${task.description}`.toLowerCase();
    const detected: string[] = [];
    const scores: Record<string, number> = {};

    for (const capability of CAPABILITY_REGISTRY) {
      const matchCount = capability.keywords.reduce(
        (count, keyword) => count + (content.includes(keyword) ? 1 : 0),
        0
      );

      if (matchCount >= 1) {
        const score = matchCount * (capability.complexity === 'high' ? 1.5 : 1);
        scores[capability.id] = score;
        
        if (matchCount >= 2) {
          detected.push(capability.id);
        }
      }
    }

    // Sort by score
    detected.sort((a, b) => (scores[b] || 0) - (scores[a] || 0));

    return { capabilities: detected, scores };
  }

  /**
   * Detect required division from task
   */
  detectDivision(task: Task): AgentDivision {
    const { capabilities } = this.detectCapabilities(task);
    
    if (capabilities.length === 0) {
      return 'engineering'; // Default
    }

    // Get divisions from capabilities
    const divisionCounts: Record<string, number> = {};
    
    for (const capId of capabilities) {
      const cap = CAPABILITY_REGISTRY.find(c => c.id === capId);
      if (cap?.division) {
        divisionCounts[cap.division] = (divisionCounts[cap.division] || 0) + 1;
      }
    }

    // Return most common division
    const sorted = Object.entries(divisionCounts).sort((a, b) => b[1] - a[1]);
    return (sorted[0]?.[0] as AgentDivision) || 'engineering';
  }

  /**
   * Check if existing agents can handle the task with enhanced matching
   */
  findMatchingAgents(requiredCapabilities: string[]): { agents: Agent[]; scores: Map<string, number> } {
    const stmt = db.prepare(`
      SELECT * FROM agents 
      WHERE status IN ('idle', 'active', 'busy')
      ORDER BY 
        CASE status WHEN 'idle' THEN 1 WHEN 'active' THEN 2 ELSE 3 END
    `);
    const rows = stmt.all() as AgentRow[];

    const matchingAgents: Agent[] = [];
    const scores = new Map<string, number>();

    for (const row of rows) {
      const agentCapabilities = JSON.parse(row.capabilities || '[]') as string[];
      const technicalSkills = JSON.parse(row.technical_skills || '[]') as string[];
      const allSkills = [...agentCapabilities, ...technicalSkills];

      let score = 0;
      let matchedCount = 0;

      for (const cap of requiredCapabilities) {
        const hasMatch = allSkills.some(
          skill => skill.toLowerCase().includes(cap) || cap.includes(skill.toLowerCase())
        );
        if (hasMatch) {
          matchedCount++;
          score += 10;
        }
      }

      // Calculate match percentage
      const matchPercentage = requiredCapabilities.length > 0 
        ? matchedCount / requiredCapabilities.length 
        : 0;

      // Availability bonus
      if (row.status === 'idle') {
        score += 20;
      } else if (row.status === 'active') {
        score += 10;
      }

      // Success rate bonus
      const metrics = JSON.parse(row.metrics || '{"successRate":0}');
      score += (metrics.successRate || 0) * 10;

      if (matchPercentage >= 0.4 || score >= 30) {
        matchingAgents.push(this.rowToAgent(row));
        scores.set(row.id, score);
      }
    }

    // Sort by score
    matchingAgents.sort((a, b) => (scores.get(b.id) || 0) - (scores.get(a.id) || 0));

    return { agents: matchingAgents, scores };
  }

  /**
   * Suggest new agent role based on task requirements
   */
  suggestAgentRole(requiredCapabilities: string[]): { role: string; confidence: number } {
    let bestMatch = 'frontend-developer';
    let bestScore = 0;

    for (const [role, template] of Object.entries(AGENT_TEMPLATES)) {
      const templateCaps = template.capabilities || [];
      const templateSkills = template.technicalSkills || [];
      const allTemplateSkills = [...templateCaps, ...templateSkills];

      const matchScore = requiredCapabilities.reduce((score, cap) => {
        const hasMatch = allTemplateSkills.some(
          tc => tc.toLowerCase().includes(cap) || cap.includes(tc.toLowerCase())
        );
        return score + (hasMatch ? 1 : 0);
      }, 0);

      if (matchScore > bestScore) {
        bestScore = matchScore;
        bestMatch = role;
      }
    }

    const confidence = requiredCapabilities.length > 0 
      ? bestScore / requiredCapabilities.length 
      : 0;

    return { role: bestMatch, confidence };
  }

  /**
   * Create hiring request for a new agent with enhanced details
   */
  createHiringRequest(
    taskId: string, 
    requiredCapabilities: string[],
    options?: { 
      priority?: TaskPriority; 
      justification?: string;
    }
  ): HiringRequest {
    const { role, confidence } = this.suggestAgentRole(requiredCapabilities);
    const division = this.detectDivision({ 
      capabilities: requiredCapabilities 
    } as unknown as Task);
    
    const id = generateId();
    const priority = options?.priority || (confidence > 0.7 ? 'high' : 'medium');
    const justification = options?.justification || 
      `No existing agent found with required capabilities: ${requiredCapabilities.join(', ')}`;

    const stmt = db.prepare(`
      INSERT INTO hiring_requests (
        id, task_id, required_capabilities, suggested_role, 
        suggested_division, priority, justification, status
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `);
    stmt.run(
      id, 
      taskId, 
      JSON.stringify(requiredCapabilities), 
      role,
      division,
      priority,
      justification
    );

    logger.info({
      id,
      taskId,
      suggestedRole: role,
      division,
      capabilities: requiredCapabilities,
      confidence,
    }, 'Hiring request created');

    return {
      id,
      taskId,
      requiredCapabilities,
      suggestedRole: role,
      suggestedDivision: division,
      priority,
      justification,
      status: 'pending',
      createdAt: new Date(),
    };
  }

  /**
   * Evaluate if a new agent should be hired with comprehensive analysis
   */
  async evaluateHiringNeed(task: Task): Promise<{
    needsHiring: boolean;
    existingAgents: Agent[];
    suggestedRole?: string;
    suggestedDivision?: AgentDivision;
    requiredCapabilities: string[];
    confidence: number;
    reason: string;
  }> {
    const { capabilities: requiredCapabilities, scores } = this.detectCapabilities(task);
    const { agents: existingAgents, scores: agentScores } = this.findMatchingAgents(requiredCapabilities);

    if (existingAgents.length > 0) {
      const bestAgent = existingAgents[0];
      const bestScore = agentScores.get(bestAgent.id) || 0;
      
      return {
        needsHiring: false,
        existingAgents,
        requiredCapabilities,
        confidence: Math.min(bestScore / 100, 1),
        reason: `Found ${existingAgents.length} matching agent(s). Best match: ${bestAgent.name}`,
      };
    }

    const { role, confidence } = this.suggestAgentRole(requiredCapabilities);
    const division = this.detectDivision(task);

    return {
      needsHiring: true,
      existingAgents: [],
      suggestedRole: role,
      suggestedDivision: division,
      requiredCapabilities,
      confidence,
      reason: `No existing agents can handle required capabilities: ${requiredCapabilities.join(', ')}`,
    };
  }

  /**
   * Create agent from template with full autonomous setup
   */
  async createAgentFromTemplate(
    templateKey: string,
    customizations?: Partial<Agent>
  ): Promise<Agent | null> {
    const template = AGENT_TEMPLATES[templateKey];
    if (!template) {
      logger.error({ templateKey }, 'Template not found');
      return null;
    }

    const id = generateId();
    const name = customizations?.name || template.name || 'New Agent';
    const slug = slugify(name);

    // Check if agent with this slug exists
    const existing = db.prepare('SELECT id FROM agents WHERE slug = ?').get(slug);
    if (existing) {
      logger.warn({ slug }, 'Agent with this slug already exists');
      // Append unique suffix
      const uniqueSlug = `${slug}-${id.substring(0, 8)}`;
      return this.createAgentFromTemplate(templateKey, {
        ...customizations,
        slug: uniqueSlug,
        name: `${name} (${id.substring(0, 4)})`,
      });
    }

    const agent: Agent = {
      id,
      name,
      slug: customizations?.slug || slug,
      description: customizations?.description || 
        `AI agent specializing in ${template.specialization || template.capabilities?.join(', ')}`,
      emoji: customizations?.emoji || template.emoji || '🤖',
      color: customizations?.color || template.color || '#6b7280',
      division: customizations?.division || template.division || 'engineering',
      specialization: customizations?.specialization || template.specialization,
      source: 'local',
      status: 'idle',
      capabilities: customizations?.capabilities || template.capabilities || [],
      technicalSkills: customizations?.technicalSkills || template.technicalSkills || [],
      personalityTraits: customizations?.personalityTraits || template.personalityTraits || [],
      systemPrompt: this.generateSystemPrompt(name, template),
      model: {
        primary: 'claude-3-opus',
        fallbacks: ['claude-3-sonnet'],
      },
      metrics: {
        tasksCompleted: 0,
        successRate: 0,
        avgResponseTime: 0,
      },
      dependencies: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Create workspace directory
    const workspacePath = this.importer.createAgentWorkspace(agent.slug);
    agent.workspacePath = workspacePath;

    // Generate soul.md file
    this.importer.saveAgentToWorkspace({
      name: agent.name,
      slug: agent.slug,
      description: agent.description,
      emoji: agent.emoji,
      color: agent.color,
      division: agent.division,
      specialization: agent.specialization,
      capabilities: agent.capabilities,
      technicalSkills: agent.technicalSkills,
      personalityTraits: agent.personalityTraits,
      systemPrompt: agent.systemPrompt,
      source: 'local',
    });

    // Insert into database
    const stmt = db.prepare(`
      INSERT INTO agents (
        id, name, slug, description, emoji, color, division, specialization,
        source, status, capabilities, technical_skills, personality_traits,
        system_prompt, workspace_path, model_config, metrics
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      agent.id,
      agent.name,
      agent.slug,
      agent.description,
      agent.emoji,
      agent.color,
      agent.division,
      agent.specialization || null,
      agent.source,
      agent.status,
      JSON.stringify(agent.capabilities),
      JSON.stringify(agent.technicalSkills),
      JSON.stringify(agent.personalityTraits),
      agent.systemPrompt,
      agent.workspacePath,
      JSON.stringify(agent.model),
      JSON.stringify(agent.metrics)
    );

    // Log activity
    const activityStmt = db.prepare(`
      INSERT INTO activity_log (id, type, agent_id, message, metadata)
      VALUES (?, 'agent_created', ?, ?, ?)
    `);
    activityStmt.run(
      generateId(),
      agent.id,
      `New agent created: ${agent.name}`,
      JSON.stringify({ templateKey, customizations })
    );

    logger.info({ id: agent.id, name: agent.name, slug: agent.slug }, 'New agent created');

    return agent;
  }

  /**
   * Generate comprehensive system prompt for new agent
   */
  private generateSystemPrompt(name: string, template: Partial<Agent>): string {
    const capabilities = template.capabilities || [];
    const skills = template.technicalSkills || [];
    const traits = template.personalityTraits || [];

    return `# ${name}

## Your Identity
You are ${name}, an AI agent ${template.specialization ? `specializing in ${template.specialization}` : 'with diverse capabilities'}.

${traits.length > 0 ? `You are ${traits.join(', ')}.` : ''}

## Core Mission
Execute tasks within your domain of expertise with precision, quality, and efficiency.
Work collaboratively with other agents when tasks require cross-functional expertise.

## Your Capabilities
${capabilities.map(c => `- ${c}`).join('\n')}

## Technical Skills
${skills.map(s => `- ${s}`).join('\n')}

## Critical Rules
1. Stay within your area of expertise - escalate when needed
2. Ask for clarification when requirements are unclear
3. Provide detailed, actionable outputs with examples
4. Report progress and blockers promptly
5. Collaborate with other agents when needed
6. Maintain quality standards at all times
7. Document your work and decisions
8. Consider edge cases and error handling

## Communication Style
- Be professional and concise
- Provide structured, well-organized responses
- Include relevant code examples when applicable
- Use appropriate technical terminology
- Explain complex concepts clearly

## Collaboration
When working with other agents:
- Share context and requirements clearly
- Respect other agents' expertise
- Coordinate on shared deliverables
- Escalate conflicts to the Task Planner
`;
  }

  /**
   * Autonomous agent creation - evaluate and create if needed
   */
  async autonomousHiring(task: Task): Promise<{
    created: boolean;
    agent?: Agent;
    hiringRequest?: HiringRequest;
    matchedAgents: Agent[];
    reason: string;
  }> {
    const evaluation = await this.evaluateHiringNeed(task);

    if (!evaluation.needsHiring) {
      return {
        created: false,
        matchedAgents: evaluation.existingAgents,
        reason: evaluation.reason,
      };
    }

    // For high-priority tasks or high confidence matches, auto-create
    const taskPriority = task.priority;
    const shouldAutoCreate = 
      taskPriority === 'critical' || 
      (taskPriority === 'high' && evaluation.confidence > 0.5) ||
      evaluation.confidence > 0.7;

    if (shouldAutoCreate && evaluation.suggestedRole) {
      const agent = await this.createAgentFromTemplate(evaluation.suggestedRole);
      
      if (agent) {
        return {
          created: true,
          agent,
          matchedAgents: [],
          reason: `Auto-created agent: ${agent.name} for ${task.title}`,
        };
      }
    }

    // Create hiring request for manual approval
    const hiringRequest = this.createHiringRequest(
      task.id,
      evaluation.requiredCapabilities,
      {
        priority: task.priority,
        justification: evaluation.reason,
      }
    );

    return {
      created: false,
      hiringRequest,
      matchedAgents: [],
      reason: `Hiring request created: ${evaluation.suggestedRole}`,
    };
  }

  /**
   * Approve hiring request and create agent
   */
  async approveHiring(requestId: string, approvedBy?: string): Promise<Agent | null> {
    const stmt = db.prepare('SELECT * FROM hiring_requests WHERE id = ?');
    const request = stmt.get(requestId) as {
      id: string;
      suggested_role: string;
      required_capabilities: string;
      status: string;
    } | undefined;

    if (!request || request.status !== 'pending') {
      logger.warn({ requestId }, 'Hiring request not found or not pending');
      return null;
    }

    const agent = await this.createAgentFromTemplate(request.suggested_role);

    if (agent) {
      const updateStmt = db.prepare(`
        UPDATE hiring_requests 
        SET status = 'completed', created_agent_id = ?, approved_by = ?
        WHERE id = ?
      `);
      updateStmt.run(agent.id, approvedBy || 'system', requestId);
      
      logger.info({ requestId, agentId: agent.id }, 'Hiring request approved');
    }

    return agent;
  }

  /**
   * Reject hiring request
   */
  rejectHiring(requestId: string, rejectedBy?: string): boolean {
    const stmt = db.prepare(`
      UPDATE hiring_requests 
      SET status = 'rejected', approved_by = ?
      WHERE id = ? AND status = 'pending'
    `);
    const result = stmt.run(rejectedBy || 'system', requestId);
    
    return result.changes > 0;
  }

  /**
   * Get all pending hiring requests
   */
  getPendingRequests(): HiringRequest[] {
    const stmt = db.prepare(`
      SELECT * FROM hiring_requests WHERE status = 'pending'
      ORDER BY 
        CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        created_at DESC
    `);
    const rows = stmt.all() as Array<{
      id: string;
      task_id: string;
      required_capabilities: string;
      suggested_role: string;
      suggested_division: string | null;
      priority: string;
      justification: string | null;
      status: string;
      created_agent_id: string | null;
      approved_by: string | null;
      created_at: string;
    }>;

    return rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      requiredCapabilities: JSON.parse(row.required_capabilities),
      suggestedRole: row.suggested_role,
      suggestedDivision: row.suggested_division as AgentDivision | undefined,
      priority: row.priority as TaskPriority,
      justification: row.justification || undefined,
      status: row.status as HiringRequest['status'],
      createdAgentId: row.created_agent_id || undefined,
      approvedBy: row.approved_by || undefined,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Get available templates
   */
  getAvailableTemplates(): Array<{ key: string; template: Partial<Agent> }> {
    return Object.entries(AGENT_TEMPLATES).map(([key, template]) => ({
      key,
      template,
    }));
  }

  /**
   * Convert row to Agent
   */
  private rowToAgent(row: AgentRow): Agent {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      emoji: row.emoji,
      color: row.color,
      division: row.division as Agent['division'],
      specialization: row.specialization || undefined,
      source: (row.source || 'local') as Agent['source'],
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
let hiringInstance: AgentHiringFramework | null = null;

export function getAgentHiringFramework(): AgentHiringFramework {
  if (!hiringInstance) {
    hiringInstance = new AgentHiringFramework();
  }
  return hiringInstance;
}

export { CAPABILITY_REGISTRY, AGENT_TEMPLATES };
