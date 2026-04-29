'use client';

import { useAppStore } from '@/store';
import { AgentCard } from './AgentCard';
import { TaskSummary } from './TaskSummary';
import { ActivityFeed } from './ActivityFeed';
import { QuickActions } from './QuickActions';
import { AnalyticsDashboard } from '@/components/analytics';

// Import all panels
import {
  ChatPanel,
  ChannelsPanel,
  SkillsPanel,
  MemoryPanel,
  ActivityPanel,
  LogsPanel,
  CostTrackerPanel,
  NodesPanel,
  ApprovalsPanel,
  OfficePanel,
  CronPanel,
  WebhooksPanel,
  AlertsPanel,
  GitHubPanel,
  SecurityPanel,
  GatewaysPanel,
  SettingsPanel,
  HiringPanel,
  AgentVisualizerPanel,
  PipelinePanel,
} from '@/components/panels';

export function Dashboard() {
  const { agents, tasks, activePanel } = useAppStore();

  // If a specific panel is active, show that instead
  if (activePanel !== 'dashboard') {
    return <PanelContent panel={activePanel} />;
  }

  const agentsByDivision = {
    executive: agents.filter((a) => a.division === 'executive'),
    engineering: agents.filter((a) => a.division === 'engineering'),
    marketing: agents.filter((a) => a.division === 'marketing'),
    sales: agents.filter((a) => a.division === 'sales'),
    operations: agents.filter((a) => a.division === 'operations'),
  };

  return (
    <div className="h-full overflow-auto p-3 md:p-6 space-y-4 md:space-y-6 safe-area-bottom">
      {/* Quick Actions */}
      <QuickActions />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
        <StatCard
          title="Total Agents"
          value={agents.length}
          icon="🤖"
          color="blue"
        />
        <StatCard
          title="Active Tasks"
          value={tasks.filter((t) => t.status === 'in_progress').length}
          icon="⚡"
          color="yellow"
        />
        <StatCard
          title="Completed Today"
          value={tasks.filter((t) => t.status === 'done').length}
          icon="✅"
          color="green"
        />
        <StatCard
          title="Pending Review"
          value={tasks.filter((t) => t.status === 'review').length}
          icon="🔍"
          color="purple"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Agents Column */}
        <div className="md:col-span-2 space-y-4 md:space-y-6">
          {/* Core Agents */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3 md:mb-4">Core Agents</h2>
            <div className="grid grid-cols-2 gap-2 md:gap-4">
              {[...agentsByDivision.executive, ...agentsByDivision.engineering]
                .slice(0, 4)
                .map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
            </div>
          </section>

          {/* Business Agents */}
          <section>
            <h2 className="text-lg font-semibold text-white mb-3 md:mb-4">
              Business Operations
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
              {[
                ...agentsByDivision.marketing,
                ...agentsByDivision.sales,
                ...agentsByDivision.operations,
              ]
                .slice(0, 6)
                .map((agent) => (
                  <AgentCard key={agent.id} agent={agent} compact />
                ))}
            </div>
          </section>

          {/* Task Summary */}
          <TaskSummary tasks={tasks} />
        </div>

        {/* Activity Feed */}
        <div>
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: string;
  color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500/10 border-blue-500/30',
    yellow: 'bg-yellow-500/10 border-yellow-500/30',
    green: 'bg-green-500/10 border-green-500/30',
    purple: 'bg-purple-500/10 border-purple-500/30',
  };

  return (
    <div
      className={`p-4 rounded-lg border ${colorClasses[color]} bg-gray-800`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-2xl font-bold text-white">{value}</p>
          <p className="text-sm text-gray-400">{title}</p>
        </div>
      </div>
    </div>
  );
}

function PanelContent({ panel }: { panel: string }) {
  const { agents, tasks } = useAppStore();

  // Full-height panels (no padding, no scroll - they handle it internally)
  const fullHeightPanels: Record<string, React.ReactNode> = {
    visualizer: <AgentVisualizerPanel />,
    'agent-world': <AgentVisualizerPanel />,
    chat: <ChatPanel />,
    pipeline: <PipelinePanel />,
  };

  // Standard panels (with padding and scroll)
  const standardPanels: Record<string, React.ReactNode> = {
    // Main navigation
    agents: <AgentsPanel agents={agents} />,
    tasks: <TasksPanel tasks={tasks} />,
    channels: <ChannelsPanel />,
    skills: <SkillsPanel />,
    memory: <MemoryPanel />,
    
    // Observe section
    activity: <ActivityPanel />,
    logs: <LogsPanel />,
    'cost-tracker': <CostTrackerPanel />,
    nodes: <NodesPanel />,
    approvals: <ApprovalsPanel />,
    office: <OfficePanel />,
    
    // Automate section
    cron: <CronPanel />,
    webhooks: <WebhooksPanel />,
    alerts: <AlertsPanel />,
    github: <GitHubPanel />,
    
    // Admin section
    security: <SecurityPanel />,
    analytics: <AnalyticsDashboard />,
    gateways: <GatewaysPanel />,
    settings: <SettingsPanel />,
    hiring: <HiringPanel />,
    
    // Legacy/alternate names
    messages: <ChatPanel />,
  };

  // Check if it's a full-height panel
  if (fullHeightPanels[panel]) {
    return <div className="h-full overflow-hidden">{fullHeightPanels[panel]}</div>;
  }

  // Standard panel with padding and scroll
  if (standardPanels[panel]) {
    return (
      <div className="h-full overflow-auto p-3 md:p-6 safe-area-bottom">
        <div className="min-w-0">
          {standardPanels[panel]}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-3 md:p-6 safe-area-bottom">
      <NotFoundPanel panel={panel} />
    </div>
  );
}

function AgentsPanel({ agents }: { agents: any[] }) {
  const { setActivePanel } = useAppStore();
  
  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">All Agents ({agents.length})</h2>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            placeholder="Search agents..."
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 w-full sm:w-auto"
          />
          <button 
            onClick={() => setActivePanel('hiring')}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded text-sm transition-colors whitespace-nowrap"
          >
            + New Agent
          </button>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
    </div>
  );
}

function TasksPanel({ tasks }: { tasks: any[] }) {
  return (
    <div className="space-y-4 md:space-y-6">
      <h2 className="text-xl font-semibold text-white">Task Board</h2>
      <TaskSummary tasks={tasks} expanded />
    </div>
  );
}

function NotFoundPanel({ panel }: { panel: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-500">
      <span className="text-4xl mb-4">🔍</span>
      <p className="text-lg">Panel &quot;{panel}&quot; not found</p>
      <p className="text-sm mt-2">This panel is under construction</p>
    </div>
  );
}
