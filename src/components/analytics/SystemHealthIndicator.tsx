'use client';

import { cn } from '@/lib/utils';

interface SystemHealthIndicatorProps {
  health: {
    database: { sizeMB: number; totalRows: number };
    agents: { total: number; active: number; idle?: number };
    uptime: number;
  };
  cache: {
    hits: number;
    misses: number;
    hitRate: number;
    size: number;
  };
}

export function SystemHealthIndicator({ health, cache }: SystemHealthIndicatorProps) {
  const uptimeHours = Math.floor(health.uptime / 3600);
  const uptimeMinutes = Math.floor((health.uptime % 3600) / 60);

  const healthScore = calculateHealthScore(health, cache);

  return (
    <div className="bg-gray-800/50 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">🏥 System Health</h3>
        <HealthBadge score={healthScore} />
      </div>

      <div className="space-y-4">
        {/* Health Ring */}
        <div className="flex justify-center mb-4">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#374151"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke={getHealthColor(healthScore)}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${(healthScore / 100) * 251.2} 251.2`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-white">{healthScore}</span>
              <span className="text-xs text-gray-400">Health Score</span>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="text-gray-400">Uptime</div>
            <div className="text-white font-medium">
              {uptimeHours}h {uptimeMinutes}m
            </div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="text-gray-400">Active Agents</div>
            <div className="text-white font-medium">
              {health.agents.active}/{health.agents.total}
            </div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="text-gray-400">Cache Hit Rate</div>
            <div className={cn(
              'font-medium',
              cache.hitRate > 80 ? 'text-green-400' :
              cache.hitRate > 50 ? 'text-yellow-400' : 'text-red-400'
            )}>
              {Math.round(cache.hitRate)}%
            </div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="text-gray-400">DB Size</div>
            <div className="text-white font-medium">
              {health.database.sizeMB} MB
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function HealthBadge({ score }: { score: number }) {
  const label = score >= 90 ? 'Excellent' : score >= 70 ? 'Good' : score >= 50 ? 'Fair' : 'Poor';
  const colorClass = score >= 90 ? 'bg-green-500/20 text-green-400' :
                     score >= 70 ? 'bg-blue-500/20 text-blue-400' :
                     score >= 50 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400';

  return (
    <span className={cn('px-2 py-1 rounded text-xs font-medium', colorClass)}>
      {label}
    </span>
  );
}

function calculateHealthScore(health: any, cache: any): number {
  let score = 100;

  // Deduct for low cache hit rate
  if (cache.hitRate < 50) score -= 20;
  else if (cache.hitRate < 80) score -= 10;

  // Deduct for inactive agents
  const activeRatio = health.agents.total > 0 ? health.agents.active / health.agents.total : 0;
  if (activeRatio < 0.5) score -= 15;
  else if (activeRatio < 0.8) score -= 5;

  // Deduct for high DB size (over 100MB)
  if (health.database.sizeMB > 100) score -= 10;
  else if (health.database.sizeMB > 50) score -= 5;

  return Math.max(0, Math.min(100, score));
}

function getHealthColor(score: number): string {
  if (score >= 90) return '#22c55e'; // green-500
  if (score >= 70) return '#3b82f6'; // blue-500
  if (score >= 50) return '#eab308'; // yellow-500
  return '#ef4444'; // red-500
}
