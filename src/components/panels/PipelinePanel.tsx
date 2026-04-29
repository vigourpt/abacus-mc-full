'use client';

import { useState, useMemo, DragEvent } from 'react';
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

// Reverse map - stage to status
const STAGE_TO_STATUS: Record<string, TaskStatus[]> = {
  planner: ['inbox'],
  tasks: ['backlog', 'todo', 'blocked'],
  agents: ['in_progress'],
  results: ['review', 'done'],
};

// Priority colors
const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-gray-500',
};

// Status display names
const STATUS_NAMES: Record<TaskStatus, string> = {
  inbox: 'Inbox',
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  done: 'Done',
  blocked: 'Blocked',
};

export function PipelinePanel() {
  const { tasks, agents, updateTask } = useAppStore();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterProject, setFilterProject] = useState<string>('all');
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

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
    
    const completedTasks = tasks.filter((t) => t.status === 'done' && t.completedAt && t.startedAt);
    let avgExecutionTime = 0;
    if (completedTasks.length > 0) {
      const totalTime = completedTasks.reduce((acc, task) => {
        const start = new Date(task.startedAt!).getTime();
        const end = new Date(task.completedAt!).getTime();
        return acc + (end - start);
      }, 0);
      avgExecutionTime = Math.round(totalTime / completedTasks.length / (1000 * 60));
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

  // Drag handlers
  function handleDragStart(e: DragEvent, task: Task) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', task.id);
    setDraggingTaskId(task.id);
  }

  function handleDragEnd() {
    setDraggingTaskId(null);
    setDragOverStage(null);
  }

  function handleDragOver(e: DragEvent, stageId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverStage(stageId);
  }

  function handleDragLeave() {
    setDragOverStage(null);
  }

  function handleDrop(e: DragEvent, targetStageId: string) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('text/plain');
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Find current stage of the task
    const currentStage = STATUS_TO_STAGE[task.status];
    if (currentStage === targetStageId) {
      // Same stage - no change needed
      setDraggingTaskId(null);
      setDragOverStage(null);
      return;
    }

    // Get the first status in the target stage
    const targetStatuses = STAGE_TO_STATUS[targetStageId];
    if (!targetStatuses || targetStatuses.length === 0) {
      setDraggingTaskId(null);
      setDragOverStage(null);
      return;
    }

    // Map to appropriate status based on target stage
    let newStatus: TaskStatus;
    switch (targetStageId) {
      case 'planner':
        newStatus = 'inbox';
        break;
      case 'tasks':
        newStatus = task.status === 'blocked' ? 'blocked' : 'backlog';
        break;
      case 'agents':
        newStatus = 'in_progress';
        break;
      case 'results':
        newStatus = task.status === 'done' ? 'done' : 'review';
        break;
      default:
        newStatus = task.status;
    }

    // Update the task status
    updateTask(taskId, { status: newStatus });
    
    setDraggingTaskId(null);
    setDragOverStage(null);
  }

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
              Drag tasks between stages to change their status
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
          {PIPELINE_STAGES.map((stage, index) => {
            const isDropTarget = dragOverStage === stage.id;
            
            return (
              <div
                key={stage.id}
                className="flex-1 flex flex-col min-w-0"
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {/* Stage Header */}
                <div
                  className={cn(
                    'flex-shrink-0 rounded-t-lg p-3 border-t-2 transition-all',
                    stage.bgColor,
                    isDropTarget ? 'scale-105 border-2 border-cyan-400' : stage.borderColor.replace('/30', '')
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
                  
                  {/* Drop indicator */}
                  {isDropTarget && (
                    <div className="mt-2 text-xs text-cyan-400 bg-cyan-500/20 rounded px-2 py-1 text-center">
                      Drop to move here
                    </div>
                  )}
                </div>

                {/* Task List */}
                <div
                  className={cn(
                    'flex-1 rounded-b-lg border border-t-0 p-2 overflow-y-auto transition-all',
                    stage.bgColor,
                    stage.borderColor,
                    isDropTarget && 'bg-cyan-500/10 border-cyan-500/50'
                  )}
                >
                  <div className="space-y-2">
                    {filteredTasksByStage[stage.id]?.map((task) => (
                      <DraggableTaskCard
                        key={task.id}
                        task={task}
                        agent={task.assignedTo ? agentMap[task.assignedTo] : undefined}
                        stageColor={stage.color}
                        onClick={() => setSelectedTask(task)}
                        isSelected={selectedTask?.id === task.id}
                        isDragging={draggingTaskId === task.id}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                      />
                    ))}
                    
                    {(!filteredTasksByStage[stage.id] || filteredTasksByStage[stage.id].length === 0) && (
                      <div className={cn(
                        'text-center text-gray-500 py-8 border-2 border-dashed rounded-lg',
                        isDropTarget && 'border-cyan-500/50 text-cyan-400'
                      )}>
                        <span className="text-2xl opacity-50">{stage.icon}</span>
                        <p className="text-xs mt-2">
                          {isDropTarget ? 'Drop here' : 'No tasks'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Task Detail Sidebar */}
      {selectedTask && (
        <TaskDetailSidebar
          task={selectedTask}
          agent={selectedTask.assignedTo ? agentMap[selectedTask.assignedTo] : undefined}
          onClose={() => setSelectedTask(null)}
          onStatusChange={(newStatus) => {
            updateTask(selectedTask.id, { status: newStatus });
            setSelectedTask(null);
          }}
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

// Draggable Task Card Component
function DraggableTaskCard({
  task,
  agent,
  stageColor,
  onClick,
  isSelected,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  agent?: Agent;
  stageColor: string;
  onClick: () => void;
  isSelected: boolean;
  isDragging: boolean;
  onDragStart: (e: DragEvent, task: Task) => void;
  onDragEnd: () => void;
}) {
  const priorityColor = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        'bg-gray-800/80 rounded-lg p-3 cursor-grab active:cursor-grabbing transition-all border',
        isSelected && 'border-cyan-500 ring-1 ring-cyan-500',
        isDragging && 'opacity-50 scale-95',
        'hover:bg-gray-800 hover:border-gray-600'
      )}
    >
      {/* Priority Indicator */}
      <div className="flex items-center gap-2 mb-2">
        <div className={cn('w-2 h-2 rounded-full', priorityColor)} title={task.priority} />
        <span className="text-xs text-gray-500 uppercase">{task.priority}</span>
        {task.status === 'blocked' && (
          <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">Blocked</span>
        )}
        <span className="ml-auto text-xs text-gray-600">⋮⋮</span>
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
          <span className="text-gray-300 truncate">{agent.name}</span>
        </div>
      ) : (
        <div className="text-xs text-gray-600">Unassigned</div>
      )}

      {/* Tags */}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {task.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span className="text-xs text-gray-500">+{task.tags.length - 3}</span>
          )}
        </div>
      )}
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

// Task Detail Sidebar
function TaskDetailSidebar({
  task,
  agent,
  onClose,
  onStatusChange,
}: {
  task: Task;
  agent?: Agent;
  onClose: () => void;
  onStatusChange: (status: TaskStatus) => void;
}) {
  const { updateTask } = useAppStore();

  return (
    <div className="absolute right-0 top-0 h-full w-96 bg-gray-900 border-l border-gray-800 z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <h3 className="text-lg font-semibold text-white">Task Details</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1"
        >
          ✕
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Title */}
        <div>
          <h2 className="text-xl font-bold text-white mb-2">{task.title}</h2>
          <div className="flex items-center gap-2">
            <div className={cn('w-2 h-2 rounded-full', PRIORITY_COLORS[task.priority])} />
            <span className="text-sm text-gray-400 uppercase">{task.priority}</span>
            <span className="text-gray-600">•</span>
            <span className="text-sm text-gray-400">{STATUS_NAMES[task.status]}</span>
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <div>
            <label className="text-xs text-gray-500 uppercase mb-1 block">Description</label>
            <p className="text-sm text-gray-300">{task.description}</p>
          </div>
        )}

        {/* Agent */}
        <div>
          <label className="text-xs text-gray-500 uppercase mb-1 block">Assigned To</label>
          {agent ? (
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-2">
              <span className="text-lg">{agent.emoji}</span>
              <div>
                <div className="text-sm font-medium text-white">{agent.name}</div>
                <div className="text-xs text-gray-400">{agent.division}</div>
              </div>
            </div>
          ) : (
            <div className="text-sm text-gray-500">Unassigned</div>
          )}
        </div>

        {/* Status Change */}
        <div>
          <label className="text-xs text-gray-500 uppercase mb-2 block">Change Status</label>
          <div className="grid grid-cols-2 gap-2">
            {(['inbox', 'backlog', 'todo', 'in_progress', 'review', 'done', 'blocked'] as TaskStatus[]).map((status) => (
              <button
                key={status}
                onClick={() => {
                  onStatusChange(status);
                }}
                disabled={task.status === status}
                className={cn(
                  'px-3 py-2 rounded text-xs font-medium transition-colors',
                  task.status === status
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white border border-gray-700'
                )}
              >
                {STATUS_NAMES[status]}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        {task.tags.length > 0 && (
          <div>
            <label className="text-xs text-gray-500 uppercase mb-1 block">Tags</label>
            <div className="flex flex-wrap gap-1">
              {task.tags.map((tag) => (
                <span key={tag} className="text-xs bg-gray-800 text-gray-400 px-2 py-1 rounded">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Timestamps */}
        <div className="text-xs text-gray-500 space-y-1">
          <div>Created: {new Date(task.createdAt).toLocaleString()}</div>
          {task.startedAt && <div>Started: {new Date(task.startedAt).toLocaleString()}</div>}
          {task.completedAt && <div>Completed: {new Date(task.completedAt).toLocaleString()}</div>}
        </div>
      </div>
    </div>
  );
}