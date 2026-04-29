'use client';

import { cn } from '@/lib/utils';

interface PerformanceChartProps {
  performance: {
    requests: {
      total: number;
      avgDuration: number;
      p95: number;
      errorRate: number;
      byPath?: Record<string, { count: number; avgDuration: number }>;
    };
  };
}

export function PerformanceChart({ performance }: PerformanceChartProps) {
  const { requests } = performance;
  const byPath = requests.byPath || {};
  const paths = Object.entries(byPath)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  const maxCount = Math.max(...paths.map(([, v]) => v.count), 1);

  return (
    <div className="bg-gray-800/50 rounded-xl p-6">
      <h3 className="text-lg font-semibold text-white mb-4">📈 Request Distribution</h3>
      
      {paths.length === 0 ? (
        <p className="text-gray-400 text-sm">No request data available yet</p>
      ) : (
        <div className="space-y-3">
          {paths.map(([path, stats]) => (
            <div key={path}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-300 truncate max-w-[200px]" title={path}>
                  {path}
                </span>
                <span className="text-gray-400">
                  {stats.count} ({Math.round(stats.avgDuration)}ms)
                </span>
              </div>
              <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    stats.avgDuration > 500 ? 'bg-red-500' :
                    stats.avgDuration > 200 ? 'bg-yellow-500' : 'bg-green-500'
                  )}
                  style={{ width: `${(stats.count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Latency Distribution */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <h4 className="text-sm font-medium text-gray-300 mb-3">Latency Percentiles</h4>
        <div className="flex items-end space-x-4 h-20">
          {[
            { label: 'Avg', value: requests.avgDuration, color: 'bg-blue-500' },
            { label: 'P95', value: requests.p95, color: 'bg-yellow-500' },
          ].map((item) => {
            const maxVal = Math.max(requests.avgDuration, requests.p95, 100);
            const height = Math.max((item.value / maxVal) * 100, 5);
            return (
              <div key={item.label} className="flex-1 text-center">
                <div className="flex flex-col items-center">
                  <span className="text-xs text-gray-400 mb-1">{Math.round(item.value)}ms</span>
                  <div
                    className={cn('w-full rounded-t', item.color)}
                    style={{ height: `${height}%`, minHeight: '4px' }}
                  />
                  <span className="text-xs text-gray-500 mt-1">{item.label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
