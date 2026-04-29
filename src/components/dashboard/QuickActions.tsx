'use client';

import { useState } from 'react';

export function QuickActions() {
  const [showNewTask, setShowNewTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle,
          description: '',
          autoAssign: true,
        }),
      });

      if (response.ok) {
        setTaskTitle('');
        setShowNewTask(false);
        // Refresh tasks would go here
      }
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncAgents = async () => {
    try {
      await fetch('/api/agents/sync', { method: 'POST' });
      // Refresh agents would go here
    } catch (error) {
      console.error('Failed to sync agents:', error);
    }
  };

  return (
    <section className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setShowNewTask(!showNewTask)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            ➕ New Task
          </button>
          <button
            onClick={handleSyncAgents}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            🔄 Sync Agents
          </button>
        </div>

        <div className="text-sm text-gray-400">
          Phase 1 - Core System Active
        </div>
      </div>

      {showNewTask && (
        <div className="mt-4 pt-4 border-t border-gray-700">
          <div className="flex gap-3">
            <input
              type="text"
              value={taskTitle}
              onChange={(e) => setTaskTitle(e.target.value)}
              placeholder="Enter task title..."
              className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateTask()}
            />
            <button
              onClick={handleCreateTask}
              disabled={isSubmitting || !taskTitle.trim()}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {isSubmitting ? 'Creating...' : 'Create & Auto-Assign'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            The Task Planner will automatically route this to the best available agent.
          </p>
        </div>
      )}
    </section>
  );
}
