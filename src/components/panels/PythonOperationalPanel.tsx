'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';

interface TaskDependency {
  id: string;
  taskId: string;
  dependsOn: string;
  type: 'blocks' | 'requires' | 'enhances';
}

interface SchedulerEntry {
  id: string;
  name: string;
  schedule: string;
  lastRun: string | null;
  nextRun: string | null;
  status: 'active' | 'paused' | 'error';
  taskCount: number;
}

interface MetricData {
  name: string;
  value: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  change: number;
}

export function PythonOperationalPanel() {
  const { tasks } = useAppStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'dependencies' | 'scheduler' | 'metrics'>('overview');
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [schedulers, setSchedulers] = useState<SchedulerEntry[]>([]);

  useEffect(() => {
    // Simulated metrics from Python orchestration layer
    setMetrics([
      { name: 'Tasks Completed', value: 1247, unit: 'tasks', trend: 'up', change: 12 },
      { name: 'Success Rate', value: 94.2, unit: '%', trend: 'up', change: 2.1 },
      { name: 'Avg Runtime', value: 3.2, unit: 'min', trend: 'down', change: -0.4 },
      { name: 'Active Agents', value: 8, unit: 'agents', trend: 'stable', change: 0 },
      { name: 'Queue Depth', value: 23, unit: 'tasks', trend: 'down', change: -5 },
      { name: 'Retries', value: 47, unit: 'total', trend: 'down', change: -8 },
    ]);

    // Simulated task dependencies
    setDependencies([
      { id: '1', taskId: 'task-1', dependsOn: 'task-0', type: 'blocks' },
      { id: '2', taskId: 'task-2', dependsOn: 'task-1', type: 'requires' },
      { id: '3', taskId: 'task-3', dependsOn: 'task-1', type: 'enhances' },
      { id: '4', taskId: 'task-4', dependsOn: 'task-2', type: 'blocks' },
      { id: '5', taskId: 'task-5', dependsOn: 'task-3', type: 'requires' },
    ]);

    // Simulated scheduler entries
    setSchedulers([
      { id: '1', name: 'Morning Standup', schedule: '0 9 * * *', lastRun: new Date(Date.now() - 3600000).toISOString(), nextRun: new Date(Date.now() + 82800000).toISOString(), status: 'active', taskCount: 12 },
      { id: '2', name: 'Metrics Aggregation', schedule: '*/15 * * * *', lastRun: new Date(Date.now() - 900000).toISOString(), nextRun: new Date(Date.now() + 810000).toISOString(), status: 'active', taskCount: 45 },
      { id: '3', name: 'Health Check', schedule: '*/5 * * * *', lastRun: new Date(Date.now() - 300000).toISOString(), nextRun: new Date(Date.now() + 270000).toISOString(), status: 'active', taskCount: 8 },
      { id: '4', name: 'Weekly Report', schedule: '0 0 * * 0', lastRun: new Date(Date.now() - 604800000).toISOString(), nextRun: new Date(Date.now() + 518400000).toISOString(), status: 'paused', taskCount: 156 },
      { id: '5', name: 'Backup Tasks', schedule: '0 2 * * *', lastRun: new Date(Date.now() - 7200000).toISOString(), nextRun: new Date(Date.now() + 82800000).toISOString(), status: 'active', taskCount: 34 },
    ]);
  }, [tasks]);

  const tabs = [
    { id: 'overview', label: '📊 Overview', icon: '📊' },
    { id: 'dependencies', label: '🔗 Dependencies', icon: '🔗' },
    { id: 'scheduler', label: '⏰ Scheduler', icon: '⏰' },
    { id: 'metrics', label: '📈 Metrics', icon: '📈' },
  ] as const;

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 p-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🔧</span>
          Python Operational Layer
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Task orchestration, dependencies, scheduling, and metrics from Python engine
        </p>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-gray-800 px-4">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px',
                activeTab === tab.id
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-gray-400 hover:text-white'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              {metrics.map(metric => (
                <MetricCard key={metric.name} metric={metric} />
              ))}
            </div>

            {/* Quick Stats */}
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Operational Status</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-green-400">Running</div>
                  <div className="text-xs text-gray-500">Active Schedules</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-yellow-400">1</div>
                  <div className="text-xs text-gray-500">Paused</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-cyan-400">0</div>
                  <div className="text-xs text-gray-500">Errors</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'dependencies' && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">Task Dependency Graph</h3>
              <p className="text-xs text-gray-400 mb-4">
                Visualize how tasks depend on each other. Types: blocks, requires, enhances.
              </p>
              
              <div className="space-y-2">
                {dependencies.map(dep => (
                  <div key={dep.id} className="flex items-center gap-3 bg-gray-700/50 rounded-lg p-3">
                    <div className="flex-1">
                      <div className="text-sm text-white font-mono">{dep.taskId}</div>
                      <div className="text-xs text-gray-400">depends on</div>
                    </div>
                    <div className={cn(
                      'px-2 py-1 rounded text-xs font-medium',
                      dep.type === 'blocks' && 'bg-red-500/20 text-red-400',
                      dep.type === 'requires' && 'bg-yellow-500/20 text-yellow-400',
                      dep.type === 'enhances' && 'bg-green-500/20 text-green-400',
                    )}>
                      {dep.type}
                    </div>
                    <div className="text-gray-500">→</div>
                    <div className="flex-1">
                      <div className="text-sm text-white font-mono">{dep.dependsOn}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'scheduler' && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">Cron Schedules</h3>
              <p className="text-xs text-gray-400 mb-4">
                Task scheduling powered by Python scheduler (APScheduler-style)
              </p>
              
              <div className="space-y-2">
                {schedulers.map(entry => (
                  <div key={entry.id} className="bg-gray-700/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium">{entry.name}</span>
                        <span className={cn(
                          'px-2 py-0.5 rounded text-xs',
                          entry.status === 'active' && 'bg-green-500/20 text-green-400',
                          entry.status === 'paused' && 'bg-yellow-500/20 text-yellow-400',
                          entry.status === 'error' && 'bg-red-500/20 text-red-400',
                        )}>
                          {entry.status}
                        </span>
                      </div>
                      <span className="text-xs font-mono text-gray-400">{entry.schedule}</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-gray-500">Last run:</span>
                        <div className="text-gray-300">{entry.lastRun ? new Date(entry.lastRun).toLocaleString() : 'Never'}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Next run:</span>
                        <div className="text-gray-300">{entry.nextRun ? new Date(entry.nextRun).toLocaleString() : 'N/A'}</div>
                      </div>
                      <div>
                        <span className="text-gray-500">Tasks:</span>
                        <div className="text-gray-300">{entry.taskCount}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-4">Performance Metrics</h3>
              
              <div className="space-y-3">
                {metrics.map(metric => (
                  <div key={metric.name} className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-sm text-white">{metric.name}</div>
                      <div className="text-xs text-gray-500">{metric.unit}</div>
                    </div>
                    <div className="text-xl font-bold text-white">
                      {metric.value}{metric.unit === '%' ? '' : ''}
                    </div>
                    <div className={cn(
                      'text-sm px-2 py-1 rounded',
                      metric.trend === 'up' && metric.change > 0 && 'bg-green-500/20 text-green-400',
                      metric.trend === 'down' && metric.change < 0 && 'bg-green-500/20 text-green-400',
                      metric.trend === 'stable' && 'bg-gray-500/20 text-gray-400',
                      metric.trend === 'up' && metric.change < 0 && 'bg-red-500/20 text-red-400',
                      metric.trend === 'down' && metric.change > 0 && 'bg-red-500/20 text-red-400',
                    )}>
                      {metric.trend === 'up' && '↑'}
                      {metric.trend === 'down' && '↓'}
                      {metric.trend === 'stable' && '→'}
                      {Math.abs(metric.change)}{metric.unit === '%' ? '%' : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-2">Python Scripts Available</h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  'task_runner.py',
                  'scheduler.py',
                  'task_dependencies.py',
                  'metrics.py',
                  'knowledge_capture.py',
                  'knowledge_retrieval.py',
                  'reputation.py',
                  'run_sessions.py',
                  'embeddings.py',
                  'capability_index.py',
                ].map(script => (
                  <div key={script} className="bg-gray-700/50 rounded px-2 py-1 font-mono text-gray-300">
                    🐍 {script}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricCard({ metric }: { metric: MetricData }) {
  return (
    <div className="bg-gray-800 rounded-lg p-3">
      <div className="text-xs text-gray-400 mb-1">{metric.name}</div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-white">{metric.value}</span>
        <span className="text-xs text-gray-500 mb-1">{metric.unit}</span>
        <span className={cn(
          'text-xs ml-auto mb-1',
          metric.trend === 'up' && metric.change > 0 && 'text-green-400',
          metric.trend === 'down' && metric.change < 0 && 'text-green-400',
          metric.trend === 'stable' && 'text-gray-400',
        )}>
          {metric.trend === 'up' && '↑'}
          {metric.trend === 'down' && '↓'}
          {metric.trend === 'stable' && '→'}
        </span>
      </div>
    </div>
  );
}