'use client';

import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

interface GatewayAgent {
  id: string;
  name: string;
  gateway: string;
  status: string;
  emoji?: string;
  division?: string;
  capabilities?: string[];
}

interface GatewayStatus {
  name: string;
  connected: boolean;
  agentCount: number;
}

export function MultiAgentPanel() {
  const [agents, setAgents] = useState<GatewayAgent[]>([]);
  const [gateways, setGateways] = useState<GatewayStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<GatewayAgent | null>(null);
  const [commandLoading, setCommandLoading] = useState(false);

  useEffect(() => {
    fetchAgents();
    // Poll every 30 seconds
    const interval = setInterval(fetchAgents, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchAgents() {
    try {
      const res = await fetch('/api/gateways/multi');
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
        setGateways(data.gateways || []);
        setError(null);
      } else {
        setError('Failed to fetch agents');
      }
    } catch (err) {
      setError('Network error fetching agents');
    } finally {
      setLoading(false);
    }
  }

  async function sendCommand(gateway: string, agentId: string, command: string) {
    setCommandLoading(true);
    try {
      const res = await fetch('/api/gateways/multi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gateway,
          action: 'sendMessage',
          agentId,
          payload: { message: command },
        }),
      });
      const result = await res.json();
      alert(result.success ? `Command sent to ${gateway}!` : `Failed: ${result.error}`);
    } catch {
      alert('Command failed');
    } finally {
      setCommandLoading(false);
    }
  }

  const jarvisAgents = agents.filter(a => a.gateway === 'jarvis');
  const thorAgents = agents.filter(a => a.gateway === 'thor');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 text-red-400">
        {error}
        <button onClick={fetchAgents} className="ml-4 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 p-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🌐</span>
          Multi-Agent Control
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Control agents across multiple gateways from one interface
        </p>
      </div>

      {/* Gateway Status */}
      <div className="flex-shrink-0 border-b border-gray-800 p-4">
        <div className="flex gap-4">
          {gateways.map(gw => (
            <div key={gw.name} className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg border',
              gw.connected 
                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            )}>
              <span className={cn(
                'w-3 h-3 rounded-full',
                gw.connected ? 'bg-green-400' : 'bg-red-400'
              )} />
              <span className="font-medium capitalize">{gw.name}</span>
              <span className="text-sm">({gw.agentCount} agents)</span>
            </div>
          ))}
          <button
            onClick={fetchAgents}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white rounded-lg text-sm transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* Agents Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-6">
          {/* Jarvis Agents */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-cyan-400 uppercase flex items-center gap-2">
              <span>🤖</span> Jarvis Gateway
              <span className="text-xs text-gray-500">({jarvisAgents.length})</span>
            </h3>
            {jarvisAgents.length === 0 ? (
              <div className="bg-gray-800/50 rounded-lg p-4 text-center text-gray-500 text-sm">
                No agents connected
              </div>
            ) : (
              jarvisAgents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onSelect={() => setSelectedAgent(agent)}
                  onCommand={(cmd) => sendCommand('jarvis', agent.id, cmd)}
                />
              ))
            )}
          </div>

          {/* Thor Agents */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-orange-400 uppercase flex items-center gap-2">
              <span>⚡</span> Thor Gateway
              <span className="text-xs text-gray-500">({thorAgents.length})</span>
            </h3>
            {thorAgents.length === 0 ? (
              <div className="bg-gray-800/50 rounded-lg p-4 text-center text-gray-500 text-sm">
                No agents connected
              </div>
            ) : (
              thorAgents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onSelect={() => setSelectedAgent(agent)}
                  onCommand={(cmd) => sendCommand('thor', agent.id, cmd)}
                />
              ))
            )}
          </div>
        </div>

        {/* Selected Agent Detail */}
        {selectedAgent && (
          <div className="mt-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selectedAgent.emoji || '🤖'}</span>
                <div>
                  <h4 className="text-white font-medium">{selectedAgent.name}</h4>
                  <p className="text-sm text-gray-400">{selectedAgent.gateway} • {selectedAgent.status}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedAgent(null)}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
            {selectedAgent.capabilities && (
              <div className="flex flex-wrap gap-2">
                {selectedAgent.capabilities.map(cap => (
                  <span key={cap} className="px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
                    {cap}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({
  agent,
  onSelect,
  onCommand,
}: {
  agent: GatewayAgent;
  onSelect: () => void;
  onCommand: (cmd: string) => void;
}) {
  const [showCommand, setShowCommand] = useState(false);
  const [command, setCommand] = useState('');

  return (
    <div className="bg-gray-800 rounded-lg p-3 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-2xl">{agent.emoji || '🤖'}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-white truncate">{agent.name}</div>
          <div className="text-xs text-gray-500">{agent.division || 'Unknown division'}</div>
        </div>
        <span className={cn(
          'px-2 py-0.5 rounded text-xs font-medium',
          agent.status === 'active' && 'bg-green-500/20 text-green-400',
          agent.status === 'busy' && 'bg-yellow-500/20 text-yellow-400',
          agent.status === 'idle' && 'bg-gray-500/20 text-gray-400',
        )}>
          {agent.status}
        </span>
      </div>
      
      <div className="flex gap-2">
        <button
          onClick={onSelect}
          className="flex-1 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded transition-colors"
        >
          Details
        </button>
        <button
          onClick={() => setShowCommand(!showCommand)}
          className="flex-1 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 text-xs rounded transition-colors"
        >
          Command
        </button>
      </div>

      {showCommand && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Enter command..."
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && command.trim()) {
                onCommand(command);
                setCommand('');
                setShowCommand(false);
              }
            }}
          />
        </div>
      )}
    </div>
  );
}