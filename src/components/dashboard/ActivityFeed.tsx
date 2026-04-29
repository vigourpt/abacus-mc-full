'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import { timeAgo } from '@/lib/utils';

interface ActivityEntry {
  id: string;
  type: string;
  message: string;
  agentId?: string;
  taskId?: string;
  createdAt: string;
}

export function ActivityFeed() {
  const { events } = useAppStore();
  const [dbActivities, setDbActivities] = useState<ActivityEntry[]>([]);

  useEffect(() => {
    fetch('/api/activity?limit=20')
      .then(res => res.ok ? res.json() : [])
      .then(data => setDbActivities(data))
      .catch(() => setDbActivities([]));
  }, []);

  const eventActivities = events.map((e) => ({
    id: `evt-${e.timestamp.getTime()}`,
    type: e.type,
    message: typeof e.payload === 'object' && e.payload !== null
      ? (e.payload as any).text || JSON.stringify(e.payload).slice(0, 80)
      : String(e.payload).slice(0, 80),
    timestamp: e.timestamp,
  }));

  const apiActivities = dbActivities.map((a) => ({
    id: a.id,
    type: a.type,
    message: a.message,
    timestamp: new Date(a.createdAt),
  }));

  const allActivities = [
    ...eventActivities,
    ...apiActivities,
  ]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 20);

  const typeIcons: Record<string, string> = {
    agent_created: '🤖',
    task_assigned: '📋',
    task_update: '⚡',
    task_completed: '✅',
    system: '💬',
    startup_generated: '🚀',
    agent_sync: '🔄',
    error: '❌',
  };

  return (
    <section>
      <h2 className="text-lg font-semibold text-white mb-4">Activity Feed</h2>
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="space-y-4 max-h-[500px] overflow-y-auto">
          {allActivities.map((activity) => (
            <div
              key={activity.id}
              className="flex gap-3 pb-4 border-b border-gray-700 last:border-0 last:pb-0"
            >
              <span className="text-lg">
                {typeIcons[activity.type] || '💬'}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white">{activity.message}</p>
                <p className="text-xs text-gray-500">
                  {timeAgo(activity.timestamp)}
                </p>
              </div>
            </div>
          ))}

          {allActivities.length === 0 && (
            <div className="text-center py-8">
              <span className="text-4xl block mb-2">📭</span>
              <p className="text-sm text-gray-500">No recent activity</p>
              <p className="text-xs text-gray-600 mt-1">
                Activity will appear here as agents work on tasks
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
