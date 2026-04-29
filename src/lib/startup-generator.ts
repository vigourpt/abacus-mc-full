import db from './db';
import { generateId, slugify } from './utils';
import { createChildLogger } from './logger';
import type { Task, TaskPriority, AgentDivision } from '@/types';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

const logger = createChildLogger('startup-generator');

// Pipeline configuration types
interface PipelineTask {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  estimatedHours: number;
  agentRoles: string[];
  dependencies?: string[];
  deliverables: string[];
  tags: string[];
}

interface PipelinePhase {
  id: string;
  name: string;
  description: string;
  order: number;
  tasks: PipelineTask[];
}

interface PipelineConfig {
  name: string;
  version: string;
  description: string;
  phases: PipelinePhase[];
  agentMapping: Record<string, string>;
  projectStructure: string[];
}

// Generated project structure
export interface GeneratedProject {
  id: string;
  name: string;
  slug: string;
  idea: string;
  createdAt: string;
  phases: GeneratedPhase[];
  tasks: Task[];
}

export interface GeneratedPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  taskIds: string[];
}

/**
 * StartupGenerator - Generates a complete startup project from an idea
 */
export class StartupGenerator {
  private pipelineConfig: PipelineConfig | null = null;

  /**
   * Load the pipeline configuration from YAML
   */
  loadPipelineConfig(): PipelineConfig {
    if (this.pipelineConfig) {
      return this.pipelineConfig;
    }

    const configPath = path.join(process.cwd(), 'config', 'startup_pipeline.yaml');
    
    if (!fs.existsSync(configPath)) {
      logger.error({ configPath }, 'Pipeline config not found');
      throw new Error('Pipeline configuration file not found');
    }

    const configContent = fs.readFileSync(configPath, 'utf-8');
    this.pipelineConfig = yaml.load(configContent) as PipelineConfig;
    
    logger.info({ config: this.pipelineConfig.name }, 'Loaded pipeline config');
    return this.pipelineConfig;
  }

  /**
   * Find the best matching agent for a role
   */
  findAgentForRole(role: string, division: string): string | null {
    // First try to find by role name (slug match)
    const byRole = db.prepare(`
      SELECT id FROM agents 
      WHERE slug LIKE ? OR name LIKE ?
      AND status != 'offline'
      ORDER BY 
        CASE WHEN division = ? THEN 0 ELSE 1 END,
        tasks_completed DESC
      LIMIT 1
    `).get(`%${role}%`, `%${role}%`, division) as { id: string } | undefined;

    if (byRole) {
      return byRole.id;
    }

    // Fall back to finding by division
    const byDivision = db.prepare(`
      SELECT id FROM agents 
      WHERE division = ?
      AND status != 'offline'
      ORDER BY tasks_completed DESC
      LIMIT 1
    `).get(division) as { id: string } | undefined;

    return byDivision?.id || null;
  }

  /**
   * Generate a startup project from an idea
   */
  async generateStartup(idea: string, projectName?: string): Promise<GeneratedProject> {
    const config = this.loadPipelineConfig();
    
    // Generate project metadata
    const projectId = generateId();
    const name = projectName || this.generateProjectName(idea);
    const slug = slugify(name);
    const createdAt = new Date();
    const createdAtISO = createdAt.toISOString();

    logger.info({ projectName: name, projectId }, 'Generating startup project');

    // Create project directory
    const projectDir = path.join(process.cwd(), 'projects', slug);
    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    // Create project brief
    const briefContent = this.generateBrief(idea, name, createdAtISO);
    fs.writeFileSync(path.join(projectDir, 'brief.md'), briefContent);

    // Generate tasks from pipeline phases
    const allTasks: Task[] = [];
    const phases: GeneratedPhase[] = [];
    const taskIdMap: Record<string, string> = {}; // Map template task IDs to actual task IDs

    for (const phase of config.phases) {
      const phaseTaskIds: string[] = [];

      for (const templateTask of phase.tasks) {
        const taskId = generateId();
        taskIdMap[templateTask.id] = taskId;

        // Resolve dependencies to actual task IDs
        const dependencies = (templateTask.dependencies || [])
          .map(depId => taskIdMap[depId])
          .filter(Boolean);

        // Find agent for this task
        const primaryRole = templateTask.agentRoles[0];
        const division = config.agentMapping[primaryRole] || 'engineering';
        const agentId = this.findAgentForRole(primaryRole, division);

        // Create task with project context
        const task: Task = {
          id: taskId,
          title: `[${name}] ${templateTask.title}`,
          description: this.enrichDescription(templateTask.description, idea, name),
          status: dependencies.length === 0 ? 'todo' : 'backlog',
          priority: templateTask.priority,
          assignedTo: agentId || undefined,
          createdAt: createdAtISO,
          updatedAt: createdAtISO,
          subtasks: [],
          dependencies,
          estimatedHours: templateTask.estimatedHours,
          tags: [...templateTask.tags, slug, `phase-${phase.id}`],
          context: {
            projectId,
            projectName: name,
            projectSlug: slug,
            phaseId: phase.id,
            phaseName: phase.name,
            deliverables: templateTask.deliverables,
            idea,
          },
        };

        // Insert task into database
        this.insertTask(task);
        allTasks.push(task);
        phaseTaskIds.push(taskId);

        // Create task dependencies in DB
        for (const depId of dependencies) {
          db.prepare(`
            INSERT INTO task_dependencies (id, task_id, depends_on_id, dependency_type, created_at)
            VALUES (?, ?, ?, 'finish_to_start', ?)
          `).run(generateId(), taskId, depId, createdAtISO);
        }

        logger.info({ taskTitle: templateTask.title, taskId }, 'Created task');
      }

      phases.push({
        id: phase.id,
        name: phase.name,
        description: phase.description,
        order: phase.order,
        taskIds: phaseTaskIds,
      });
    }

    // Log activity
    db.prepare(`
      INSERT INTO activity_log (id, type, message, metadata, created_at)
      VALUES (?, 'project_created', ?, ?, ?)
    `).run(
      generateId(),
      `Startup project "${name}" generated from idea`,
      JSON.stringify({ projectId, projectName: name, taskCount: allTasks.length }),
      createdAtISO
    );

    const project: GeneratedProject = {
      id: projectId,
      name,
      slug,
      idea,
      createdAt: createdAtISO,
      phases,
      tasks: allTasks,
    };

    logger.info({ taskCount: allTasks.length, phaseCount: phases.length }, 'Generated tasks across phases');

    return project;
  }

  /**
   * Insert a task into the database
   */
  private insertTask(task: Task): void {
    db.prepare(`
      INSERT INTO tasks (
        id, title, description, status, priority, assigned_to,
        created_at, updated_at, subtasks, dependencies,
        estimated_hours, tags, context
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      task.id,
      task.title,
      task.description,
      task.status,
      task.priority,
      task.assignedTo || null,
      task.createdAt,
      task.updatedAt,
      JSON.stringify(task.subtasks),
      JSON.stringify(task.dependencies),
      task.estimatedHours || null,
      JSON.stringify(task.tags),
      JSON.stringify(task.context || {})
    );
  }

  /**
   * Generate a project name from the idea
   */
  private generateProjectName(idea: string): string {
    // Extract key words and create a name
    const words = idea
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !['that', 'this', 'with', 'from', 'will', 'have', 'been'].includes(w))
      .slice(0, 3);

    if (words.length === 0) {
      return `Startup-${Date.now().toString(36)}`;
    }

    return words
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join('');
  }

  /**
   * Generate the project brief markdown
   */
  private generateBrief(idea: string, name: string, createdAt: string): string {
    return `# ${name} - Project Brief

## Overview

**Created:** ${new Date(createdAt).toLocaleDateString()}

## The Idea

${idea}

## Vision

This project was generated by the Autonomous AI Startup Architecture to transform the above idea into a fully realized startup.

## Pipeline Phases

1. **Product Definition** - Market research, product specification, user stories
2. **Design** - UX design, UI design system, wireframes
3. **Build** - Technical architecture, backend & frontend development
4. **Marketing** - Brand messaging, SEO strategy, growth plan

## Goals

- Validate market opportunity
- Define clear product vision
- Create compelling user experience
- Build robust technical foundation
- Develop go-to-market strategy

## Success Metrics

- [ ] Market analysis complete
- [ ] Product specification approved
- [ ] Design system established
- [ ] Architecture defined
- [ ] MVP features identified
- [ ] Launch plan created

---

*Generated by The Autonomous AI Startup Architecture*
`;
  }

  /**
   * Enrich task description with project context
   */
  private enrichDescription(description: string, idea: string, projectName: string): string {
    return `${description}

**Project:** ${projectName}
**Core Idea:** ${idea}`;
  }

  /**
   * Get pipeline configuration summary
   */
  getPipelineSummary(): { phases: number; tasks: number; estimatedHours: number } {
    const config = this.loadPipelineConfig();
    let totalTasks = 0;
    let totalHours = 0;

    for (const phase of config.phases) {
      totalTasks += phase.tasks.length;
      totalHours += phase.tasks.reduce((sum, t) => sum + t.estimatedHours, 0);
    }

    return {
      phases: config.phases.length,
      tasks: totalTasks,
      estimatedHours: totalHours,
    };
  }
}

// Singleton instance
let generatorInstance: StartupGenerator | null = null;

export function getStartupGenerator(): StartupGenerator {
  if (!generatorInstance) {
    generatorInstance = new StartupGenerator();
  }
  return generatorInstance;
}
