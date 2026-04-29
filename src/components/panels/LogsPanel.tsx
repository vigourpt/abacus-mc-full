'use client';

import { useState, useEffect, useCallback } from 'react';

interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export function LogsPanel() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/activity?limit=100');
      if (res.ok) {
        const data = await res.json();
        const mapped = (Array.isArray(data) ? data : []).map((entry: any, i: number) => ({
          id: entry.id || String(i),
          level: mapTypeToLevel(entry.type),
          source: entry.type || 'system',
          message: entry.message || '',
          timestamp: entry.createdAt || new Date().toISOString(),
          metadata: entry.metadata || undefined,
        }));
        setLogs(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const levelColors: Record<string, string> = {
    info: 'text-blue-400 bg-blue-400/10',
    warn: 'text-yellow-400 bg-yellow-400/10',
    error: 'text-red-400 bg-red-400/10',
    debug: 'text-gray-400 bg-gray-400/10',
  };

  const filtered = logs.filter((log) => {
    if (levelFilter && log.level !== levelFilter) return false;
    if (searchTerm && !log.message.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">System Logs</h2>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 w-48"
          />
          <select
            value={levelFilter || ''}
            onChange={(e) => setLevelFilter(e.target.value || null)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
          >
            <option value="">All Levels</option>
            <option value="info">Info</option>
            <option value="warn">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>
          <button
            onClick={fetchLogs}
            className="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm transition-colors"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
        <div className="max-h-[600px] overflow-y-auto font-mono text-sm">
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-4xl block mb-2">📝</span>
              <p className="text-gray-500">No logs found</p>
              <p className="text-xs text-gray-600 mt-1">
                Logs will appear here as agents perform operations
              </p>
            </div>
          ) : (
            filtered.map((log) => (
              <div
                key={log.id}
                className="border-b border-gray-800 p-3 hover:bg-gray-800/50"
              >
                <div className="flex items-start gap-3">
                  <span className="text-gray-600 text-xs whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-xs uppercase ${levelColors[log.level]}`}>
                    {log.level}
                  </span>
                  <span className="text-purple-400 text-xs">[{log.source}]</span>
                  <span className="text-gray-300 flex-1">{log.message}</span>
                </div>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <pre className="mt-2 ml-20 text-xs text-gray-500 bg-gray-800/50 p-2 rounded">
                    {JSON.stringify(log.metadata, null, 2)}
                  </pre>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function mapTypeToLevel(type: string): 'info' | 'warn' | 'error' | 'debug' {
  if (type?.includes('error') || type?.includes('fail')) return 'error';
  if (type?.includes('warn')) return 'warn';
  if (type?.includes('debug')) return 'debug';
  return 'info';
}
