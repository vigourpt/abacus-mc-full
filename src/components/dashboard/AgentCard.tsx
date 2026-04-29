'use client';

import type { Agent } from '@/types';
import { cn } from '@/lib/utils';

interface AgentCardProps {
  agent: Agent;
  compact?: boolean;
}

export function AgentCard({ agent, compact = false }: AgentCardProps) {
  const statusColors: Record<string, string> = {
    idle: 'bg-green-500',
    active: 'bg-blue-500 animate-pulse',
    busy: 'bg-yellow-500 animate-pulse',
    sleeping: 'bg-gray-500',
    retired: 'bg-red-500',
  };

  const divisionColors: Record<string, string> = {
    executive: 'border-purple-500/50',
    engineering: 'border-blue-500/50',
    marketing: 'border-green-500/50',
    sales: 'border-orange-500/50',
    operations: 'border-red-500/50',
    design: 'border-pink-500/50',
    product: 'border-cyan-500/50',
    testing: 'border-yellow-500/50',
    support: 'border-indigo-500/50',
  };

  if (compact) {
    return (
      <div
        className={cn(
          'bg-gray-800 rounded-lg p-3 border',
          divisionColors[agent.division] || 'border-gray-700'
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{agent.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{agent.name}</p>
            <p className="text-xs text-gray-400 capitalize">{agent.division}</p>
          </div>
          <span
            className={cn('w-2 h-2 rounded-full', statusColors[agent.status])}
          ></span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'bg-gray-800 rounded-lg p-4 border',
        divisionColors[agent.division] || 'border-gray-700'
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">{agent.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-white truncate">
              {agent.name}
            </h3>
            <span
              className={cn('w-2 h-2 rounded-full', statusColors[agent.status])}
            ></span>
          </div>
          <p className="text-sm text-gray-400 capitalize">{agent.division}</p>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
            {agent.description}
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="mt-4 pt-3 border-t border-gray-700">
        <div className="flex justify-between text-xs">
          <div>
            <p className="text-gray-500">Tasks</p>
            <p className="text-white font-medium">{agent.metrics.tasksCompleted}</p>
          </div>
          <div>
            <p className="text-gray-500">Success</p>
            <p className="text-white font-medium">
              {Math.round(agent.metrics.successRate * 100)}%
            </p>
          </div>
          <div>
            <p className="text-gray-500">Status</p>
            <p className="text-white font-medium capitalize">{agent.status}</p>
          </div>
        </div>
      </div>

      {/* Capabilities */}
      {agent.capabilities.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {agent.capabilities.slice(0, 3).map((cap) => (
            <span
              key={cap}
              className="px-2 py-0.5 text-xs bg-gray-700 text-gray-300 rounded"
            >
              {cap}
            </span>
          ))}
          {agent.capabilities.length > 3 && (
            <span className="px-2 py-0.5 text-xs bg-gray-700 text-gray-500 rounded">
              +{agent.capabilities.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
