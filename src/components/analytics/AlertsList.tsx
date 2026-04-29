'use client';

import { cn, timeAgo } from '@/lib/utils';

interface Alert {
  id: string;
  type: 'warning' | 'critical';
  message: string;
  timestamp: number;
}

interface AlertsListProps {
  alerts: Alert[];
}

export function AlertsList({ alerts }: AlertsListProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="bg-gray-800/50 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">🚨 Recent Alerts</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {alerts.map((alert) => (
          <div
            key={alert.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border',
              alert.type === 'critical'
                ? 'bg-red-500/10 border-red-500/30'
                : 'bg-yellow-500/10 border-yellow-500/30'
            )}
          >
            <span className="text-lg">
              {alert.type === 'critical' ? '🔴' : '🟡'}
            </span>
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-sm',
                alert.type === 'critical' ? 'text-red-400' : 'text-yellow-400'
              )}>
                {alert.message}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {timeAgo(new Date(alert.timestamp))}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
