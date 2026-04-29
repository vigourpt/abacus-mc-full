'use client';

import { useState, useEffect, useCallback } from 'react';

interface NodeInfo {
  id: string;
  name: string;
  type: 'gateway' | 'worker' | 'orchestrator' | 'mission-control';
  status: 'online' | 'offline' | 'degraded';
  host: string;
  port: number;
  cpu: number;
  memory: number;
  activeConnections: number;
  lastHeartbeat: string;
}

export function NodesPanel() {
  const [nodes, setNodes] = useState<NodeInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNodes = useCallback(async () => {
    try {
      // Get system health for the current node
      const res = await fetch('/api/system/health');
      if (res.ok) {
        const health = await res.json();
        // Create a node entry for the current Mission Control instance
        const mcNode: NodeInfo = {
          id: 'mission-control-1',
          name: 'Mission Control',
          type: 'mission-control',
          status: health.status === 'healthy' ? 'online' : 'degraded',
          host: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
          port: typeof window !== 'undefined' ? parseInt(window.location.port) || 3000 : 3000,
          cpu: health.system?.cpuLoad ? Math.min(Math.round(health.system.cpuLoad * 10), 100) : 0,
          memory: health.system?.memoryUsagePercent || 0,
          activeConnections: health.database?.agents || 0,
          lastHeartbeat: health.timestamp || new Date().toISOString(),
        };
        setNodes([mcNode]);
      }

      // Also check for gateway connections to add as nodes
      const gwRes = await fetch('/api/gateways');
      if (gwRes.ok) {
        const gateways = await gwRes.json();
        if (Array.isArray(gateways) && gateways.length > 0) {
          const gwNodes: NodeInfo[] = gateways.map((gw: any) => ({
            id: `gw-${gw.id}`,
            name: gw.name || `Gateway ${gw.host}`,
            type: 'gateway' as const,
            status: gw.status === 'connected' ? 'online' as const : 'offline' as const,
            host: gw.host,
            port: gw.port,
            cpu: 0,
            memory: 0,
            activeConnections: 0,
            lastHeartbeat: gw.last_connected || new Date().toISOString(),
          }));
          setNodes(prev => [prev[0], ...gwNodes].filter(Boolean));
        }
      }
    } catch (err) {
      console.error('Failed to fetch nodes:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNodes();
    const interval = setInterval(fetchNodes, 15000);
    return () => clearInterval(interval);
  }, [fetchNodes]);

  const statusColors: Record<string, string> = {
    online: 'text-green-400 bg-green-400/10',
    offline: 'text-red-400 bg-red-400/10',
    degraded: 'text-yellow-400 bg-yellow-400/10',
  };

  const typeIcons: Record<string, string> = {
    'mission-control': '🎯',
    gateway: '🌐',
    worker: '⚙️',
    orchestrator: '🎯',
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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Nodes</h2>
        <button
          onClick={fetchNodes}
          className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="grid gap-4">
        {nodes.map((node) => (
          <div
            key={node.id}
            className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{typeIcons[node.type]}</span>
                <div>
                  <h3 className="font-medium text-white">{node.name}</h3>
                  <p className="text-sm text-gray-500">{node.host}:{node.port} • {node.type}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs capitalize ${statusColors[node.status]}`}>
                {node.status}
              </span>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">CPU</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${node.cpu > 80 ? 'bg-red-500' : node.cpu > 60 ? 'bg-yellow-500' : 'bg-green-500'}`}
                      style={{ width: `${Math.max(node.cpu, 2)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{node.cpu}%</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Memory</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${node.memory > 80 ? 'bg-red-500' : node.memory > 60 ? 'bg-yellow-500' : 'bg-cyan-500'}`}
                      style={{ width: `${Math.max(node.memory, 2)}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400">{node.memory}%</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Connections</p>
                <p className="text-white font-medium">{node.activeConnections}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Last Heartbeat</p>
                <p className="text-white text-sm">
                  {new Date(node.lastHeartbeat).toLocaleTimeString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
