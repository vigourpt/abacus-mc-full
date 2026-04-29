'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import { timeAgo } from '@/lib/utils';

interface ActivityEntry {
  id: string;
  type: 'task' | 'agent' | 'system' | 'message' | 'error';
  action: string;
  actor: string;
  target?: string;
  details?: string;
  timestamp: string;
}

export function ActivityPanel() {
  const { events } = useAppStore();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [filterType, setFilterType] = useState<string | null>(null);

  useEffect(() => {
    // Combine store events with simulated activity
    const simulated: ActivityEntry[] = [
      {
        id: '1',
        type: 'task',
        action: 'completed',
        actor: 'Developer Agent',
        target: 'Implement API endpoint',
        timestamp: new Date(Date.now() - 300000).toISOString(),
      },
      {
        id: '2',
        type: 'agent',
        action: 'came_online',
        actor: 'Marketing Agent',
        timestamp: new Date(Date.now() - 600000).toISOString(),
      },
      {
        id: '3',
        type: 'system',
        action: 'backup_completed',
        actor: 'System',
        details: 'Database backup successful',
        timestamp: new Date(Date.now() - 900000).toISOString(),
      },
      {
        id: '4',
        type: 'message',
        action: 'received',
        actor: 'jarvis:telegram',
        target: 'CEO Agent',
        details: 'New message from external channel',
        timestamp: new Date(Date.now() - 1200000).toISOString(),
      },
    ];
    setActivities(simulated);
  }, [events]);

  const typeIcons: Record<string, string> = {
    task: '✅',
    agent: '🤖',
    system: '⚙️',
    message: '💬',
    error: '⚠️',
  };

  const typeColors: Record<string, string> = {
    task: 'border-l-green-500',
    agent: 'border-l-blue-500',
    system: 'border-l-gray-500',
    message: 'border-l-cyan-500',
    error: 'border-l-red-500',
  };

  const filtered = filterType ? activities.filter(a => a.type === filterType) : activities;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Activity Stream</h2>
        <div className="flex gap-2">
          {['all', 'task', 'agent', 'system', 'message'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type === 'all' ? null : type)}
              className={`px-3 py-1 rounded text-sm capitalize transition-colors ${
                (type === 'all' && !filterType) || filterType === type
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((activity) => (
          <div
            key={activity.id}
            className={`bg-gray-800/50 border-l-4 ${typeColors[activity.type]} rounded-r-lg p-3 flex items-start gap-3`}
          >
            <span className="text-lg">{typeIcons[activity.type]}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white text-sm">{activity.actor}</span>
                <span className="text-gray-500 text-sm">{activity.action}</span>
                {activity.target && (
                  <span className="text-cyan-400 text-sm">{activity.target}</span>
                )}
              </div>
              {activity.details && (
                <p className="text-gray-500 text-xs mt-1">{activity.details}</p>
              )}
            </div>
            <span className="text-xs text-gray-500">{timeAgo(activity.timestamp)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
