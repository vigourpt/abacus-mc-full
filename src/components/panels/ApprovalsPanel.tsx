'use client';

import { useState, useEffect, useCallback } from 'react';

interface Approval {
  id: string;
  type: 'task' | 'hiring' | 'deployment' | 'config';
  title: string;
  description: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export function ApprovalsPanel() {
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);

  const fetchApprovals = useCallback(async () => {
    try {
      // Fetch hiring requests as approvals
      const res = await fetch('/api/activity?limit=50&type=hiring_request');
      if (res.ok) {
        const data = await res.json();
        const mapped = (Array.isArray(data) ? data : []).map((entry: any) => ({
          id: entry.id,
          type: (entry.metadata?.type || 'hiring') as Approval['type'],
          title: entry.metadata?.title || entry.message || 'Approval Request',
          description: entry.metadata?.description || '',
          requestedBy: entry.metadata?.requestedBy || 'System',
          requestedAt: entry.createdAt || new Date().toISOString(),
          status: (entry.metadata?.status || 'pending') as Approval['status'],
          priority: (entry.metadata?.priority || 'medium') as Approval['priority'],
        }));
        setApprovals(mapped);
      }
    } catch (err) {
      console.error('Failed to fetch approvals:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApprovals();
  }, [fetchApprovals]);

  const priorityColors: Record<string, string> = {
    low: 'text-gray-400 bg-gray-400/10',
    medium: 'text-blue-400 bg-blue-400/10',
    high: 'text-orange-400 bg-orange-400/10',
    critical: 'text-red-400 bg-red-400/10',
  };

  const typeIcons: Record<string, string> = {
    task: '📋',
    hiring: '👥',
    deployment: '🚀',
    config: '⚙️',
  };

  const filtered = approvals.filter((a) => filter === 'all' || a.status === filter);

  const handleApprove = async (id: string) => {
    setApprovals(approvals.map(a => a.id === id ? { ...a, status: 'approved' } : a));
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'approval', message: `Request ${id} approved`, metadata: { requestId: id, action: 'approved' } }),
    }).catch(() => {});
  };

  const handleReject = async (id: string) => {
    setApprovals(approvals.map(a => a.id === id ? { ...a, status: 'rejected' } : a));
    await fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'approval', message: `Request ${id} rejected`, metadata: { requestId: id, action: 'rejected' } }),
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
          <h2 className="text-xl font-semibold text-white">Approvals</h2>
          {approvals.filter(a => a.status === 'pending').length > 0 && (
            <span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded text-sm">
              {approvals.filter(a => a.status === 'pending').length} Pending
            </span>
          )}
        </div>
        <div className="flex gap-2">
          {['pending', 'approved', 'rejected', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded text-sm capitalize transition-colors ${
                filter === f
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:text-white'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">✅</span>
          <h3 className="text-lg font-medium text-white mb-2">No Pending Approvals</h3>
          <p className="text-gray-400 text-sm">
            {filter === 'pending'
              ? 'All approvals have been processed'
              : `No ${filter === 'all' ? '' : filter} approvals found`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((approval) => (
            <div
              key={approval.id}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">{typeIcons[approval.type] || '📋'}</span>
                  <div>
                    <h3 className="font-medium text-white">{approval.title}</h3>
                    <p className="text-sm text-gray-500">{approval.description}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${priorityColors[approval.priority]}`}>
                  {approval.priority}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Requested by <span className="text-cyan-400">{approval.requestedBy}</span>
                  {' • '}
                  {new Date(approval.requestedAt).toLocaleDateString()}
                </div>

                {approval.status === 'pending' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(approval.id)}
                      className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-sm transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(approval.id)}
                      className="px-3 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded text-sm transition-colors"
                    >
                      Approve
                    </button>
                  </div>
                ) : (
                  <span className={`text-sm ${
                    approval.status === 'approved' ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {approval.status === 'approved' ? '✅ Approved' : '❌ Rejected'}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
