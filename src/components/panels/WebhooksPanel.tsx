'use client';

import { useState, useEffect, useCallback } from 'react';

interface Webhook {
  id: string;
  name: string;
  url: string;
  method: 'POST' | 'GET' | 'PUT';
  events: string[];
  status: 'active' | 'inactive' | 'error';
  lastTriggered: string;
  successRate: number;
  totalCalls: number;
}

export function WebhooksPanel() {
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newWebhook, setNewWebhook] = useState({ name: '', url: '', events: '' });

  const fetchWebhooks = useCallback(async () => {
    try {
      const res = await fetch('/api/webhooks');
      if (res.ok) {
        const data = await res.json();
        setWebhooks(data);
      }
    } catch (err) {
      console.error('Failed to fetch webhooks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [fetchWebhooks]);

  const handleCreateWebhook = async () => {
    if (!newWebhook.name || !newWebhook.url) return;
    
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newWebhook),
      });
      
      if (res.ok) {
        const created = await res.json();
        setWebhooks(prev => [created, ...prev]);
        setNewWebhook({ name: '', url: '', events: '' });
        setShowCreateForm(false);
      }
    } catch (err) {
      console.error('Failed to create webhook:', err);
    }
  };

  const handleDeleteWebhook = async (id: string) => {
    try {
      const res = await fetch(`/api/webhooks?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setWebhooks(prev => prev.filter(w => w.id !== id));
      }
    } catch (err) {
      console.error('Failed to delete webhook:', err);
    }
  };

  const statusColors: Record<string, string> = {
    active: 'text-green-400 bg-green-400/10',
    inactive: 'text-gray-400 bg-gray-400/10',
    error: 'text-red-400 bg-red-400/10',
  };

  return (
    <div className="space-y-6">
      {/* Help Instructions */}
      <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 text-sm">
        <div className="flex items-start gap-3">
          <span className="text-xl">🔔</span>
          <div>
            <h3 className="font-medium text-white mb-1">Webhooks</h3>
            <p className="text-gray-400 mb-2">
              Webhooks allow external services to receive notifications when events occur in your startup system.
            </p>
            <ul className="text-gray-500 text-xs space-y-1">
              <li>• <strong>Events:</strong> task.completed, agent.error, task.created, agent.response</li>
              <li>• <strong>Method:</strong> POST is recommended for most integrations</li>
              <li>• <strong>Security:</strong> Your webhook URL should accept POST requests with JSON body</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Webhooks</h2>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          {showCreateForm ? 'Cancel' : '+ Add Webhook'}
        </button>
      </div>

      {showCreateForm && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-4">
          <h3 className="text-sm font-medium text-white">Create Webhook</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Name</label>
              <input
                type="text"
                value={newWebhook.name}
                onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                placeholder="My Webhook"
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">URL</label>
              <input
                type="url"
                value={newWebhook.url}
                onChange={(e) => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
                placeholder="https://example.com/webhook"
                className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Events (comma-separated)</label>
            <input
              type="text"
              value={newWebhook.events}
              onChange={(e) => setNewWebhook(prev => ({ ...prev, events: e.target.value }))}
              placeholder="task.completed, agent.error"
              className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-500"
            />
          </div>
          <button
            onClick={handleCreateWebhook}
            className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Create Webhook
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500 mx-auto"></div>
          <p className="text-gray-400 text-sm mt-4">Loading webhooks...</p>
        </div>
      ) : webhooks.length === 0 && !showCreateForm ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">🔔</span>
          <h3 className="text-lg font-medium text-white mb-2">No Webhooks Configured</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Set up webhooks to receive notifications when events occur in your startup system.
            Get notified about task completions, agent errors, and more.
          </p>
          <button
            onClick={() => setShowCreateForm(true)}
            className="mt-4 bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg text-sm transition-colors"
          >
            + Create Your First Webhook
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {webhooks.map((webhook) => (
            <div
              key={webhook.id}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🔗</span>
                  <div>
                    <h3 className="font-medium text-white">{webhook.name}</h3>
                    <p className="text-xs text-gray-500 font-mono truncate max-w-md">
                      {webhook.url}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="bg-gray-700 text-gray-300 px-2 py-0.5 rounded text-xs">
                    {webhook.method}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs ${statusColors[webhook.status]}`}>
                    {webhook.status}
                  </span>
                  <button
                    onClick={() => handleDeleteWebhook(webhook.id)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-3">
                {webhook.events.map((event) => (
                  <span
                    key={event}
                    className="bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded text-xs"
                  >
                    {event}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Last Triggered</p>
                  <p className="text-white">{webhook.lastTriggered ? new Date(webhook.lastTriggered).toLocaleString() : 'Never'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Success Rate</p>
                  <p className={`font-medium ${webhook.successRate > 95 ? 'text-green-400' : 'text-yellow-400'}`}>
                    {webhook.successRate}%
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Total Calls</p>
                  <p className="text-white">{webhook.totalCalls.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
