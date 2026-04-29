// =====================================================
// Task Planner Agent - Central Orchestrator/Director
// Phase 2 Enhanced - Multi-Agent Collaboration
// =====================================================
// Routes tasks to appropriate specialized agents based on
// task type, requirements, and agent availability.
// Supports multi-agent collaboration and task decomposition.

import db from './db';
import { createChildLogger } from './logger';
import { generateId } from './utils';
import { getAgentHiringFramework } from './agent-hiring';
import type { 
  Task, 
  Agent, 
  TaskAgentMatch, 
  AgentRow, 
  TaskRow,
  AgentDivision,
  TaskPriority,
  TaskStatus,
  AgentCollaboration,
  TaskDependency,
  DependencyType
} from '@/types';

const logger = createChildLogger('task-planner');

// Enhanced task type classifications
const TASK_PATTERNS: Record<string, string[]> = {
  strategic: [
    'strategy', 'vision', 'roadmap', 'decision', 'direction',
    'planning', 'objectives', 'goals', 'priorities', 'leadership',
    'initiative', 'business', 'market', 'competitive', 'expansion',
  ],
  development: [
    'code', 'build', 'develop', 'implement', 'api', 'database',
    'frontend', 'backend', 'deploy', 'bug', 'feature', 'refactor',
    'debug', 'test', 'architecture', 'integration', 'software',
    'mobile', 'web', 'app', 'system', 'infrastructure', 'devops',
  ],
  marketing: [
    'marketing', 'brand', 'content', 'social', 'campaign',
    'growth', 'seo', 'ads', 'promotion', 'audience', 'engagement',
    'viral', 'conversion', 'acquisition', 'awareness', 'blog',
  ],
  sales: [
    'sales', 'revenue', 'customer', 'deal', 'pipeline', 'lead',
    'prospect', 'close', 'pricing', 'negotiation', 'contract',
    'demo', 'pitch', 'quota', 'crm', 'outreach', 'account',
  ],
  operations: [
    'operations', 'process', 'efficiency', 'workflow', 'budget',
    'resource', 'schedule', 'logistics', 'compliance', 'hr',
    'finance', 'legal', 'admin', 'procurement', 'vendor',
  ],
  design: [
    'design', 'ui', 'ux', 'visual', 'prototype', 'mockup',
    'wireframe', 'user', 'interface', 'experience', 'figma',
  ],
  testing: [
    'test', 'qa', 'quality', 'automation', 'regression', 'e2e',
    'unit', 'integration', 'performance', 'load', 'stress',
  ],
  support: [
    'support', 'help', 'ticket', 'issue', 'customer', 'service',
    'troubleshoot', 'resolve', 'escalate', 'feedback',
  ],
};

// Division to agent slug mapping with priorities
const DIVISION_PRIORITIES: Record<string, string[]> = {
  strategic: ['ceo', 'task-planner'],
  development: ['developer', 'frontend-developer', 'backend-architect', 'devops-automator'],
  marketing: ['marketing', 'content-creator', 'seo-specialist'],
  sales: ['sales', 'sales-rep'],
  operations: ['operations', 'finance-manager'],
  design: ['ui-designer', 'ux-researcher'],
  testing: ['qa-engineer'],
  support: ['support'],
};

// Task complexity indicators
const COMPLEXITY_INDICATORS: Record<string, { keywords: string[]; multiplier: number }> = {
  high: {
    keywords: ['complex', 'critical', 'urgent', 'architecture', 'security', 'scale', 'migration', 'integration'],
    multiplier: 1.5,
  },
  medium: {
    keywords: ['moderate', 'standard', 'typical', 'normal', 'regular'],
    multiplier: 1.0,
  },
  low: {
    keywords: ['simple', 'basic', 'quick', 'minor', 'small', 'trivial'],
    multiplier: 0.7,
  },
};

// Collaboration triggers
const COLLABORATION_TRIGGERS = [
  { keywords: ['full-stack', 'fullstack', 'end-to-end', 'e2e'], divisions: ['engineering', 'design', 'testing'] },
  { keywords: ['launch', 'release', 'go-live'], divisions: ['engineering', 'marketing', 'operations'] },
  { keywords: ['rebrand', 'redesign'], divisions: ['design', 'marketing'] },
  { keywords: ['security-audit', 'compliance'], divisions: ['engineering', 'operations'] },
];

/**
 * Task Planner Agent - Central Orchestrator
 */
export class TaskPlanner {
  private agentId = 'task-planner';
  private hiringFramework = getAgentHiringFramework();

  /**
   * Analyze a task and determine the best agent(s) to handle it
   */
  async routeTask(task: Task): Promise<TaskAgentMatch[]> {
    logger.info({ taskId: task.id, title: task.title }, 'Routing task');

    // Analyze task content
    const taskType = this.classifyTask(task);
    const complexity = this.assessComplexity(task);
    
    logger.debug({ taskType, complexity }, 'Task classified');

    // Get available agents
    const agents = this.getAvailableAgents();
    
    // Score each agent for this task
    const matches = this.scoreAgents(task, taskType, complexity, agents);

    // Sort by match score
    matches.sort((a, b) => b.matchScore - a.matchScore);

    logger.info({
      taskId: task.id,
      topMatch: matches[0]?.agentName,
      matchCount: matches.length,
    }, 'Task routed');

    return matches;
  }

  /**
   * Classify task based on content analysis
   */
  private classifyTask(task: Task): string {
    const content = `${task.title} ${task.description}`.toLowerCase();
    const scores: Record<string, number> = {};

    for (const [type, patterns] of Object.entries(TASK_PATTERNS)) {
      scores[type] = patterns.reduce((score, pattern) => {
        return score + (content.includes(pattern) ? 1 : 0);
      }, 0);
    }

    // Find highest scoring type
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] || 'strategic';
  }

  /**
   * Assess task complexity
   */
  private assessComplexity(task: Task): { level: string; multiplier: number } {
    const content = `${task.title} ${task.description}`.toLowerCase();
    
    for (const [level, config] of Object.entries(COMPLEXITY_INDICATORS)) {
      const matchCount = config.keywords.filter(k => content.includes(k)).length;
      if (matchCount >= 1) {
        return { level, multiplier: config.multiplier };
      }
    }

    // Default based on priority
    const priorityMultipliers: Record<TaskPriority, number> = {
      critical: 1.5,
      high: 1.3,
      medium: 1.0,
      low: 0.8,
    };

    return { 
      level: 'medium', 
      multiplier: priorityMultipliers[task.priority] || 1.0 
    };
  }

  /**
   * Check if task requires multi-agent collaboration
   */
  requiresCollaboration(task: Task): { required: boolean; divisions: AgentDivision[] } {
    const content = `${task.title} ${task.description}`.toLowerCase();
    
    for (const trigger of COLLABORATION_TRIGGERS) {
      if (trigger.keywords.some(k => content.includes(k))) {
        return { 
          required: true, 
          divisions: trigger.divisions as AgentDivision[] 
        };
      }
    }

    return { required: false, divisions: [] };
  }

  /**
   * Get available agents from database with workload information
   */
  private getAvailableAgents(): Agent[] {
    const stmt = db.prepare(`
      SELECT a.*, 
        (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = a.id AND t.status IN ('todo', 'in_progress')) as active_tasks
      FROM agents a
      WHERE a.status IN ('idle', 'active', 'busy')
      ORDER BY 
        CASE a.status WHEN 'idle' THEN 1 WHEN 'active' THEN 2 ELSE 3 END,
        active_tasks ASC
    `);
    const rows = stmt.all() as (AgentRow & { active_tasks: number })[];
    return rows.map(row => this.rowToAgent(row));
  }

  /**
   * Get agent workload
   */
  getAgentWorkload(agentId: string): { 
    activeTasks: number; 
    pendingTasks: number; 
    completedToday: number 
  } {
    const activeStmt = db.prepare(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE assigned_to = ? AND status IN ('todo', 'in_progress')
    `);
    const pendingStmt = db.prepare(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE assigned_to = ? AND status = 'backlog'
    `);
    const completedStmt = db.prepare(`
      SELECT COUNT(*) as count FROM tasks 
      WHERE assigned_to = ? AND status = 'done' 
      AND date(completed_at) = date('now')
    `);

    const active = (activeStmt.get(agentId) as { count: number })?.count || 0;
    const pending = (pendingStmt.get(agentId) as { count: number })?.count || 0;
    const completed = (completedStmt.get(agentId) as { count: number })?.count || 0;

    return { activeTasks: active, pendingTasks: pending, completedToday: completed };
  }

  /**
   * Score agents for task matching with enhanced criteria
   */
  private scoreAgents(
    task: Task,
    taskType: string,
    complexity: { level: string; multiplier: number },
    agents: Agent[]
  ): TaskAgentMatch[] {
    const matches: TaskAgentMatch[] = [];
    const priorityAgents = DIVISION_PRIORITIES[taskType] || ['ceo'];
    const taskContent = `${task.title} ${task.description}`.toLowerCase();

    for (const agent of agents) {
      let score = 0;
      const matchedCapabilities: string[] = [];
      const reasons: string[] = [];

      // Priority agent bonus
      const priorityIndex = priorityAgents.indexOf(agent.slug);
      if (priorityIndex !== -1) {
        const bonus = (priorityAgents.length - priorityIndex) * 20;
        score += bonus;
        matchedCapabilities.push('priority_match');
        reasons.push(`Priority agent for ${taskType}`);
      }

      // Division matching
      if (this.divisionMatchesTaskType(agent.division, taskType)) {
        score += 15;
        matchedCapabilities.push('division_match');
        reasons.push(`Division: ${agent.division}`);
      }

      // Capability matching
      const allCapabilities = [...agent.capabilities, ...(agent.technicalSkills || [])];
      for (const capability of allCapabilities) {
        if (taskContent.includes(capability.toLowerCase())) {
          score += 10;
          matchedCapabilities.push(capability);
        }
      }

      // Task pattern matching
      const patterns = TASK_PATTERNS[taskType] || [];
      let patternMatches = 0;
      for (const pattern of patterns) {
        if (allCapabilities.some(c => c.toLowerCase().includes(pattern))) {
          patternMatches++;
        }
      }
      score += patternMatches * 5;

      // Availability bonus
      const workload = this.getAgentWorkload(agent.id);
      if (agent.status === 'idle' && workload.activeTasks === 0) {
        score += 25;
        reasons.push('Fully available');
      } else if (agent.status === 'idle') {
        score += 15;
        reasons.push('Available');
      } else if (workload.activeTasks < 3) {
        score += 10;
        reasons.push('Low workload');
      } else if (workload.activeTasks >= 5) {
        score -= 20;
        reasons.push('High workload');
      }

      // Success rate factor
      const successBonus = (agent.metrics.successRate || 0) * 15;
      score += successBonus;

      // Complexity factor
      score = Math.round(score * complexity.multiplier);

      // Specialization bonus
      if (agent.specialization && taskContent.includes(agent.specialization.toLowerCase())) {
        score += 20;
        matchedCapabilities.push('specialization_match');
        reasons.push(`Specialization: ${agent.specialization}`);
      }

      matches.push({
        agentId: agent.id,
        agentName: agent.name,
        matchScore: score,
        matchedCapabilities,
        confidence: score > 60 ? 'high' : score > 30 ? 'medium' : 'low',
        reason: reasons.join('; '),
      });
    }

    return matches;
  }

  /**
   * Check if division matches task type
   */
  private divisionMatchesTaskType(division: AgentDivision, taskType: string): boolean {
    const divisionTaskMap: Record<string, string[]> = {
      engineering: ['development'],
      design: ['design'],
      marketing: ['marketing'],
      sales: ['sales'],
      operations: ['operations', 'strategic'],
      testing: ['testing', 'development'],
      support: ['support'],
      executive: ['strategic'],
      'paid-media': ['marketing'],
      product: ['strategic', 'development'],
      'project-management': ['operations'],
    };

    return divisionTaskMap[division]?.includes(taskType) || false;
  }

  /**
   * Auto-assign task to best matching agent
   */
  async assignTask(taskId: string): Promise<string | null> {
    const taskStmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
    const taskRow = taskStmt.get(taskId) as TaskRow | undefined;

    if (!taskRow) {
      logger.error({ taskId }, 'Task not found');
      return null;
    }

    const task = this.rowToTask(taskRow);
    const matches = await this.routeTask(task);

    if (matches.length === 0 || matches[0].matchScore < 10) {
      // Try autonomous hiring
      logger.info({ taskId }, 'No suitable agent found, evaluating hiring need');
      
      const hiringResult = await this.hiringFramework.autonomousHiring(task);
      
      if (hiringResult.created && hiringResult.agent) {
        // Assign to newly created agent
        const updateStmt = db.prepare(`
          UPDATE tasks 
          SET assigned_to = ?, status = 'todo', updated_at = datetime('now') 
          WHERE id = ?
        `);
        updateStmt.run(hiringResult.agent.id, taskId);

        this.logActivity(
          taskId,
          hiringResult.agent.id,
          `Task assigned to newly created agent: ${hiringResult.agent.name}`
        );

        return hiringResult.agent.id;
      }

      logger.warn({ taskId }, 'No suitable agent found and no agent created');
      return null;
    }

    const bestMatch = matches[0];

    // Update task assignment
    const updateStmt = db.prepare(`
      UPDATE tasks 
      SET assigned_to = ?, status = 'todo', updated_at = datetime('now') 
      WHERE id = ?
    `);
    updateStmt.run(bestMatch.agentId, taskId);

    // Log activity
    this.logActivity(
      taskId,
      bestMatch.agentId,
      `Task assigned to ${bestMatch.agentName} (confidence: ${bestMatch.confidence}, score: ${bestMatch.matchScore})`
    );

    logger.info({
      taskId,
      agentId: bestMatch.agentId,
      score: bestMatch.matchScore,
      confidence: bestMatch.confidence,
    }, 'Task assigned');

    return bestMatch.agentId;
  }

  /**
   * Create multi-agent collaboration for complex task
   */
  async createCollaboration(
    taskId: string, 
    leadAgentId: string, 
    collaboratorIds: string[]
  ): Promise<AgentCollaboration> {
    const id = generateId();

    const stmt = db.prepare(`
      INSERT INTO agent_collaborations (id, task_id, lead_agent_id, collaborator_ids, status)
      VALUES (?, ?, ?, ?, 'active')
    `);
    stmt.run(id, taskId, leadAgentId, JSON.stringify(collaboratorIds));

    // Log activity
    this.logActivity(
      taskId,
      leadAgentId,
      `Collaboration created with ${collaboratorIds.length} collaborators`
    );

    // Send notifications to collaborators
    for (const collaboratorId of collaboratorIds) {
      this.sendCollaborationNotification(taskId, leadAgentId, collaboratorId);
    }

    return {
      id,
      taskId,
      leadAgentId,
      collaboratorIds,
      status: 'active',
      createdAt: new Date(),
    };
  }

  /**
   * Send collaboration notification
   */
  private sendCollaborationNotification(taskId: string, fromAgentId: string, toAgentId: string): void {
    const stmt = db.prepare(`
      INSERT INTO agent_messages (id, from_agent_id, to_agent_id, content, type, task_id)
      VALUES (?, ?, ?, ?, 'collaboration', ?)
    `);
    stmt.run(
      generateId(),
      fromAgentId,
      toAgentId,
      `You have been added as a collaborator on task ${taskId}`,
      taskId
    );
  }

  /**
   * Break down a complex task into subtasks with dependencies
   */
  async decomposeTasks(parentTaskId: string): Promise<Task[]> {
    const stmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
    const row = stmt.get(parentTaskId) as TaskRow | undefined;

    if (!row) {
      throw new Error('Parent task not found');
    }

    const parentTask = this.rowToTask(row);
    const taskType = this.classifyTask(parentTask);
    const complexity = this.assessComplexity(parentTask);

    // Generate subtasks based on task type and complexity
    const subtaskTemplates = this.getSubtaskTemplates(taskType, complexity.level);
    const createdSubtasks: Task[] = [];

    for (let i = 0; i < subtaskTemplates.length; i++) {
      const template = subtaskTemplates[i];
      const subtaskId = generateId();
      
      // Create subtask
      const insertStmt = db.prepare(`
        INSERT INTO tasks (
          id, title, description, status, priority, parent_task_id, 
          context, estimated_hours, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      insertStmt.run(
        subtaskId,
        `${template.title}: ${row.title.substring(0, 50)}`,
        `Subtask for: ${row.description}. ${template.description}`,
        'backlog',
        row.priority,
        parentTaskId,
        JSON.stringify({ parentTitle: row.title, phase: template.phase }),
        template.estimatedHours,
        JSON.stringify(template.tags)
      );

      // Create dependency on previous subtask if not first
      if (i > 0 && template.dependsOnPrevious) {
        const prevSubtaskId = createdSubtasks[i - 1].id;
        this.createTaskDependency(subtaskId, prevSubtaskId, 'finish_to_start');
      }

      createdSubtasks.push({
        id: subtaskId,
        title: `${template.title}: ${row.title.substring(0, 50)}`,
        description: `Subtask for: ${row.description}. ${template.description}`,
        status: 'backlog',
        priority: row.priority as TaskPriority,
        parentTaskId,
        subtasks: [],
        dependencies: i > 0 && template.dependsOnPrevious ? [createdSubtasks[i - 1].id] : [],
        context: { parentTitle: row.title, phase: template.phase },
        tags: template.tags,
        estimatedHours: template.estimatedHours,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    // Update parent task with subtask IDs
    const updateStmt = db.prepare(`
      UPDATE tasks SET subtasks = ?, updated_at = datetime('now') WHERE id = ?
    `);
    updateStmt.run(JSON.stringify(createdSubtasks.map(t => t.id)), parentTaskId);

    logger.info({
      parentTaskId,
      subtaskCount: createdSubtasks.length,
    }, 'Task decomposed');

    return createdSubtasks;
  }

  /**
   * Get subtask templates based on task type
   */
  private getSubtaskTemplates(
    taskType: string, 
    complexity: string
  ): Array<{
    title: string;
    description: string;
    phase: number;
    estimatedHours: number;
    tags: string[];
    dependsOnPrevious: boolean;
  }> {
    const templates: Record<string, typeof defaultTemplates> = {
      development: [
        { title: 'Requirements Analysis', description: 'Analyze and document requirements', phase: 1, estimatedHours: 2, tags: ['planning'], dependsOnPrevious: false },
        { title: 'Technical Design', description: 'Create technical design and architecture', phase: 2, estimatedHours: 4, tags: ['design', 'architecture'], dependsOnPrevious: true },
        { title: 'Implementation', description: 'Implement the core functionality', phase: 3, estimatedHours: 8, tags: ['development'], dependsOnPrevious: true },
        { title: 'Testing', description: 'Write and run tests', phase: 4, estimatedHours: 3, tags: ['testing', 'qa'], dependsOnPrevious: true },
        { title: 'Code Review', description: 'Review and refactor code', phase: 5, estimatedHours: 2, tags: ['review'], dependsOnPrevious: true },
        { title: 'Documentation', description: 'Document the implementation', phase: 6, estimatedHours: 1, tags: ['documentation'], dependsOnPrevious: false },
      ],
      marketing: [
        { title: 'Research', description: 'Market and audience research', phase: 1, estimatedHours: 3, tags: ['research'], dependsOnPrevious: false },
        { title: 'Strategy', description: 'Develop marketing strategy', phase: 2, estimatedHours: 2, tags: ['strategy'], dependsOnPrevious: true },
        { title: 'Content Creation', description: 'Create marketing content', phase: 3, estimatedHours: 5, tags: ['content'], dependsOnPrevious: true },
        { title: 'Campaign Setup', description: 'Set up and configure campaigns', phase: 4, estimatedHours: 2, tags: ['campaign'], dependsOnPrevious: true },
        { title: 'Launch & Monitor', description: 'Launch and monitor performance', phase: 5, estimatedHours: 2, tags: ['launch', 'analytics'], dependsOnPrevious: true },
      ],
      sales: [
        { title: 'Lead Qualification', description: 'Qualify and prioritize leads', phase: 1, estimatedHours: 2, tags: ['leads'], dependsOnPrevious: false },
        { title: 'Research', description: 'Research prospect needs', phase: 2, estimatedHours: 1, tags: ['research'], dependsOnPrevious: true },
        { title: 'Outreach', description: 'Initial contact and outreach', phase: 3, estimatedHours: 2, tags: ['outreach'], dependsOnPrevious: true },
        { title: 'Proposal', description: 'Prepare and present proposal', phase: 4, estimatedHours: 3, tags: ['proposal'], dependsOnPrevious: true },
        { title: 'Negotiation', description: 'Negotiate terms and close', phase: 5, estimatedHours: 2, tags: ['negotiation'], dependsOnPrevious: true },
      ],
      strategic: [
        { title: 'Analysis', description: 'Analyze current state and goals', phase: 1, estimatedHours: 3, tags: ['analysis'], dependsOnPrevious: false },
        { title: 'Options Evaluation', description: 'Evaluate strategic options', phase: 2, estimatedHours: 2, tags: ['evaluation'], dependsOnPrevious: true },
        { title: 'Planning', description: 'Develop execution plan', phase: 3, estimatedHours: 3, tags: ['planning'], dependsOnPrevious: true },
        { title: 'Stakeholder Alignment', description: 'Align with stakeholders', phase: 4, estimatedHours: 2, tags: ['communication'], dependsOnPrevious: true },
      ],
      design: [
        { title: 'User Research', description: 'Conduct user research', phase: 1, estimatedHours: 3, tags: ['research', 'ux'], dependsOnPrevious: false },
        { title: 'Wireframing', description: 'Create wireframes and flows', phase: 2, estimatedHours: 3, tags: ['wireframe'], dependsOnPrevious: true },
        { title: 'Visual Design', description: 'Create visual designs', phase: 3, estimatedHours: 5, tags: ['design', 'ui'], dependsOnPrevious: true },
        { title: 'Prototyping', description: 'Build interactive prototype', phase: 4, estimatedHours: 2, tags: ['prototype'], dependsOnPrevious: true },
        { title: 'Design Review', description: 'Review and iterate', phase: 5, estimatedHours: 2, tags: ['review'], dependsOnPrevious: true },
      ],
      operations: [
        { title: 'Process Mapping', description: 'Map current processes', phase: 1, estimatedHours: 2, tags: ['process'], dependsOnPrevious: false },
        { title: 'Gap Analysis', description: 'Identify gaps and improvements', phase: 2, estimatedHours: 2, tags: ['analysis'], dependsOnPrevious: true },
        { title: 'Solution Design', description: 'Design operational solution', phase: 3, estimatedHours: 3, tags: ['design'], dependsOnPrevious: true },
        { title: 'Implementation', description: 'Implement changes', phase: 4, estimatedHours: 4, tags: ['implementation'], dependsOnPrevious: true },
        { title: 'Monitoring', description: 'Monitor and optimize', phase: 5, estimatedHours: 2, tags: ['monitoring'], dependsOnPrevious: true },
      ],
    };

    const defaultTemplates = [
      { title: 'Planning', description: 'Plan the work', phase: 1, estimatedHours: 2, tags: ['planning'], dependsOnPrevious: false },
      { title: 'Execution', description: 'Execute the plan', phase: 2, estimatedHours: 5, tags: ['execution'], dependsOnPrevious: true },
      { title: 'Review', description: 'Review and finalize', phase: 3, estimatedHours: 1, tags: ['review'], dependsOnPrevious: true },
    ];

    const baseTemplates = templates[taskType] || defaultTemplates;
    
    // Adjust for complexity
    if (complexity === 'high') {
      return baseTemplates;
    } else if (complexity === 'low') {
      return baseTemplates.slice(0, 3);
    }
    return baseTemplates.slice(0, 4);
  }

  /**
   * Create task dependency
   */
  createTaskDependency(
    taskId: string, 
    dependsOnTaskId: string, 
    dependencyType: DependencyType = 'finish_to_start'
  ): TaskDependency {
    const id = generateId();

    const stmt = db.prepare(`
      INSERT OR IGNORE INTO task_dependencies (id, task_id, depends_on_task_id, dependency_type)
      VALUES (?, ?, ?, ?)
    `);
    stmt.run(id, taskId, dependsOnTaskId, dependencyType);

    // Update task dependencies array
    const updateStmt = db.prepare(`
      UPDATE tasks SET 
        dependencies = json_insert(COALESCE(dependencies, '[]'), '$[#]', ?),
        updated_at = datetime('now')
      WHERE id = ?
    `);
    updateStmt.run(dependsOnTaskId, taskId);

    return {
      id,
      taskId,
      dependsOnTaskId,
      dependencyType,
      createdAt: new Date(),
    };
  }

  /**
   * Get task dependencies
   */
  getTaskDependencies(taskId: string): TaskDependency[] {
    const stmt = db.prepare(`
      SELECT * FROM task_dependencies WHERE task_id = ?
    `);
    const rows = stmt.all(taskId) as Array<{
      id: string;
      task_id: string;
      depends_on_task_id: string;
      dependency_type: string;
      created_at: string;
    }>;

    return rows.map(row => ({
      id: row.id,
      taskId: row.task_id,
      dependsOnTaskId: row.depends_on_task_id,
      dependencyType: row.dependency_type as DependencyType,
      createdAt: new Date(row.created_at),
    }));
  }

  /**
   * Check if task can start based on dependencies
   */
  canTaskStart(taskId: string): { canStart: boolean; blockers: string[] } {
    const dependencies = this.getTaskDependencies(taskId);
    const blockers: string[] = [];

    for (const dep of dependencies) {
      if (dep.dependencyType === 'finish_to_start') {
        const depTaskStmt = db.prepare('SELECT status, title FROM tasks WHERE id = ?');
        const depTask = depTaskStmt.get(dep.dependsOnTaskId) as { status: string; title: string } | undefined;
        
        if (depTask && depTask.status !== 'done') {
          blockers.push(`Waiting for: ${depTask.title}`);
        }
      }
    }

    return { canStart: blockers.length === 0, blockers };
  }

  /**
   * Get priority queue of tasks ready to start
   */
  getPriorityQueue(agentId?: string): Task[] {
    let query = `
      SELECT t.* FROM tasks t
      WHERE t.status IN ('todo', 'backlog')
    `;
    
    if (agentId) {
      query += ` AND t.assigned_to = ?`;
    }

    query += `
      ORDER BY 
        CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END,
        t.due_date ASC NULLS LAST,
        t.created_at ASC
      LIMIT 20
    `;

    const stmt = db.prepare(query);
    const rows = (agentId ? stmt.all(agentId) : stmt.all()) as TaskRow[];

    // Filter tasks that can start
    return rows
      .map(row => this.rowToTask(row))
      .filter(task => {
        const { canStart } = this.canTaskStart(task.id);
        return canStart;
      });
  }

  /**
   * Balance workload across agents
   */
  async balanceWorkload(): Promise<{ reassigned: number; details: string[] }> {
    const details: string[] = [];
    let reassigned = 0;

    // Get all agents with their workloads
    const agentStmt = db.prepare(`
      SELECT a.id, a.name, a.status,
        (SELECT COUNT(*) FROM tasks t WHERE t.assigned_to = a.id AND t.status IN ('todo', 'in_progress')) as active_tasks
      FROM agents a
      WHERE a.status IN ('idle', 'active')
    `);
    const agents = agentStmt.all() as Array<{ id: string; name: string; status: string; active_tasks: number }>;

    // Find overloaded and underloaded agents
    const avgWorkload = agents.reduce((sum, a) => sum + a.active_tasks, 0) / agents.length || 1;
    const overloaded = agents.filter(a => a.active_tasks > avgWorkload * 1.5);
    const underloaded = agents.filter(a => a.active_tasks < avgWorkload * 0.5);

    for (const busy of overloaded) {
      const available = underloaded.find(a => a.active_tasks < avgWorkload);
      if (!available) continue;

      // Find a task to reassign
      const taskStmt = db.prepare(`
        SELECT id, title FROM tasks 
        WHERE assigned_to = ? AND status = 'todo'
        ORDER BY priority DESC
        LIMIT 1
      `);
      const task = taskStmt.get(busy.id) as { id: string; title: string } | undefined;

      if (task) {
        const updateStmt = db.prepare(`
          UPDATE tasks SET assigned_to = ?, updated_at = datetime('now') WHERE id = ?
        `);
        updateStmt.run(available.id, task.id);

        details.push(`Reassigned "${task.title}" from ${busy.name} to ${available.name}`);
        reassigned++;

        this.logActivity(task.id, available.id, `Task reassigned for workload balancing`);
      }
    }

    logger.info({ reassigned }, 'Workload balanced');

    return { reassigned, details };
  }

  /**
   * Log activity
   */
  private logActivity(taskId: string | null, agentId: string, message: string): void {
    const stmt = db.prepare(`
      INSERT INTO activity_log (id, type, agent_id, task_id, message)
      VALUES (?, 'task_planner', ?, ?, ?)
    `);
    stmt.run(generateId(), agentId, taskId, message);
  }

  /**
   * Convert database row to Agent
   */
  private rowToAgent(row: AgentRow & { active_tasks?: number }): Agent {
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

  /**
   * Convert database row to Task
   */
  private rowToTask(row: TaskRow): Task {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status as Task['status'],
      priority: row.priority as Task['priority'],
      assignedTo: row.assigned_to || undefined,
      createdBy: row.created_by || undefined,
      parentTaskId: row.parent_task_id || undefined,
      subtasks: JSON.parse(row.subtasks || '[]'),
      dependencies: JSON.parse(row.dependencies || '[]'),
      context: JSON.parse(row.context || '{}'),
      expectedOutput: row.expected_output || undefined,
      actualOutput: row.actual_output || undefined,
      qualityScore: row.quality_score || undefined,
      estimatedHours: row.estimated_hours || undefined,
      actualHours: row.actual_hours || undefined,
      tags: JSON.parse(row.tags || '[]'),
      dueDate: row.due_date ? new Date(row.due_date) : undefined,
      startedAt: row.started_at ? new Date(row.started_at) : undefined,
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}

// Singleton instance
let plannerInstance: TaskPlanner | null = null;

export function getTaskPlanner(): TaskPlanner {
  if (!plannerInstance) {
    plannerInstance = new TaskPlanner();
  }
  return plannerInstance;
}
