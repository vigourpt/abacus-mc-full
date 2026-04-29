'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';

interface Mod {
  id: string;
  name: string;
  description: string;
  icon: string;
  version: string;
  author: string;
  status: 'active' | 'inactive' | 'error';
  capabilities: string[];
  agents: string[];
  config: Record<string, any>;
  installedAt: string;
}

interface MCPServer {
  id: string;
  name: string;
  type: 'stdio' | 'http';
  status: 'connected' | 'disconnected' | 'error';
  tools: number;
  lastPing: string;
  config: {
    command?: string;
    args?: string[];
    url?: string;
  };
}

const AVAILABLE_MODS: Mod[] = [
  {
    id: 'mod-workspace',
    name: 'Workspace Manager',
    description: 'Manages agent workspaces, file operations, and sandboxed execution',
    icon: '📁',
    version: '2.1.0',
    author: 'OpenAgents',
    status: 'active',
    capabilities: ['file_ops', 'sandbox', 'git_ops'],
    agents: ['developer', 'tester'],
    config: {},
    installedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
  {
    id: 'mod-messaging',
    name: 'Advanced Messaging',
    description: 'Multi-channel messaging with threads, mentions, and file sharing',
    icon: '💬',
    version: '1.8.0',
    author: 'OpenAgents',
    status: 'active',
    capabilities: ['threads', 'mentions', 'attachments'],
    agents: ['coordinator', 'support'],
    config: {},
    installedAt: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
  {
    id: 'mod-data',
    name: 'Data Pipeline',
    description: 'ETL operations, database connectors, and data transformation',
    icon: '🗄️',
    version: '3.0.0',
    author: 'OpenAgents',
    status: 'active',
    capabilities: ['etl', 'db_connectors', 'transforms'],
    agents: ['analyst', 'developer'],
    config: {},
    installedAt: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
  {
    id: 'mod-web',
    name: 'Web Scraping',
    description: 'Browser automation, web scraping, and form submissions',
    icon: '🌐',
    version: '2.3.0',
    author: 'Community',
    status: 'inactive',
    capabilities: ['scraping', 'automation', 'forms'],
    agents: ['researcher'],
    config: {},
    installedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'mod-api',
    name: 'API Gateway',
    description: 'REST/GraphQL API creation, authentication, and rate limiting',
    icon: '🔌',
    version: '1.5.0',
    author: 'Community',
    status: 'active',
    capabilities: ['rest', 'graphql', 'auth', 'rate_limit'],
    agents: ['developer', 'architect'],
    config: {},
    installedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

const MCP_SERVERS: MCPServer[] = [
  {
    id: 'mcp-github',
    name: 'GitHub MCP',
    type: 'stdio',
    status: 'connected',
    tools: 12,
    lastPing: new Date(Date.now() - 5000).toISOString(),
    config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-github'] },
  },
  {
    id: 'mcp-filesystem',
    name: 'Filesystem MCP',
    type: 'stdio',
    status: 'connected',
    tools: 8,
    lastPing: new Date(Date.now() - 3000).toISOString(),
    config: { command: 'npx', args: ['-y', '@modelcontextprotocol/server-filesystem'] },
  },
  {
    id: 'mcp-brave',
    name: 'Brave Search MCP',
    type: 'http',
    status: 'connected',
    tools: 2,
    lastPing: new Date(Date.now() - 10000).toISOString(),
    config: { url: 'https://api.search.brave.com/mcp' },
  },
  {
    id: 'mcp-slack',
    name: 'Slack MCP',
    type: 'http',
    status: 'disconnected',
    tools: 6,
    lastPing: new Date(Date.now() - 3600000).toISOString(),
    config: { url: 'https://slack.com/api/mcp' },
  },
];

export function ModArchitecturePanel() {
  const { agents } = useAppStore();
  const [mods, setMods] = useState<Mod[]>(AVAILABLE_MODS);
  const [mcpServers, setMcpServers] = useState<MCPServer[]>(MCP_SERVERS);
  const [selectedMod, setSelectedMod] = useState<Mod | null>(null);
  const [activeTab, setActiveTab] = useState<'mods' | 'mcp' | 'architecture'>('mods');

  function toggleMod(modId: string) {
    setMods(prev => prev.map(mod => 
      mod.id === modId 
        ? { ...mod, status: mod.status === 'active' ? 'inactive' : 'active' as const }
        : mod
    ));
  }

  const stats = {
    totalMods: mods.length,
    activeMods: mods.filter(m => m.status === 'active').length,
    totalMCP: mcpServers.length,
    connectedMCP: mcpServers.filter(m => m.status === 'connected').length,
    totalTools: mcpServers.reduce((sum, m) => sum + m.tools, 0),
  };

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 p-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🧩</span>
          OpenAgents Mod Architecture
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Modular system with MCP server integration • Extensible agent capabilities
        </p>
      </div>

      {/* Stats Bar */}
      <div className="flex-shrink-0 border-b border-gray-800 px-4 py-3">
        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <span className="text-lg">📦</span>
            <div>
              <div className="text-sm font-medium text-white">{stats.totalMods} Mods</div>
              <div className="text-xs text-gray-500">{stats.activeMods} active</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🔌</span>
            <div>
              <div className="text-sm font-medium text-white">{stats.totalMCP} MCP Servers</div>
              <div className="text-xs text-gray-500">{stats.connectedMCP} connected</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-lg">🛠️</span>
            <div>
              <div className="text-sm font-medium text-white">{stats.totalTools} Tools</div>
              <div className="text-xs text-gray-500">available</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-gray-800 px-4">
        <div className="flex gap-1">
          {([
            { id: 'mods', label: 'Mods', icon: '📦' },
            { id: 'mcp', label: 'MCP Servers', icon: '🔌' },
            { id: 'architecture', label: 'Architecture', icon: '🏗️' },
          ] as const).map(tab => (
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
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'mods' && (
          <div className="space-y-4">
            {mods.map(mod => (
              <div
                key={mod.id}
                onClick={() => setSelectedMod(mod)}
                className={cn(
                  'bg-gray-800 rounded-lg p-4 cursor-pointer transition-all border',
                  selectedMod?.id === mod.id
                    ? 'border-cyan-500 ring-1 ring-cyan-500'
                    : 'border-gray-700 hover:border-gray-600'
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{mod.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-medium">{mod.name}</h3>
                      <span className={cn(
                        'px-2 py-0.5 rounded text-xs',
                        mod.status === 'active' && 'bg-green-500/20 text-green-400',
                        mod.status === 'inactive' && 'bg-gray-500/20 text-gray-400',
                        mod.status === 'error' && 'bg-red-500/20 text-red-400',
                      )}>
                        {mod.status}
                      </span>
                      <span className="text-xs text-gray-500">v{mod.version}</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-2">{mod.description}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-gray-500">By {mod.author}</span>
                      <span className="text-gray-600">•</span>
                      <span className="text-xs text-gray-500">{mod.capabilities.length} capabilities</span>
                      <span className="text-gray-600">•</span>
                      <span className="text-xs text-gray-500">{mod.agents.length} agents</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMod(mod.id);
                    }}
                    className={cn(
                      'px-3 py-1 rounded text-xs font-medium transition-colors',
                      mod.status === 'active'
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    )}
                  >
                    {mod.status === 'active' ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'mcp' && (
          <div className="space-y-4">
            {mcpServers.map(server => (
              <div key={server.id} className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">🔌</span>
                    <div>
                      <h3 className="text-white font-medium">{server.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className={cn(
                          'w-2 h-2 rounded-full',
                          server.status === 'connected' && 'bg-green-400',
                          server.status === 'disconnected' && 'bg-gray-400',
                          server.status === 'error' && 'bg-red-400',
                        )} />
                        {server.status}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-cyan-400">{server.tools}</div>
                    <div className="text-xs text-gray-500">tools</div>
                  </div>
                </div>
                
                <div className="bg-gray-700/50 rounded p-2 mb-3">
                  <div className="text-xs text-gray-500 mb-1">Configuration</div>
                  <code className="text-xs text-gray-300 font-mono">
                    {server.type === 'stdio' 
                      ? `${server.config.command} ${server.config.args?.join(' ')}`
                      : server.config.url
                    }
                  </code>
                </div>

                <div className="text-xs text-gray-500">
                  Last ping: {new Date(server.lastPing).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'architecture' && (
          <div className="space-y-4">
            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">🏗️ OpenAgents Mod Architecture</h3>
              
              <div className="space-y-4">
                {/* Layer 1 */}
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
                  <div className="text-sm font-medium text-blue-400 mb-2">Layer 1: Agent Core</div>
                  <div className="text-xs text-gray-400">
                    Base agent implementation with task handling, state management, and communication
                  </div>
                </div>

                {/* Arrows */}
                <div className="flex justify-center text-gray-600">↓</div>

                {/* Layer 2 */}
                <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-3">
                  <div className="text-sm font-medium text-purple-400 mb-2">Layer 2: Mod System</div>
                  <div className="text-xs text-gray-400 mb-2">
                    Pluggable modules that extend agent capabilities
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {['Workspace', 'Messaging', 'Data Pipeline', 'Web', 'API'].map(mod => (
                      <span key={mod} className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded">
                        {mod}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Arrows */}
                <div className="flex justify-center text-gray-600">↓</div>

                {/* Layer 3 */}
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                  <div className="text-sm font-medium text-green-400 mb-2">Layer 3: MCP Integration</div>
                  <div className="text-xs text-gray-400 mb-2">
                    Model Context Protocol servers for external tool access
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {['GitHub', 'Filesystem', 'Brave Search', 'Slack'].map(mcp => (
                      <span key={mcp} className="text-xs bg-green-500/20 text-green-300 px-2 py-0.5 rounded">
                        {mcp}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Arrows */}
                <div className="flex justify-center text-gray-600">↓</div>

                {/* Layer 4 */}
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-3">
                  <div className="text-sm font-medium text-orange-400 mb-2">Layer 4: External Services</div>
                  <div className="text-xs text-gray-400">
                    APIs, databases, browsers, and third-party integrations
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-800 rounded-lg p-4">
              <h3 className="text-white font-medium mb-3">Key Benefits</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-gray-700/50 rounded p-2">
                  <div className="text-cyan-400 font-medium mb-1">🔓 Extensible</div>
                  <div className="text-gray-400">Add new capabilities without modifying core agents</div>
                </div>
                <div className="bg-gray-700/50 rounded p-2">
                  <div className="text-cyan-400 font-medium mb-1">🔒 Sandboxed</div>
                  <div className="text-gray-400">Mods run in isolated contexts with controlled permissions</div>
                </div>
                <div className="bg-gray-700/50 rounded p-2">
                  <div className="text-cyan-400 font-medium mb-1">🔄 Composable</div>
                  <div className="text-gray-400">Combine multiple mods for complex workflows</div>
                </div>
                <div className="bg-gray-700/50 rounded p-2">
                  <div className="text-cyan-400 font-medium mb-1">🌐 Standard</div>
                  <div className="text-gray-400">MCP protocol for universal tool integration</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}