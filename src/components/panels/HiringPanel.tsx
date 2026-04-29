'use client';

import { useState, useEffect, useCallback } from 'react';

interface HiringRequest {
  id: string;
  role: string;
  division: string;
  suggestedBy: string;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'approved' | 'rejected' | 'hired' | 'completed';
  createdAt: string;
  skills: string[];
}

export function HiringPanel() {
  const [requests, setRequests] = useState<HiringRequest[]>([]);
  const [filter, setFilter] = useState('pending');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newRequest, setNewRequest] = useState({ role: '', division: 'engineering', reason: '', skills: '', priority: 'medium' });
  const [loading, setLoading] = useState(true);

  const loadRequests = useCallback(async () => {
    try {
      const res = await fetch(`/api/hiring?status=${filter}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const priorityColors: Record<string, string> = {
    low: 'text-gray-400 bg-gray-400/10',
    medium: 'text-blue-400 bg-blue-400/10',
    high: 'text-orange-400 bg-orange-400/10',
    critical: 'text-red-400 bg-red-400/10',
  };

  const statusColors: Record<string, string> = {
    pending: 'text-yellow-400 bg-yellow-400/10',
    approved: 'text-green-400 bg-green-400/10',
    rejected: 'text-red-400 bg-red-400/10',
    hired: 'text-cyan-400 bg-cyan-400/10',
    completed: 'text-cyan-400 bg-cyan-400/10',
  };

  const handleApprove = async (id: string) => {
    try {
      const res = await fetch(`/api/hiring/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id }),
      });
      if (res.ok) {
        loadRequests();
      }
    } catch (err) {
      console.error('Failed to approve:', err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      const res = await fetch(`/api/hiring/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id }),
      });
      if (res.ok) {
        loadRequests();
      }
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  };

  const handleHire = async (id: string) => {
    try {
      const res = await fetch(`/api/hiring/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: id }),
      });
      if (res.ok) {
        const data = await res.json();
        alert(`Agent "${data.agent?.name}" created successfully!`);
        loadRequests();
      }
    } catch (err) {
      console.error('Failed to hire:', err);
    }
  };

  const handleCreateRequest = async () => {
    if (!newRequest.role) return;
    
    try {
      const res = await fetch('/api/hiring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: newRequest.role,
          division: newRequest.division,
          reason: newRequest.reason,
          skills: newRequest.skills.split(',').map(s => s.trim()).filter(Boolean),
          priority: newRequest.priority,
        }),
      });
      
      if (res.ok) {
        setNewRequest({ role: '', division: 'engineering', reason: '', skills: '', priority: 'medium' });
        setShowCreateForm(false);
        loadRequests();
      }
    } catch (err) {
      console.error('Failed to create request:', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Help */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 text-sm">
        <div className="flex items-start gap-3">
          <span className="text-xl">💼</span>
          <div>
            <h3 className="font-medium text-white mb-1">Agent Hiring</h3>
            <p className="text-gray-400">
              Review requests to hire new agents. Approve and create agents when needed.
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-white">Agent Hiring</h2>
          <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded text-sm">
            {requests.filter(r => r.status === 'pending').length} Pending
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-3 py-1 bg-cyan-600 text-white rounded text-sm hover:bg-cyan-700"
          >
            + New Request
          </button>
          {['pending', 'approved', 'completed', 'all'].map((f) => (
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

      {/* Create Form */}
      {showCreateForm && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
          <h3 className="font-medium text-white">New Hiring Request</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Role *</label>
              <input
                type="text"
                value={newRequest.role}
                onChange={(e) => setNewRequest({ ...newRequest, role: e.target.value })}
                placeholder="e.g., Senior Frontend Developer"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Division</label>
              <select
                value={newRequest.division}
                onChange={(e) => setNewRequest({ ...newRequest, division: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              >
                <option value="engineering">Engineering</option>
                <option value="marketing">Marketing</option>
                <option value="sales">Sales</option>
                <option value="operations">Operations</option>
                <option value="design">Design</option>
                <option value="product">Product</option>
                <option value="testing">Testing</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Priority</label>
              <select
                value={newRequest.priority}
                onChange={(e) => setNewRequest({ ...newRequest, priority: e.target.value })}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Skills (comma-separated)</label>
              <input
                type="text"
                value={newRequest.skills}
                onChange={(e) => setNewRequest({ ...newRequest, skills: e.target.value })}
                placeholder="React, TypeScript, CSS"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1">Reason</label>
              <input
                type="text"
                value={newRequest.reason}
                onChange={(e) => setNewRequest({ ...newRequest, reason: e.target.value })}
                placeholder="Why is this agent needed?"
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCreateRequest}
              className="px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700"
            >
              Create Request
            </button>
            <button
              onClick={() => setShowCreateForm(false)}
              className="px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Loading / Empty state */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading requests...</div>
      ) : requests.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <p>No hiring requests</p>
          <p className="text-sm">Click "+ New Request" to create one</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request.id}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-white">{request.role}</h3>
                    <span className={`px-2 py-0.5 rounded text-xs ${priorityColors[request.priority]}`}>
                      {request.priority}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs ${statusColors[request.status]}`}>
                      {request.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">Division: {request.division}</p>
                </div>
                <span className="text-xs text-gray-500">
                  {new Date(request.createdAt).toLocaleDateString()}
                </span>
              </div>

              <p className="text-sm text-gray-400 mb-3">{request.reason}</p>

              {request.skills?.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {request.skills.map((skill) => (
                    <span
                      key={skill}
                      className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-xs"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-700">
                <span className="text-xs text-gray-500">
                  Suggested by: <span className="text-cyan-400">{request.suggestedBy}</span>
                </span>
                <div className="flex gap-2">
                  {request.status === 'pending' && (
                    <>
                      <button
                        onClick={() => handleReject(request.id)}
                        className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-sm transition-colors"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => handleApprove(request.id)}
                        className="px-3 py-1 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded text-sm transition-colors"
                      >
                        Approve
                      </button>
                    </>
                  )}
                  {request.status === 'approved' && (
                    <button
                      onClick={() => handleHire(request.id)}
                      className="px-3 py-1 bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded text-sm transition-colors"
                    >
                      Create Agent
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
