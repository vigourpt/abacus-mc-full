'use client';

import { cn } from '@/lib/utils';

interface MetricsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: string;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'emerald';
  trend?: { direction: 'up' | 'down'; value: number };
}

const colorClasses = {
  blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
  green: 'bg-green-500/10 border-green-500/30 text-green-400',
  yellow: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
  red: 'bg-red-500/10 border-red-500/30 text-red-400',
  purple: 'bg-purple-500/10 border-purple-500/30 text-purple-400',
  emerald: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400',
};

export function MetricsCard({ title, value, subtitle, icon, color = 'blue', trend }: MetricsCardProps) {
  return (
    <div className={cn(
      'rounded-xl border p-4 transition-all hover:scale-[1.02]',
      colorClasses[color]
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {icon && <span className="text-2xl">{icon}</span>}
      </div>
      {trend && (
        <div className={cn(
          'flex items-center mt-2 text-xs',
          trend.direction === 'up' ? 'text-green-400' : 'text-red-400'
        )}>
          <span>{trend.direction === 'up' ? '↑' : '↓'}</span>
          <span className="ml-1">{trend.value}%</span>
        </div>
      )}
    </div>
  );
}
