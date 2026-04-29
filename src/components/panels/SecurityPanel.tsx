'use client';

import { useState, useEffect, useCallback } from 'react';

interface SecurityEvent {
  id: string;
  type: 'auth' | 'access' | 'scan' | 'config';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  details: string;
  timestamp: string;
  resolved: boolean;
}

export function SecurityPanel() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<any>(null);

  const fetchData = useCallback(async () => {
    try {
      // Fetch security-related activity
      const actRes = await fetch('/api/activity?limit=20&type=security');
      if (actRes.ok) {
        const data = await actRes.json();
        const mapped = (Array.isArray(data) ? data : []).map((entry: any) => ({
          id: entry.id,
          type: entry.metadata?.type || 'access',
          severity: entry.metadata?.severity || 'low',
          message: entry.message || '',
          details: entry.metadata?.details || '',
          timestamp: entry.createdAt || new Date().toISOString(),
          resolved: entry.metadata?.resolved || false,
        }));
        setEvents(mapped);
      }

      // Fetch system health
      const healthRes = await fetch('/api/system/health');
      if (healthRes.ok) {
        const health = await healthRes.json();
        setHealthStatus(health);
      }
    } catch (err) {
      console.error('Failed to fetch security data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const severityColors: Record<string, string> = {
    low: 'text-blue-400 bg-blue-400/10',
    medium: 'text-yellow-400 bg-yellow-400/10',
    high: 'text-orange-400 bg-orange-400/10',
    critical: 'text-red-400 bg-red-400/10',
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
      <h2 className="text-xl font-semibold text-white">Security & Audit</h2>

      {/* Security Score */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-green-400">
            {healthStatus?.status === 'healthy' ? '✓' : '⚠'}
          </p>
          <p className="text-sm text-gray-400 mt-1">System Health</p>
          <p className="text-xs text-gray-500">{healthStatus?.status || 'Unknown'}</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-cyan-400">
            {healthStatus?.database?.agents || 0}
          </p>
          <p className="text-sm text-gray-400 mt-1">Agents</p>
          <p className="text-xs text-gray-500">Registered</p>
        </div>
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center">
          <p className="text-3xl font-bold text-purple-400">
            {events.filter(e => !e.resolved).length}
          </p>
          <p className="text-sm text-gray-400 mt-1">Open Events</p>
          <p className="text-xs text-gray-500">Security events</p>
        </div>
      </div>

      {/* System Info */}
      {healthStatus?.system && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-medium text-white mb-3">System Information</h3>
          <div className="grid grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500 text-xs">Platform</p>
              <p className="text-white">{healthStatus.system.platform}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Node.js</p>
              <p className="text-white">{healthStatus.system.nodeVersion}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">Memory Usage</p>
              <p className="text-white">{healthStatus.system.memoryUsagePercent}%</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs">CPU Load</p>
              <p className="text-white">{healthStatus.system.cpuLoad}</p>
            </div>
          </div>
        </div>
      )}

      {/* Security Events */}
      <div>
        <h3 className="text-lg font-medium text-white mb-3">Security Events</h3>
        {events.length === 0 ? (
          <div className="text-center py-12 bg-gray-800/50 border border-gray-700 rounded-lg">
            <span className="text-4xl block mb-2">🔒</span>
            <p className="text-gray-400">No security events recorded</p>
            <p className="text-xs text-gray-500 mt-1">Security events will appear here as the system operates</p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => (
              <div
                key={event.id}
                className="bg-gray-800/50 border border-gray-700 rounded-lg p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs ${severityColors[event.severity]}`}>
                    {event.severity}
                  </span>
                  <div>
                    <p className="text-sm text-white">{event.message}</p>
                    {event.details && (
                      <p className="text-xs text-gray-500">{event.details}</p>
                    )}
                  </div>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(event.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
