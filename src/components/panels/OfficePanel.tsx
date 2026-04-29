'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store';

interface Workspace {
  id: string;
  name: string;
  type: 'project' | 'team' | 'personal';
  members: string[];
  activeTasks: number;
  lastActivity: string;
}

export function OfficePanel() {
  const { agents } = useAppStore();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);

  useEffect(() => {
    setWorkspaces([
      {
        id: '1',
        name: 'Product Development',
        type: 'team',
        members: ['Developer Agent', 'Designer Agent', 'QA Agent'],
        activeTasks: 12,
        lastActivity: new Date().toISOString(),
      },
      {
        id: '2',
        name: 'Marketing Campaign Q1',
        type: 'project',
        members: ['Marketing Agent', 'Content Writer', 'SEO Specialist'],
        activeTasks: 8,
        lastActivity: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: '3',
        name: 'Sales Operations',
        type: 'team',
        members: ['Sales Agent', 'Account Manager'],
        activeTasks: 5,
        lastActivity: new Date(Date.now() - 7200000).toISOString(),
      },
    ]);
  }, []);

  const typeColors: Record<string, string> = {
    project: 'bg-purple-500/20 text-purple-400',
    team: 'bg-blue-500/20 text-blue-400',
    personal: 'bg-green-500/20 text-green-400',
  };

  // Group agents by division for org chart
  const divisions = [
    { name: 'Executive', emoji: '👔', count: agents.filter(a => a.division === 'executive').length },
    { name: 'Engineering', emoji: '💻', count: agents.filter(a => a.division === 'engineering').length },
    { name: 'Marketing', emoji: '📣', count: agents.filter(a => a.division === 'marketing').length },
    { name: 'Sales', emoji: '💰', count: agents.filter(a => a.division === 'sales').length },
    { name: 'Operations', emoji: '⚙️', count: agents.filter(a => a.division === 'operations').length },
    { name: 'Design', emoji: '🎨', count: agents.filter(a => a.division === 'design').length },
    { name: 'Testing', emoji: '🧪', count: agents.filter(a => a.division === 'testing').length },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Office</h2>

      {/* Org Overview */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <h3 className="text-sm font-medium text-white mb-4">Organization Overview</h3>
        <div className="grid grid-cols-4 gap-4">
          {divisions.filter(d => d.count > 0).map((div) => (
            <div key={div.name} className="text-center">
              <div className="w-12 h-12 rounded-full bg-gray-700 flex items-center justify-center mx-auto mb-2">
                <span className="text-xl">{div.emoji}</span>
              </div>
              <p className="text-sm text-white font-medium">{div.name}</p>
              <p className="text-xs text-gray-500">{div.count} agents</p>
            </div>
          ))}
        </div>
      </div>

      {/* Workspaces */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white">Workspaces</h3>
          <button className="text-cyan-400 hover:text-cyan-300 text-sm">
            + Create Workspace
          </button>
        </div>
        <div className="grid gap-4">
          {workspaces.map((workspace) => (
            <div
              key={workspace.id}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h4 className="font-medium text-white">{workspace.name}</h4>
                  <span className={`px-2 py-0.5 rounded text-xs capitalize ${typeColors[workspace.type]}`}>
                    {workspace.type}
                  </span>
                </div>
                <span className="text-sm text-gray-500">
                  {workspace.activeTasks} active tasks
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {workspace.members.slice(0, 3).map((member, i) => (
                    <div
                      key={i}
                      className="w-6 h-6 rounded-full bg-gray-600 border-2 border-gray-800 flex items-center justify-center text-xs text-white"
                    >
                      {member.charAt(0)}
                    </div>
                  ))}
                  {workspace.members.length > 3 && (
                    <div className="w-6 h-6 rounded-full bg-gray-600 border-2 border-gray-800 flex items-center justify-center text-xs text-white">
                      +{workspace.members.length - 3}
                    </div>
                  )}
                </div>
                <span className="text-sm text-gray-500">
                  {workspace.members.length} members
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
