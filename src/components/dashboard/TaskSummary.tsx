'use client';

import type { Task } from '@/types';
import { cn } from '@/lib/utils';

interface TaskSummaryProps {
  tasks: Task[];
  expanded?: boolean;
}

const columns = [
  { id: 'inbox', label: 'Inbox', color: 'bg-gray-600' },
  { id: 'backlog', label: 'Backlog', color: 'bg-purple-600' },
  { id: 'todo', label: 'To Do', color: 'bg-blue-600' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-yellow-600' },
  { id: 'review', label: 'Review', color: 'bg-orange-600' },
  { id: 'done', label: 'Done', color: 'bg-green-600' },
];

export function TaskSummary({ tasks, expanded = false }: TaskSummaryProps) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-4">Task Overview</h2>

      {expanded ? (
        // Full Kanban Board - horizontal scroll on mobile
        <div className="flex md:grid md:grid-cols-6 gap-4 overflow-x-auto pb-4">
          {columns.map((column) => {
            const columnTasks = tasks.filter((t) => t.status === column.id);
            return (
              <div key={column.id} className="bg-gray-800 rounded-lg p-3 min-w-[160px] flex-shrink-0">
                <div className="flex items-center gap-2 mb-3">
                  <span className={cn('w-3 h-3 rounded', column.color)}></span>
                  <span className="text-sm font-medium text-white">
                    {column.label}
                  </span>
                  <span className="text-xs text-gray-500 ml-auto">
                    {columnTasks.length}
                  </span>
                </div>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {columnTasks.map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
                  {columnTasks.length === 0 && (
                    <p className="text-xs text-gray-500 text-center py-4">
                      No tasks
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        // Summary View
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
          {columns.map((column) => {
            const count = tasks.filter((t) => t.status === column.id).length;
            return (
              <div
                key={column.id}
                className="bg-gray-800 rounded-lg p-3 text-center"
              >
                <span className={cn('inline-block w-3 h-3 rounded mb-2', column.color)}></span>
                <p className="text-xl font-bold text-white">{count}</p>
                <p className="text-xs text-gray-400">{column.label}</p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function TaskCard({ task }: { task: Task }) {
  const priorityColors: Record<string, string> = {
    critical: 'border-l-red-500',
    high: 'border-l-orange-500',
    medium: 'border-l-yellow-500',
    low: 'border-l-gray-500',
  };

  return (
    <div
      className={cn(
        'bg-gray-700 rounded p-2 border-l-2',
        priorityColors[task.priority]
      )}
    >
      <p className="text-sm text-white line-clamp-2">{task.title}</p>
      {task.assignedTo && (
        <p className="text-xs text-gray-400 mt-1">
          Assigned: {task.assignedTo.slice(0, 8)}...
        </p>
      )}
    </div>
  );
}
