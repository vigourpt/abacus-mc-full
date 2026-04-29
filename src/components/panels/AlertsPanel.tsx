'use client';

import { useState, useEffect, useCallback } from 'react';

interface Alert {
  id: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  source: string;
  timestamp: string;
  acknowledged: boolean;
  resolvedAt?: string;
}

export function AlertsPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    try {
      // Fetch from activity log, filter for alert-type events
      const res = await fetch('/api/activity?limit=50&type=alert');
      if (res.ok) {
        const data = await res.json();
        const mapped = (Array.isArray(data) ? data : []).map((entry: any) => ({
          id: entry.id,
          title: entry.metadata?.title || entry.message?.split(':')[0] || 'System Alert',
          message: entry.message || '',
          severity: entry.metadata?.severity || 'info',
          source: entry.metadata?.source || entry.type || 'system',
          timestamp: entry.createdAt || new Date().toISOString(),
          acknowledged: entry.metadata?.acknowledged || false,
          resolvedAt: entry.metadata?.resolvedAt,
        }));
        setAlerts(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch alerts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const severityColors: Record<string, string> = {
    info: 'text-blue-400 bg-blue-400/10 border-l-blue-400',
    warning: 'text-yellow-400 bg-yellow-400/10 border-l-yellow-400',
    error: 'text-red-400 bg-red-400/10 border-l-red-400',
    critical: 'text-red-500 bg-red-500/20 border-l-red-500',
  };

  const severityIcons: Record<string, string> = {
    info: 'ℹ️',
    warning: '⚠️',
    error: '❌',
    critical: '🚨',
  };

  const filtered = filter ? alerts.filter(a => a.severity === filter) : alerts;

  const handleAcknowledge = (id: string) => {
    setAlerts(alerts.map(a => a.id === id ? { ...a, acknowledged: true } : a));
    // Persist acknowledgment
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'alert_acknowledged', message: `Alert ${id} acknowledged`, metadata: { alertId: id } }),
    }).catch(() => {});
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
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-white">Alerts</h2>
          {alerts.filter(a => !a.acknowledged).length > 0 && (
            <span className="bg-red-500/20 text-red-400 px-2 py-1 rounded text-sm">
              {alerts.filter(a => !a.acknowledged).length} Unacknowledged
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {['all', 'critical', 'error', 'warning', 'info'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s === 'all' ? null : s)}
              className={`px-3 py-1 rounded text-sm capitalize transition-colors ${
                (s === 'all' && !filter) || filter === s
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">✅</span>
          <h3 className="text-lg font-medium text-white mb-2">No Alerts</h3>
          <p className="text-gray-400 text-sm">
            {filter ? `No ${filter} alerts found` : 'All systems are running smoothly'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((alert) => (
            <div
              key={alert.id}
              className={`border-l-4 rounded-r-lg p-4 ${severityColors[alert.severity]} ${alert.acknowledged ? 'opacity-60' : ''}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-xl">{severityIcons[alert.severity]}</span>
                  <div>
                    <h3 className="font-medium text-white">{alert.title}</h3>
                    <p className="text-sm text-gray-400 mt-1">{alert.message}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                      <span>Source: {alert.source}</span>
                      <span>•</span>
                      <span>{new Date(alert.timestamp).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                {!alert.acknowledged && (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                  >
                    Acknowledge
                  </button>
                )}
                {alert.acknowledged && alert.resolvedAt && (
                  <span className="text-green-400 text-xs">Resolved</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
