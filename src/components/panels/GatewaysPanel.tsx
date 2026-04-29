'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAppStore } from '@/store';

interface Gateway {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  status: 'connected' | 'disconnected' | 'connecting';
  agentsRegistered: number;
  messagesProcessed: number;
  lastHeartbeat: string;
}

export function GatewaysPanel() {
  const [gateways, setGateways] = useState<Gateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const { setGatewayConnection } = useAppStore();
  const [newGateway, setNewGateway] = useState({ name: '', host: '', port: '18789' });
  const [error, setError] = useState<string | null>(null);

  const fetchGateways = useCallback(async () => {
    try {
      const res = await fetch('/api/gateways');
      if (res.ok) {
        const data = await res.json();
        // Map DB gateway_connections to our Gateway interface
        const mapped = (Array.isArray(data) ? data : []).map((g: any) => ({
          id: g.id,
          name: g.name || `${g.host}:${g.port}`,
          type: 'openclaw',
          host: g.host,
          port: g.port,
          status: g.status || 'disconnected',
          agentsRegistered: g.agentsRegistered || 0,
          messagesProcessed: g.messagesProcessed || 0,
          lastHeartbeat: g.last_connected || g.lastConnected || new Date().toISOString(),
        }));
        setGateways(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch gateways:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGateways();
  }, [fetchGateways]);

  const statusColors: Record<string, string> = {
    connected: 'text-green-400 bg-green-400/10',
    disconnected: 'text-red-400 bg-red-400/10',
    connecting: 'text-yellow-400 bg-yellow-400/10',
  };

  const handleConnect = async (id: string) => {
    setGateways(prev => prev.map(g =>
      g.id === id ? { ...g, status: g.status === 'connected' ? 'disconnected' : 'connecting' as const } : g
    ));

    try {
      const gateway = gateways.find(g => g.id === id);
      if (!gateway) return;

      const res = await fetch('/api/openclaw/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: gateway.host, port: gateway.port }),
      });

      if (res.ok) {
        const data = await res.json();
        setGateways(prev => prev.map(g =>
          g.id === id ? { ...g, status: 'connected', lastHeartbeat: new Date().toISOString() } : g
        ));
        // Update global gateway connection state
        if (data.connection) {
          setGatewayConnection(data.connection);
        }
      } else {
        setGateways(prev => prev.map(g =>
          g.id === id ? { ...g, status: 'disconnected' } : g
        ));
      }
    } catch {
      setGateways(prev => prev.map(g =>
        g.id === id ? { ...g, status: 'disconnected' } : g
      ));
    }
  };

  const handleAddGateway = async () => {
    if (!newGateway.host.trim()) {
      setError('Host is required');
      return;
    }
    setError(null);

    try {
      const res = await fetch('/api/gateways', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: newGateway.host.trim(),
          port: parseInt(newGateway.port) || 18789,
          name: newGateway.name.trim() || undefined,
        }),
      });

      if (res.ok) {
        setShowAddForm(false);
        setNewGateway({ name: '', host: '', port: '18789' });
        fetchGateways();
      } else {
        setError('Failed to add gateway');
      }
    } catch {
      setError('Failed to add gateway');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Help Instructions */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 text-sm">
        <div className="flex items-start gap-3">
          <span className="text-xl">🔗</span>
          <div>
            <h3 className="font-medium text-white mb-1">Gateway Connections</h3>
            <p className="text-gray-400 mb-2">
              Connect to OpenClaw gateways to enable agent functionality. Each gateway represents an OpenClaw instance that manages agents and processes tasks.
            </p>
            <ul className="text-gray-500 text-xs space-y-1">
              <li>• <strong>Status:</strong> Green = connected, Red = disconnected</li>
              <li>• <strong>Port:</strong> Default OpenClaw port is 45397</li>
              <li>• <strong>Connection:</strong> Click the connect button to establish connection</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Gateway Connections</h2>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          {showAddForm ? 'Cancel' : '+ Add Gateway'}
        </button>
      </div>

      {/* Add Gateway Form */}
      {showAddForm && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-medium text-white">Add New Gateway</h3>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name (optional)</label>
              <input
                type="text"
                value={newGateway.name}
                onChange={(e) => setNewGateway(prev => ({ ...prev, name: e.target.value }))}
                placeholder="My Gateway"
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Host *</label>
              <input
                type="text"
                value={newGateway.host}
                onChange={(e) => setNewGateway(prev => ({ ...prev, host: e.target.value }))}
                placeholder="localhost or IP"
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Port</label>
              <input
                type="number"
                value={newGateway.port}
                onChange={(e) => setNewGateway(prev => ({ ...prev, port: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={handleAddGateway}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded text-sm transition-colors"
          >
            Add Gateway
          </button>
        </div>
      )}

      {gateways.length === 0 && !showAddForm ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">🔌</span>
          <h3 className="text-lg font-medium text-white mb-2">No Gateways Configured</h3>
          <p className="text-gray-400 text-sm mb-4">
            Add an OpenClaw Gateway connection to enable real-time agent communication
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg text-sm transition-colors"
          >
            + Add Your First Gateway
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {gateways.map((gateway) => (
            <div
              key={gateway.id}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🤞</span>
                  <div>
                    <h3 className="font-medium text-white">{gateway.name}</h3>
                    <p className="text-sm text-gray-500">
                      {gateway.host}:{gateway.port} • {gateway.type}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs ${statusColors[gateway.status] || statusColors.disconnected}`}>
                    {gateway.status === 'connecting' && (
                      <span className="animate-pulse mr-1">●</span>
                    )}
                    {gateway.status}
                  </span>
                  <button
                    onClick={() => handleConnect(gateway.id)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      gateway.status === 'connected'
                        ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                        : 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                    }`}
                  >
                    {gateway.status === 'connected' ? 'Disconnect' : 'Connect'}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Agents Registered</p>
                  <p className="text-white font-medium">{gateway.agentsRegistered}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Messages Processed</p>
                  <p className="text-white font-medium">{gateway.messagesProcessed.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Last Heartbeat</p>
                  <p className="text-white">
                    {new Date(gateway.lastHeartbeat).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
