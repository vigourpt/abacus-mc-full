'use client';

import { useState, useEffect, useCallback } from 'react';

interface Channel {
  id: string;
  name: string;
  type: 'telegram' | 'discord' | 'slack' | 'email' | 'webhook';
  status: 'connected' | 'disconnected' | 'error';
  agentsSubscribed: number;
  messagesProcessed: number;
  lastActivity: string;
}

const channelIcons: Record<string, string> = {
  telegram: '📱',
  discord: '🎮',
  slack: '💬',
  email: '📧',
  webhook: '🔗',
};

export function ChannelsPanel() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchChannels = useCallback(async () => {
    try {
      const res = await fetch('/api/openclaw/channels');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.channels)) {
          setChannels(data.channels);
        } else if (Array.isArray(data)) {
          setChannels(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch channels:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  const statusColors: Record<string, string> = {
    connected: 'text-green-400 bg-green-400/10',
    disconnected: 'text-gray-400 bg-gray-400/10',
    error: 'text-red-400 bg-red-400/10',
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
        <h2 className="text-xl font-semibold text-white">Channels</h2>
        <button className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
          + Add Channel
        </button>
      </div>

      {channels.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">📡</span>
          <h3 className="text-lg font-medium text-white mb-2">No Channels Configured</h3>
          <p className="text-gray-400 text-sm max-w-md mx-auto">
            Connect communication channels (Telegram, Slack, Discord) to enable agents to send and receive messages.
            Configure channels through the OpenClaw Gateway.
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{channelIcons[channel.type] || '📡'}</span>
                  <div>
                    <h3 className="font-medium text-white">{channel.name}</h3>
                    <p className="text-sm text-gray-500 capitalize">{channel.type}</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${statusColors[channel.status] || statusColors.disconnected}`}>
                  {channel.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Agents Subscribed</p>
                  <p className="text-white font-medium">{channel.agentsSubscribed}</p>
                </div>
                <div>
                  <p className="text-gray-500">Messages Processed</p>
                  <p className="text-white font-medium">{channel.messagesProcessed.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-gray-500">Last Activity</p>
                  <p className="text-white font-medium">
                    {new Date(channel.lastActivity).toLocaleTimeString()}
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
