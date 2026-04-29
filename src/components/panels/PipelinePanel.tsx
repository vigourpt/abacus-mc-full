'use client';

import { useState, useMemo } from 'react';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import type { Task, Agent, TaskStatus } from '@/types';

// Pipeline stage definitions
interface PipelineStage {
  id: string;
  name: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
}

const PIPELINE_STAGES: PipelineStage[] = [
  {
    id: 'planner',
    name: 'Planner',
    icon: '🎯',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    description: 'Planning & Analysis',
  },
  {
    id: 'tasks',
    name: 'Tasks',
    icon: '📋',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    description: 'Queued & Backlog',
  },
  {
    id: 'agents',
    name: 'Agents',
    icon: '🤖',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    description: 'Active Execution',
  },
  {
    id: 'results',
    name: 'Results',
    icon: '✨',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    description: 'Review & Complete',
  },
];

// Map task statuses to pipeline stages
const STATUS_TO_STAGE: Record<TaskStatus, string> = {
  inbox: 'planner',
  backlog: 'tasks',
  todo: 'tasks',
  in_progress: 'agents',
  review: 'results',
  done: 'results',
  blocked: 'tasks',
};

// Priority colors
const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-500',
};

export function PipelinePanel() {
  const { tasks, agents } = useAppStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');

  // Group tasks by pipeline stage
  const tasksByStage = useMemo(() => {
    const grouped: Record<string, Task[]> = {
      planner: [],
      tasks: [],
      agents: [],
      results: [],
    };

    tasks.forEach((task) => {
      const stage = STATUS_TO_STAGE[task.status];
      if (stage && grouped[stage]) {
        grouped[stage].push(task);
      }
    });

    return grouped;
  }, [tasks]);

  // Get agent map for quick lookup
  const agentMap = useMemo(() => {
    const map: Record<string, Agent> = {};
    agents.forEach((agent) => {
      map[agent.id] = agent;
    });
    return map;
  }, [agents]);

  // Calculate metrics
  const metrics = useMemo(() => {
    const total = tasks.length;
    const completed = tasks.filter((t) => t.status === 'done').length;
    const inProgress = tasks.filter((t) => t.status === 'in_progress').length;
    const blocked = tasks.filter((t) => t.status === 'blocked').length;
    const avgCompletionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    // Calculate average execution time for completed tasks
    const completedTasks = tasks.filter((t) => t.status === 'done' && t.completedAt && t.startedAt);
    let avgExecutionTime = 0;
    if (completedTasks.length > 0) {
      const totalTime = completedTasks.reduce((acc, task) => {
        const start = new Date(task.startedAt!).getTime();
        const end = new Date(task.completedAt!).getTime();
        return acc + (end - start);
      }, 0);
      avgExecutionTime = Math.round(totalTime / completedTasks.length / (1000 * 60)); // in minutes
    }

    return {
      total,
      completed,
      inProgress,
      blocked,
      avgCompletionRate,
      avgExecutionTime,
      activeAgents: agents.filter((a) => a.status === 'active' || a.status === 'busy').length,
    };
  }, [tasks, agents]);

  // Filter tasks
  const filteredTasksByStage = useMemo(() => {
    const filtered: Record<string, Task[]> = {};
    
    Object.entries(tasksByStage).forEach(([stage, stageTasks]) => {
      filtered[stage] = stageTasks.filter((task) => {
        if (filterStatus !== 'all' && task.status !== filterStatus) return false;
        if (filterProject !== 'all' && !task.tags.includes(filterProject)) return false;
        return true;
      });
    });

    return filtered;
  }, [tasksByStage, filterStatus, filterProject]);

  // Get unique projects/tags
  const projects = useMemo(() => {
    const tags = new Set<string>();
    tasks.forEach((task) => {
      task.tags.forEach((tag) => tags.add(tag));
    });
    return Array.from(tags);
  }, [tasks]);

  return (
    <div className="h-full flex flex-col bg-gray-950">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span className="text-2xl">🔄</span>
              Task Pipeline
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Real-time visualization of task flow through the system
            </p>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-3">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
            >
              <option value="all">All Statuses</option>
              <option value="inbox">Inbox</option>
              <option value="backlog">Backlog</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
              <option value="blocked">Blocked</option>
            </select>
            
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white"
            >
              <option value="all">All Projects</option>
              {projects.map((project) => (
                <option key={project} value={project}>
                  {project}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Metrics Summary */}
        <div className="grid grid-cols-6 gap-3">
          <MetricCard label="Total Tasks" value={metrics.total} icon="📊" />
          <MetricCard label="In Progress" value={metrics.inProgress} icon="⚡" color="yellow" />
          <MetricCard label="Completed" value={metrics.completed} icon="✅" color="green" />
          <MetricCard label="Blocked" value={metrics.blocked} icon="🚫" color="red" />
          <MetricCard label="Completion Rate" value={`${metrics.avgCompletionRate}%`} icon="📈" color="purple" />
          <MetricCard label="Active Agents" value={metrics.activeAgents} icon="🤖" color="cyan" />
        </div>
      </div>

      {/* Pipeline Visualization */}
      <div className="flex-1 overflow-hidden p-4">
        <div className="h-full flex gap-4">
          {/* Pipeline Stages */}
          {PIPELINE_STAGES.map((stage, index) => (
            <div key={stage.id} className="flex-1 flex flex-col min-w-0">
              {/* Stage Header */}
              <div
                className={cn(
                  'flex-shrink-0 rounded-t-lg p-3 border-t-2',
                  stage.bgColor,
                  stage.borderColor.replace('/30', '')
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{stage.icon}</span>
                    <div>
                      <h3 className={cn('font-semibold', stage.color)}>{stage.name}</h3>
                      <p className="text-xs text-gray-500">{stage.description}</p>
                    </div>
                  </div>
                  <span className={cn('text-lg font-bold', stage.color)}>
                    {filteredTasksByStage[stage.id]?.length || 0}
                  </span>
                </div>
              </div>

              {/* Arrow between stages */}
              {index < PIPELINE_STAGES.length - 1 && (
                <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 z-10 hidden xl:block">
                  <div className="text-gray-600 text-2xl">→</div>
                </div>
              )}

              {/* Task List */}
              <div
                className={cn(
                  'flex-1 rounded-b-lg border border-t-0 p-2 overflow-y-auto',
                  stage.bgColor,
                  stage.borderColor
                )}
              >
                <div className="space-y-2">
                  {filteredTasksByStage[stage.id]?.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      agent={task.assignedTo ? agentMap[task.assignedTo] : undefined}
                      stageColor={stage.color}
                      onClick={() => setSelectedTask(task)}
                      isSelected={selectedTask?.id === task.id}
                    />
                  ))}
                  
                  {(!filteredTasksByStage[stage.id] || filteredTasksByStage[stage.id].length === 0) && (
                    <div className="text-center text-gray-500 py-8">
                      <span className="text-2xl opacity-50">{stage.icon}</span>
                      <p className="text-xs mt-2">No tasks</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Task Detail Sidebar */}
      {selectedTask && (
        <TaskDetailSidebar
          task={selectedTask}
          agent={selectedTask.assignedTo ? agentMap[selectedTask.assignedTo] : undefined}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Flow Indicator (Mobile-friendly) */}
      <div className="flex-shrink-0 border-t border-gray-800 p-2 xl:hidden">
        <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
          {PIPELINE_STAGES.map((stage, index) => (
            <div key={stage.id} className="flex items-center gap-2">
              <span className={cn('font-medium', stage.color)}>{stage.name}</span>
              {index < PIPELINE_STAGES.length - 1 && <span>→</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Metric Card Component
function MetricCard({
  label,
  value,
  icon,
  color = 'gray',
}: {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
}) {
  const colorClasses: Record<string, string> = {
    gray: 'bg-gray-800 border-gray-700',
    yellow: 'bg-yellow-500/10 border-yellow-500/30',
    green: 'bg-green-500/10 border-green-500/30',
    red: 'bg-red-500/10 border-red-500/30',
    purple: 'bg-purple-500/10 border-purple-500/30',
    cyan: 'bg-cyan-500/10 border-cyan-500/30',
    blue: 'bg-blue-500/10 border-blue-500/30',
  };

  return (
    <div className={cn('rounded-lg border px-3 py-2', colorClasses[color])}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div>
          <p className="text-lg font-bold text-white">{value}</p>
          <p className="text-xs text-gray-400">{label}</p>
        </div>
      </div>
    </div>
  );
}

// Task Card Component
function TaskCard({
  task,
  agent,
  stageColor,
  onClick,
  isSelected,
}: {
  task: Task;
  agent?: Agent;
  stageColor: string;
  onClick: () => void;
  isSelected: boolean;
}) {
  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-gray-800/80 rounded-lg p-3 cursor-pointer transition-all border',
        isSelected
          ? 'border-cyan-500 ring-1 ring-cyan-500'
          : 'border-gray-700 hover:border-gray-600',
        'hover:bg-gray-800'
      )}
    >
      {/* Priority Indicator */}
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-2 h-2 rounded-full', priorityColor)} title={task.priority} />
        <span className="text-xs text-gray-500 uppercase">{task.priority}</span>
        {task.status === 'blocked' && (
          <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Blocked</span>
        )}
      </div>

      {/* Task Title */}
      <h4 className="text-sm font-medium text-white truncate mb-2" title={task.title}>
        {task.title}
      </h4>

      {/* Description Preview */}
      {task.description && (
        <p className="text-xs text-gray-400 line-clamp-2 mb-2">{task.description}</p>
      )}

      {/* Agent Assignment */}
      {agent ? (
        <div className="flex items-center gap-2 text-xs">
          <span>{agent.emoji}</span>
          <span className={cn('truncate', stageColor)}>{agent.name}</span>
        </div>
      ) : (
        <div className="text-xs text-gray-500 italic">Unassigned</div>
      )}

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {task.tags.slice(0, 2).map((tag) => (
            <span
              key={tag}
              className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
          {task.tags.length > 2 && (
            <span className="text-xs text-gray-500">+{task.tags.length - 2}</span>
          )}
        </div>
      )}

      {/* Dependencies Indicator */}
      {task.dependencies.length > 0 && (
        <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
          <span>🔗</span>
          <span>{task.dependencies.length} dependencies</span>
        </div>
      )}

      {/* Subtasks Indicator */}
      {task.subtasks.length > 0 && (
        <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
          <span>📎</span>
          <span>{task.subtasks.length} subtasks</span>
        </div>
      )}
    </div>
  );
}

// Task Detail Sidebar
function TaskDetailSidebar({
  task,
  agent,
  onClose,
}: {
  task: Task;
  agent?: Agent;
  onClose: () => void;
}) {
  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  
  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-gray-900 border-l border-gray-800 shadow-xl z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-gray-900 border-b border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Task Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6">
        {/* Title & Priority */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <div className={cn('w-3 h-3 rounded-full', priorityColor)} />
            <span className="text-sm text-gray-400 capitalize">{task.priority} Priority</span>
          </div>
          <h3 className="text-xl font-bold text-white">{task.title}</h3>
        </div>

        {/* Status */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Status</label>
          <div className="mt-1">
            <StatusBadge status={task.status} />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Description</label>
          <p className="mt-1 text-gray-300 text-sm">{task.description || 'No description'}</p>
        </div>

        {/* Assigned Agent */}
        <div>
          <label className="text-xs text-gray-500 uppercase tracking-wide">Assigned To</label>
          {agent ? (
            <div className="mt-2 flex items-center gap-3 bg-gray-800 rounded-lg p-3">
              <span className="text-2xl">{agent.emoji}</span>
              <div>
                <p className="font-medium text-white">{agent.name}</p>
                <p className="text-xs text-gray-400">{agent.division}</p>
              </div>
              <div
                className={cn(
                  'ml-auto w-2 h-2 rounded-full',
                  agent.status === 'active' ? 'bg-green-500' : 'bg-gray-500'
                )}
              />
            </div>
          ) : (
            <p className="mt-1 text-gray-500 italic text-sm">Unassigned</p>
          )}
        </div>

        {/* Dependencies */}
        {task.dependencies.length > 0 && (
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Dependencies</label>
            <div className="mt-2 space-y-1">
              {task.dependencies.map((depId) => (
                <div key={depId} className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800 rounded px-2 py-1">
                  <span>🔗</span>
                  <span className="truncate">{depId}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Subtasks */}
        {task.subtasks.length > 0 && (
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Subtasks</label>
            <div className="mt-2 space-y-1">
              {task.subtasks.map((subtaskId) => (
                <div key={subtaskId} className="flex items-center gap-2 text-sm text-gray-300 bg-gray-800 rounded px-2 py-1">
                  <span>📎</span>
                  <span className="truncate">{subtaskId}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tags */}
        {task.tags.length > 0 && (
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Tags</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-sm bg-gray-700 text-gray-300 px-2 py-1 rounded"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Estimated Hours */}
        {task.estimatedHours && (
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Estimated Time</label>
            <p className="mt-1 text-gray-300">{task.estimatedHours} hours</p>
          </div>
        )}

        {/* Timestamps */}
        <div className="space-y-2">
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Created</label>
            <p className="text-sm text-gray-400">
              {new Date(task.createdAt).toLocaleString()}
            </p>
          </div>
          {task.startedAt && (
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Started</label>
              <p className="text-sm text-gray-400">
                {new Date(task.startedAt).toLocaleString()}
              </p>
            </div>
          )}
          {task.completedAt && (
            <div>
              <label className="text-xs text-gray-500 uppercase tracking-wide">Completed</label>
              <p className="text-sm text-gray-400">
                {new Date(task.completedAt).toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Output */}
        {task.actualOutput && (
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Output</label>
            <div className="mt-2 bg-gray-800 rounded-lg p-3">
              <pre className="text-xs text-gray-300 whitespace-pre-wrap overflow-x-auto">
                {task.actualOutput}
              </pre>
            </div>
          </div>
        )}

        {/* Quality Score */}
        {task.qualityScore !== undefined && (
          <div>
            <label className="text-xs text-gray-500 uppercase tracking-wide">Quality Score</label>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 bg-gray-700 rounded-full h-2">
                <div
                  className={cn(
                    'h-2 rounded-full',
                    task.qualityScore >= 80 ? 'bg-green-500' :
                    task.qualityScore >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                  )}
                  style={{ width: `${task.qualityScore}%` }}
                />
              </div>
              <span className="text-sm text-gray-300">{task.qualityScore}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: TaskStatus }) {
  const statusConfig: Record<TaskStatus, { label: string; color: string }> = {
    inbox: { label: 'Inbox', color: 'bg-blue-500/20 text-blue-400' },
    backlog: { label: 'Backlog', color: 'bg-gray-500/20 text-gray-400' },
    todo: { label: 'To Do', color: 'bg-yellow-500/20 text-yellow-400' },
    in_progress: { label: 'In Progress', color: 'bg-green-500/20 text-green-400' },
    review: { label: 'Review', color: 'bg-purple-500/20 text-purple-400' },
    done: { label: 'Done', color: 'bg-emerald-500/20 text-emerald-400' },
    blocked: { label: 'Blocked', color: 'bg-red-500/20 text-red-400' },
  };

  const config = statusConfig[status] || statusConfig.todo;

  return (
    <span className={cn('px-2 py-1 rounded text-sm font-medium', config.color)}>
      {config.label}
    </span>
  );
}
