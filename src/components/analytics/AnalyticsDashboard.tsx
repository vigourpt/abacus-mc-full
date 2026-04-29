'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { MetricsCard } from './MetricsCard';
import { PerformanceChart } from './PerformanceChart';
import { SystemHealthIndicator } from './SystemHealthIndicator';
import { AlertsList } from './AlertsList';

interface AnalyticsData {
  agents: {
    agents: Array<{
      agentId: string;
      name: string;
      division: string;
      tasksCompleted: number;
      successRate: number;
      avgTaskDuration: number;
    }>;
    summary: {
      totalTasksCompleted: number;
      avgSuccessRate: number;
      avgResponseTime: number;
    };
  };
  tasks: {
    totalTasks: number;
    byStatus: Record<string, number>;
    completionRate: number;
    avgDuration: number;
    throughput: { daily: number; weekly: number; monthly: number };
  };
  system: {
    health: {
      database: { sizeMB: number; totalRows: number };
      agents: { total: number; active: number };
      uptime: number;
    };
    realtime: {
      totalAgents: number;
      activeAgents: number;
      totalTasks: number;
      tasksInProgress: number;
      tasksPending: number;
      tasksCompleted: number;
    };
    cache: {
      main: { hits: number; misses: number; hitRate: number; size: number };
    };
  };
  performance: {
    performance: {
      requests: { total: number; avgDuration: number; p95: number; errorRate: number };
      database: { totalQueries: number; avgQueryTime: number };
      websocket: { activeConnections: number };
      workload: { agentUtilization: number; overloadedAgents: string[] };
    };
    alerts?: Array<{
      id: string;
      type: 'warning' | 'critical';
      message: string;
      timestamp: number;
    }>;
  };
}

export function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'agents' | 'tasks' | 'performance'>('overview');

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  async function fetchAnalytics() {
    try {
      const [agentsRes, tasksRes, systemRes, perfRes] = await Promise.all([
        fetch('/api/analytics/agents?divisions=true'),
        fetch('/api/analytics/tasks?history=true'),
        fetch('/api/analytics/system?detailed=true'),
        fetch('/api/analytics/performance?alerts=true'),
      ]);

      const [agents, tasks, system, performance] = await Promise.all([
        agentsRes.json(),
        tasksRes.json(),
        systemRes.json(),
        perfRes.json(),
      ]);

      setData({
        agents: agents.data,
        tasks: tasks.data,
        system: system.data,
        performance: performance.data,
      });
      setError(null);
    } catch (err) {
      setError('Failed to load analytics data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
        {error || 'No data available'}
      </div>
    );
  }

  const tabs = [
    { id: 'overview', label: '📊 Overview' },
    { id: 'agents', label: '🤖 Agents' },
    { id: 'tasks', label: '📋 Tasks' },
    { id: 'performance', label: '⚡ Performance' },
  ] as const;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-white">Analytics Dashboard</h2>
        <button
          onClick={fetchAnalytics}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg text-sm font-medium transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-gray-700 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 rounded-t-lg text-sm font-medium transition-colors',
              activeTab === tab.id
                ? 'bg-gray-800 text-white border-b-2 border-primary-500'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'overview' && <OverviewTab data={data} />}
      {activeTab === 'agents' && <AgentsTab data={data} />}
      {activeTab === 'tasks' && <TasksTab data={data} />}
      {activeTab === 'performance' && <PerformanceTab data={data} />}
    </div>
  );
}

function OverviewTab({ data }: { data: AnalyticsData }) {
  const { system, performance } = data;

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricsCard
          title="Total Agents"
          value={system.realtime.totalAgents}
          subtitle={`${system.realtime.activeAgents} active`}
          icon="🤖"
          color="blue"
        />
        <MetricsCard
          title="Total Tasks"
          value={system.realtime.totalTasks}
          subtitle={`${system.realtime.tasksInProgress} in progress`}
          icon="📋"
          color="green"
        />
        <MetricsCard
          title="Completion Rate"
          value={`${Math.round(data.tasks.completionRate)}%`}
          subtitle={`${data.tasks.throughput.daily}/day`}
          icon="✅"
          color="emerald"
        />
        <MetricsCard
          title="Avg Response"
          value={`${Math.round(performance.performance.requests.avgDuration)}ms`}
          subtitle={`P95: ${Math.round(performance.performance.requests.p95)}ms`}
          icon="⚡"
          color="yellow"
        />
      </div>

      {/* System Health & Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SystemHealthIndicator health={system.health} cache={system.cache.main} />
        <PerformanceChart performance={performance.performance} />
      </div>

      {/* Alerts */}
      {performance.alerts && performance.alerts.length > 0 && (
        <AlertsList alerts={performance.alerts} />
      )}
    </div>
  );
}

function AgentsTab({ data }: { data: AnalyticsData }) {
  const { agents } = data;
  const topAgents = [...agents.agents].sort((a, b) => b.tasksCompleted - a.tasksCompleted).slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <MetricsCard
          title="Tasks Completed"
          value={agents.summary.totalTasksCompleted}
          icon="✅"
          color="green"
        />
        <MetricsCard
          title="Avg Success Rate"
          value={`${Math.round(agents.summary.avgSuccessRate)}%`}
          icon="📈"
          color="blue"
        />
        <MetricsCard
          title="Avg Response Time"
          value={`${Math.round(agents.summary.avgResponseTime)}ms`}
          icon="⏱️"
          color="yellow"
        />
      </div>

      {/* Top Performers */}
      <div className="bg-gray-800/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">🏆 Top Performing Agents</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-400 border-b border-gray-700">
                <th className="text-left py-2">Agent</th>
                <th className="text-left py-2">Division</th>
                <th className="text-right py-2">Tasks</th>
                <th className="text-right py-2">Success Rate</th>
                <th className="text-right py-2">Avg Duration</th>
              </tr>
            </thead>
            <tbody>
              {topAgents.map((agent) => (
                <tr key={agent.agentId} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-3 text-white">{agent.name}</td>
                  <td className="py-3 text-gray-400">{agent.division}</td>
                  <td className="py-3 text-right text-white">{agent.tasksCompleted}</td>
                  <td className="py-3 text-right">
                    <span className={cn(
                      'px-2 py-0.5 rounded text-xs',
                      agent.successRate >= 90 ? 'bg-green-500/20 text-green-400' :
                      agent.successRate >= 70 ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-red-500/20 text-red-400'
                    )}>
                      {Math.round(agent.successRate)}%
                    </span>
                  </td>
                  <td className="py-3 text-right text-gray-400">
                    {Math.round(agent.avgTaskDuration)} min
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function TasksTab({ data }: { data: AnalyticsData }) {
  const { tasks } = data;
  const statuses = ['inbox', 'backlog', 'todo', 'in_progress', 'review', 'done'];

  return (
    <div className="space-y-6">
      {/* Task Distribution */}
      <div className="bg-gray-800/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">📊 Task Distribution</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {statuses.map((status) => (
            <div key={status} className="bg-gray-900/50 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-white">
                {tasks.byStatus[status] || 0}
              </div>
              <div className="text-xs text-gray-400 capitalize mt-1">
                {status.replace('_', ' ')}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Throughput */}
      <div className="grid grid-cols-3 gap-4">
        <MetricsCard
          title="Daily Throughput"
          value={tasks.throughput.daily}
          subtitle="tasks/day"
          icon="📅"
          color="blue"
        />
        <MetricsCard
          title="Weekly Throughput"
          value={tasks.throughput.weekly}
          subtitle="tasks/week"
          icon="📆"
          color="green"
        />
        <MetricsCard
          title="Monthly Throughput"
          value={tasks.throughput.monthly}
          subtitle="tasks/month"
          icon="🗓️"
          color="purple"
        />
      </div>

      {/* Efficiency */}
      <div className="bg-gray-800/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">⚡ Efficiency Metrics</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400">Average Duration</div>
            <div className="text-2xl font-bold text-white mt-1">
              {Math.round(tasks.avgDuration * 10) / 10} hours
            </div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400">Completion Rate</div>
            <div className="text-2xl font-bold text-white mt-1">
              {Math.round(tasks.completionRate)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PerformanceTab({ data }: { data: AnalyticsData }) {
  const { performance, system } = data;
  const perf = performance.performance;

  return (
    <div className="space-y-6">
      {/* Request Metrics */}
      <div className="bg-gray-800/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">🌐 Request Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-900/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">{perf.requests.total}</div>
            <div className="text-xs text-gray-400 mt-1">Total Requests</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">{Math.round(perf.requests.avgDuration)}ms</div>
            <div className="text-xs text-gray-400 mt-1">Avg Latency</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-white">{Math.round(perf.requests.p95)}ms</div>
            <div className="text-xs text-gray-400 mt-1">P95 Latency</div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4 text-center">
            <div className={cn(
              'text-2xl font-bold',
              perf.requests.errorRate < 1 ? 'text-green-400' :
              perf.requests.errorRate < 5 ? 'text-yellow-400' : 'text-red-400'
            )}>
              {Math.round(perf.requests.errorRate * 100) / 100}%
            </div>
            <div className="text-xs text-gray-400 mt-1">Error Rate</div>
          </div>
        </div>
      </div>

      {/* Database & Cache */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-800/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">🗄️ Database</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Queries/hour</span>
              <span className="text-white">{perf.database.totalQueries}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Avg Query Time</span>
              <span className="text-white">{Math.round(perf.database.avgQueryTime)}ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Database Size</span>
              <span className="text-white">{system.health.database.sizeMB} MB</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Total Rows</span>
              <span className="text-white">{system.health.database.totalRows.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">💾 Cache</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-400">Hit Rate</span>
              <span className={cn(
                system.cache.main.hitRate > 80 ? 'text-green-400' :
                system.cache.main.hitRate > 50 ? 'text-yellow-400' : 'text-red-400'
              )}>
                {Math.round(system.cache.main.hitRate)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Hits</span>
              <span className="text-white">{system.cache.main.hits}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Misses</span>
              <span className="text-white">{system.cache.main.misses}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Entries</span>
              <span className="text-white">{system.cache.main.size}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Workload */}
      <div className="bg-gray-800/50 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">⚖️ Agent Workload</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400">Utilization</div>
            <div className="text-2xl font-bold text-white mt-1">
              {Math.round(perf.workload.agentUtilization)}%
            </div>
          </div>
          <div className="bg-gray-900/50 rounded-lg p-4">
            <div className="text-sm text-gray-400">Overloaded Agents</div>
            <div className={cn(
              'text-2xl font-bold mt-1',
              perf.workload.overloadedAgents.length === 0 ? 'text-green-400' : 'text-red-400'
            )}>
              {perf.workload.overloadedAgents.length}
            </div>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {performance.alerts && performance.alerts.length > 0 && (
        <AlertsList alerts={performance.alerts} />
      )}
    </div>
  );
}
