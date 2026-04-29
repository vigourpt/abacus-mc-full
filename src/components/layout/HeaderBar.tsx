'use client';

import { useState } from 'react';
import { useAppStore } from '@/store';

export function HeaderBar() {
  const { agents, tasks, activePanel, gatewayConnection, setActivePanel } = useAppStore();
  const [showHelp, setShowHelp] = useState(false);

  const activeAgents = agents.filter((a) => a.status === 'active' || a.status === 'busy').length;
  const pendingTasks = tasks.filter((t) => t.status === 'inbox' || t.status === 'backlog').length;
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress').length;

  const isPanelActive = activePanel !== 'dashboard';

  const panelTitles: Record<string, string> = {
    dashboard: 'Dashboard',
    agents: 'Agent Management',
    tasks: 'Task Board',
    messages: 'Agent Messages',
    hiring: 'Agent Hiring',
    gateways: 'Gateway Connections',
    settings: 'Settings',
    chat: 'Chat',
    'agent-world': 'Agent World',
    visualizer: 'Agent World',
    pipeline: 'Pipeline',
    channels: 'Channels',
    skills: 'Skills',
    memory: 'Memory',
    activity: 'Activity',
    logs: 'Logs',
    'cost-tracker': 'Cost Tracker',
    nodes: 'Nodes',
    approvals: 'Approvals',
    office: 'Office',
    cron: 'Cron',
    webhooks: 'Webhooks',
    alerts: 'Alerts',
    github: 'GitHub',
    security: 'Security',
    analytics: 'Analytics',
  };

  return (
    <header className="bg-gray-800 border-b border-gray-700 px-3 md:px-6 py-3 md:py-4">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 flex items-center gap-2">
          {/* Back button for mobile when panel is active */}
          {isPanelActive && (
            <button
              onClick={() => setActivePanel('dashboard')}
              className="lg:hidden p-1.5 -ml-1 bg-gray-700 hover:bg-gray-600 rounded-lg text-white transition-colors"
              title="Back to Dashboard"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          )}
          <h1 className="text-lg md:text-xl font-semibold text-white truncate">
            {panelTitles[activePanel] || 'Dashboard'}
          </h1>
          <p className="text-xs md:text-sm text-gray-400 hidden sm:block">
            Autonomous AI Startup
          </p>
        </div>

        {/* Help Tooltip */}
        {showHelp && (
          <div className="absolute right-20 top-16 bg-gray-800 border border-gray-600 rounded-lg p-4 text-sm z-50 shadow-xl w-80">
            <h3 className="font-medium text-white mb-2">Quick Help</h3>
            <ul className="text-gray-400 space-y-2">
              <li><strong className="text-cyan-400">Gateways:</strong> Connect to OpenClaw to enable agents</li>
              <li><strong className="text-cyan-400">Tasks:</strong> Process tasks via /api/tasks/process</li>
              <li><strong className="text-cyan-400">Agents:</strong> View in left sidebar</li>
              <li><strong className="text-cyan-400">Channels:</strong> Telegram/CLI for messaging</li>
            </ul>
            <button 
              onClick={() => setShowHelp(false)}
              className="mt-3 text-xs text-gray-500 hover:text-gray-400"
            >
              Click outside to close
            </button>
          </div>
        )}

        <div className="flex items-center gap-4 md:gap-6">
          {/* Stats - hide some on mobile */}
          <div className="hidden sm:flex items-center gap-3 md:gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-green-400">🤖</span>
              <span className="text-gray-300">{activeAgents}</span>
            </div>
            <div className="hidden md:flex items-center gap-2">
              <span className="text-yellow-400">📋</span>
              <span className="text-gray-300">{pendingTasks}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-400">⚡</span>
              <span className="text-gray-300">{inProgressTasks}</span>
            </div>
          </div>

          {/* Gateway Status */}
          <div className="flex items-center gap-2 px-3 py-1 bg-gray-700 rounded-full">
            <span
              className={`w-2 h-2 rounded-full ${
                gatewayConnection?.status === 'connected'
                  ? 'bg-green-500'
                  : gatewayConnection?.status === 'connecting'
                  ? 'bg-yellow-500 animate-pulse'
                  : 'bg-gray-500'
              }`}
            ></span>
            <span className="text-xs text-gray-300">
              {gatewayConnection?.status === 'connected'
                ? 'OpenClaw Connected'
                : 'Gateway Disconnected'}
            </span>
          </div>

          {/* Help Button */}
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="text-gray-400 hover:text-white transition-colors"
            title="Quick Help"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
