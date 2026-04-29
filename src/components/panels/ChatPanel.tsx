'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/store';

interface Message {
  id: string;
  agentId: string;
  agentName: string;
  agentEmoji: string;
  content: string;
  timestamp: string;
  type: 'message' | 'system' | 'task' | 'user';
  pending?: boolean;
}

export function ChatPanel() {
  const { agents, gatewayConnection } = useAppStore();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'error'>('disconnected');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastMessageTimeRef = useRef<string>('');

  // Check OpenClaw connection status
  useEffect(() => {
    async function checkConnection() {
      try {
        const res = await fetch('/api/openclaw/status');
        const data = await res.json();
        setConnectionStatus(data.connection?.status === 'connected' ? 'connected' : 'disconnected');
      } catch {
        setConnectionStatus('error');
      }
    }
    checkConnection();
    const interval = setInterval(checkConnection, 5000);
    return () => clearInterval(interval);
  }, []);

  // Load messages from activity API
  const loadMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/activity?limit=50');
      if (res.ok) {
        const activity = await res.json();
        
        // Convert activity to messages, avoiding duplicates
        const newMessages: Message[] = [];
        for (const item of activity) {
          if (item.createdAt > lastMessageTimeRef.current) {
            newMessages.push({
              id: item.id,
              agentId: item.agentId || 'system',
              agentName: item.agentId ? getAgentName(item.agentId) : 'System',
              agentEmoji: item.agentId ? getAgentEmoji(item.agentId) : '🔔',
              content: item.message,
              timestamp: item.createdAt,
              type: item.type === 'task_processed' ? 'task' : 'system',
            });
          }
        }
        
        if (newMessages.length > 0) {
          lastMessageTimeRef.current = activity[0]?.createdAt || '';
          setMessages(prev => [...newMessages.reverse(), ...prev].slice(0, 100));
        }
      }
    } catch (err) {
      console.error('Failed to load messages:', err);
    }
  }, [agents]);

  // Initial load and polling
  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [loadMessages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getAgentName = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent?.name || 'Agent';
  };

  const getAgentEmoji = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    return agent?.emoji || '🤖';
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isSending || connectionStatus !== 'connected') return;
    
    setIsSending(true);
    const messageText = inputMessage.trim();
    
    // Check for special commands
    if (messageText.startsWith('/task ')) {
      // Create a task from the message
      const taskTitle = messageText.replace('/task ', '').trim();
      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: taskTitle,
            description: 'Created from chat',
            priority: 'medium',
            status: 'todo',
          }),
        });
        if (res.ok) {
          const task = await res.json();
          // Also process the task immediately
          await fetch('/api/tasks/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ taskId: task.id }),
          });
        }
      } catch (err) {
        console.error('Failed to create task:', err);
      }
      setInputMessage('');
      setIsSending(false);
      loadMessages();
      return;
    }
    
    // Add user message immediately with pending state
    const tempId = `pending-${Date.now()}`;
    const userMessage: Message = {
      id: tempId,
      agentId: 'user',
      agentName: 'You',
      agentEmoji: '👤',
      content: messageText,
      timestamp: new Date().toISOString(),
      type: 'user',
      pending: true,
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    
    try {
      // Send via OpenClaw API
      const res = await fetch('/api/openclaw/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId: 'mission-control-test',
          content: messageText,
          format: 'markdown',
          broadcast: true,
        }),
      });
      
      const data = await res.json();
      
      // Update pending message
      setMessages(prev => prev.map(m => 
        m.id === tempId 
          ? { ...m, pending: false }
          : m
      ));
      
      if (!res.ok) {
        console.error('Failed to send message:', data.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Error sending message:', err);
      // Mark as failed
      setMessages(prev => prev.map(m => 
        m.id === tempId 
          ? { ...m, pending: false }
          : m
      ));
    }
    
    setIsSending(false);
  };

  // Filter messages by selected agent
  const filteredMessages = selectedAgent
    ? messages.filter(m => m.agentId === selectedAgent || m.type === 'user')
    : messages;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold text-white">Agent Chat</h2>
          <span className={`w-2 h-2 rounded-full ${
            connectionStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'
          }`} title={connectionStatus === 'connected' ? 'Connected to OpenClaw' : 'Not connected'} />
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedAgent || ''}
            onChange={(e) => setSelectedAgent(e.target.value || null)}
            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white max-w-[150px] md:max-w-[180px]"
          >
            <option value="">All Messages</option>
            {agents.slice(0, 10).map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.emoji} {agent.name.slice(0, 12)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Connection warning / Commands help */}
      <div className="mb-3 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-xs text-gray-400 flex-shrink-0 flex flex-wrap gap-3">
        {connectionStatus !== 'connected' ? (
          <span className="text-red-400">⚠️ Not connected to OpenClaw</span>
        ) : (
          <span>✓ Connected</span>
        )}
        <span className="hidden sm:inline">|</span>
        <span><code className="bg-gray-700 px-1 rounded">/task [title]</code> to create & process a task</span>
      </div>

      {/* Messages Area */}
      <div className="flex-1 bg-gray-800/50 rounded-lg border border-gray-700 p-3 md:p-4 space-y-3 overflow-y-auto min-h-0 mb-4">
        {filteredMessages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No messages yet</p>
            <p className="text-sm">Send a message below to start chatting</p>
          </div>
        ) : (
          filteredMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 md:gap-3 ${msg.type === 'system' || msg.type === 'task' ? 'justify-center' : msg.type === 'user' ? 'justify-end' : ''}`}
            >
              {msg.type === 'user' ? (
                <div className={`bg-cyan-600/20 border border-cyan-500/30 rounded-lg px-3 py-2 max-w-[80%] ${msg.pending ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-cyan-400 text-sm">{msg.agentName}</span>
                    {msg.pending && <span className="text-xs text-gray-400">(sending...)</span>}
                  </div>
                  <p className="text-gray-200 text-sm">{msg.content}</p>
                </div>
              ) : msg.type === 'system' || msg.type === 'task' ? (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded px-2 md:px-3 py-1 md:py-2">
                  <p className="text-yellow-400 text-xs">{msg.content}</p>
                </div>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center flex-shrink-0 text-sm">
                    {msg.agentEmoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-white text-sm">{msg.agentName}</span>
                      <span className="text-xs text-gray-500">
                        {new Date(msg.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-300 text-sm break-words">{msg.content}</p>
                  </div>
                </>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex gap-2 flex-shrink-0">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder={connectionStatus === 'connected' ? "Message... (or /task to create task)" : "Connect to OpenClaw first..."}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
          disabled={isSending || connectionStatus !== 'connected'}
        />
        <button
          onClick={handleSendMessage}
          disabled={!inputMessage.trim() || isSending || connectionStatus !== 'connected'}
          className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 md:px-6 py-3 rounded-lg transition-colors font-medium whitespace-nowrap"
        >
          {isSending ? '...' : 'Send'}
        </button>
      </div>
    </div>
  );
}
