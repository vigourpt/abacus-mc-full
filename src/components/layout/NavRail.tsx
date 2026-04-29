'use client';

import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  icon: string;
  label: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: '',
    items: [
      { id: 'dashboard', icon: '📊', label: 'Overview' },
      { id: 'agents', icon: '🤖', label: 'Agents' },
      { id: 'visualizer', icon: '🎮', label: 'Agent World' },
      { id: 'tasks', icon: '📋', label: 'Tasks' },
      { id: 'pipeline', icon: '🔄', label: 'Pipeline' },
      { id: 'chat', icon: '💬', label: 'Chat' },
      { id: 'channels', icon: '📡', label: 'Channels' },
      { id: 'skills', icon: '📚', label: 'Skills' },
      { id: 'memory', icon: '🧠', label: 'Memory' },
    ],
  },
  {
    title: 'OBSERVE',
    items: [
      { id: 'activity', icon: '⚡', label: 'Activity' },
      { id: 'logs', icon: '📝', label: 'Logs' },
      { id: 'cost-tracker', icon: '💰', label: 'Cost Tracker' },
      { id: 'nodes', icon: '🔗', label: 'Nodes' },
      { id: 'approvals', icon: '✅', label: 'Approvals' },
      { id: 'office', icon: '🏢', label: 'Office' },
    ],
  },
  {
    title: 'AUTOMATE',
    items: [
      { id: 'cron', icon: '⏰', label: 'Cron' },
      { id: 'webhooks', icon: '🔔', label: 'Webhooks' },
      { id: 'alerts', icon: '🚨', label: 'Alerts' },
      { id: 'github', icon: '🐙', label: 'GitHub' },
    ],
  },
  {
    title: 'ADMIN',
    items: [
      { id: 'hiring', icon: '💼', label: 'Hiring' },
      { id: 'security', icon: '🔒', label: 'Security' },
      { id: 'analytics', icon: '📈', label: 'Analytics' },
      { id: 'gateways', icon: '🔌', label: 'Gateways' },
      { id: 'settings', icon: '⚙️', label: 'Settings' },
    ],
  },
];

export function NavRail() {
  const { activePanel, setActivePanel, sidebarOpen, toggleSidebar } = useAppStore();

  return (
    <>
      {/* Mobile hamburger menu - fixed position safe area aware */}
      <button
        onClick={toggleSidebar}
        className="lg:hidden fixed top-4 left-4 z-50 p-3 bg-gray-800 rounded-lg text-white shadow-lg active:bg-gray-700"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
        aria-label="Toggle menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-sm"
          onClick={toggleSidebar}
        />
      )}

      <nav
        className={cn(
          'bg-gray-900 border-r border-gray-800 flex flex-col transition-all duration-200 h-dvh md:h-screen overflow-y-auto fixed lg:relative z-40',
          sidebarOpen ? 'w-52' : 'w-16',
          // Hide on mobile when collapsed
          !sidebarOpen && 'lg:w-16 w-0 lg:relative',
          sidebarOpen && 'w-52'
        )}
      >
      {/* Logo/Toggle */}
      <div className="p-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
        <button
          onClick={toggleSidebar}
          className="flex items-center gap-3 text-white hover:text-cyan-400 transition-colors w-full"
        >
          <span className="text-2xl">⭐</span>
          {sidebarOpen && (
            <div className="flex flex-col items-start">
              <span className="font-bold text-sm">Mission</span>
              <span className="text-xs text-gray-500">v0.0.9</span>
            </div>
          )}
        </button>
      </div>

      {/* Gateway Status */}
      {sidebarOpen && (
        <div className="px-4 py-2 border-b border-gray-800">
          <div className="bg-cyan-500/20 border border-cyan-500/30 rounded px-2 py-1 text-xs text-cyan-400">
            DW Connected
          </div>
        </div>
      )}

      {/* Navigation Sections */}
      <div className="flex-1 py-2">
        {navSections.map((section, sectionIndex) => (
          <div key={sectionIndex} className="mb-2">
            {section.title && sidebarOpen && (
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {section.title}
              </div>
            )}
            {section.items.map((item) => (
              <button
                key={item.id}
                onClick={() => setActivePanel(item.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors',
                  activePanel === item.id
                    ? 'bg-cyan-500/20 text-cyan-400 border-l-2 border-cyan-400'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                )}
              >
                <span className="text-lg flex-shrink-0">{item.icon}</span>
                {sidebarOpen && (
                  <span className="text-sm truncate">{item.label}</span>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Bottom Section */}
      <div className="border-t border-gray-800 p-2 sticky bottom-0 bg-gray-900">
        {/* Plugin Badges */}
        {sidebarOpen && (
          <div className="space-y-1 mb-2">
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500">
              <span className="bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded text-xs">xint</span>
              <span>CLI</span>
            </div>
            <div className="flex items-center gap-2 px-2 py-1 text-xs text-gray-500">
              <span className="bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded text-xs">builderz</span>
              <span>DEV</span>
            </div>
          </div>
        )}
        
        {/* Admin */}
        <div className="flex items-center gap-2 px-2 py-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 flex items-center justify-center text-xs font-bold text-white">
            A
          </div>
          {sidebarOpen && (
            <div className="flex flex-col">
              <span className="font-medium text-white">Admin</span>
              <span className="text-xs text-gray-500">openclaw</span>
            </div>
          )}
        </div>
      </div>
    </nav>
    </>
  );
}
