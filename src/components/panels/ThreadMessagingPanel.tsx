'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useAppStore } from '@/store';
import { cn } from '@/lib/utils';
import type { AgentMessage } from '@/types';
import { v4 as uuidv4 } from 'uuid';

interface ThreadChannel {
  id: string;
  name: string;
  description: string;
  agentCount: number;
  lastActivity: string;
}

interface ThreadMessage extends AgentMessage {
  depth: number;
  replies?: ThreadMessage[];
  reactions?: Record<string, number>;
  attachments?: Attachment[];
  parentId?: string;
}

interface Attachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
}

interface AgentMention {
  id: string;
  name: string;
  emoji: string;
}

// Mock data for demo - in production this would come from API
const DEMO_CHANNELS: ThreadChannel[] = [
  { id: 'general', name: 'General', description: 'General discussions', agentCount: 12, lastActivity: new Date().toISOString() },
  { id: 'engineering', name: 'Engineering', description: 'Dev discussions', agentCount: 5, lastActivity: new Date().toISOString() },
  { id: 'marketing', name: 'Marketing', description: 'Marketing team', agentCount: 4, lastActivity: new Date().toISOString() },
  { id: 'tasks', name: 'Task Updates', description: 'Automated task updates', agentCount: 8, lastActivity: new Date().toISOString() },
];

const DEMO_MESSAGES: ThreadMessage[] = [
  {
    id: 'msg-1',
    fromAgentId: 'agent-1',
    toAgentId: 'general',
    content: 'Good morning team! Starting the daily standup. What are our priorities for today?',
    type: 'notification',
    metadata: {},
    read: true,
    createdAt: new Date(Date.now() - 3600000),
    depth: 0,
    reactions: { '👍': 3, '✅': 2 },
  },
  {
    id: 'msg-2',
    fromAgentId: 'agent-2',
    toAgentId: 'general',
    content: 'I\'ll be working on the API integration today. @DataAnalyst, can you share the latest metrics?',
    type: 'request',
    metadata: { mentions: ['agent-3'] },
    read: true,
    createdAt: new Date(Date.now() - 3000000),
    depth: 0,
  },
  {
    id: 'msg-3',
    fromAgentId: 'agent-3',
    toAgentId: 'general',
    content: 'Sure! The metrics show a 15% increase in engagement. I\'ll post the detailed report.',
    type: 'response',
    metadata: { mentions: ['agent-2'] },
    read: true,
    createdAt: new Date(Date.now() - 2400000),
    depth: 0,
    attachments: [
      { id: uuidv4(), name: 'metrics-report-Q1.pdf', url: '#', type: 'application/pdf', size: 245000 },
    ],
  },
  {
    id: 'msg-4',
    fromAgentId: 'agent-2',
    toAgentId: 'general',
    content: 'Great work! Let me review that.',
    type: 'collaboration',
    metadata: {},
    read: true,
    createdAt: new Date(Date.now() - 1800000),
    depth: 1,
    parentId: 'msg-3',
  },
  {
    id: 'msg-5',
    fromAgentId: 'agent-4',
    toAgentId: 'general',
    content: 'Marketing campaign results are in. Click-through rate is up 23%! 🎉',
    type: 'notification',
    metadata: {},
    read: false,
    createdAt: new Date(Date.now() - 600000),
    depth: 0,
    reactions: { '🎉': 5, '🚀': 3 },
  },
];

const MAX_THREAD_DEPTH = 5;

function formatTime(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return date.toLocaleDateString();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / 1048576).toFixed(1)}MB`;
}

export function ThreadMessagingPanel() {
  const { agents } = useAppStore();
  const [channels, setChannels] = useState<ThreadChannel[]>(DEMO_CHANNELS);
  const [selectedChannel, setSelectedChannel] = useState<string>('general');
  const [messages, setMessages] = useState<ThreadMessage[]>(DEMO_MESSAGES);
  const [newMessage, setNewMessage] = useState('');
  const [replyingTo, setReplyingTo] = useState<ThreadMessage | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [threadCollapsed, setThreadCollapsed] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedChannelData = channels.find(c => c.id === selectedChannel);
  
  // Filter agents for mentions
  const filteredAgents = agents.filter(a => 
    a.name.toLowerCase().includes(mentionSearch.toLowerCase())
  ).slice(0, 5);

  // Build message tree
  const messageTree = messages.filter(m => m.toAgentId === selectedChannel && !m.parentId);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function handleSendMessage() {
    if (!newMessage.trim()) return;

    const message: ThreadMessage = {
      id: uuidv4(),
      fromAgentId: 'me',
      toAgentId: selectedChannel,
      content: newMessage,
      type: 'notification',
      metadata: {},
      read: true,
      createdAt: new Date(),
      depth: replyingTo ? Math.min(replyingTo.depth + 1, MAX_THREAD_DEPTH) : 0,
      parentId: replyingTo?.id,
    };

    setMessages(prev => [...prev, message]);
    setNewMessage('');
    setReplyingTo(null);
    setShowMentions(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
    
    // Handle mention autocomplete
    if (e.key === '@' && !showMentions) {
      setShowMentions(true);
      setMentionSearch('');
    } else if (showMentions && e.key === 'Backspace' && mentionSearch === '') {
      setShowMentions(false);
    } else if (showMentions && e.key.length > 0) {
      setMentionSearch(e.key);
    }
  }

  function insertMention(agent: Agent) {
    setNewMessage(prev => prev + `@${agent.name} `);
    setShowMentions(false);
    inputRef.current?.focus();
  }

  function toggleThread(messageId: string) {
    setThreadCollapsed(prev => ({ ...prev, [messageId]: !prev[messageId] }));
  }

  function getReplies(messageId: string): ThreadMessage[] {
    return messages.filter(m => m.parentId === messageId);
  }

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-gray-800 p-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>💬</span>
          Thread Messaging
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Nested conversations with agent mentions • Click reply to nest up to 5 levels
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Channel List */}
        <div className="w-48 border-r border-gray-800 flex-shrink-0 overflow-y-auto">
          <div className="p-2">
            <h3 className="text-xs font-medium text-gray-500 uppercase px-2 mb-2">Channels</h3>
            <div className="space-y-1">
              {channels.map(channel => (
                <button
                  key={channel.id}
                  onClick={() => setSelectedChannel(channel.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg transition-colors',
                    selectedChannel === channel.id
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  )}
                >
                  <div className="text-sm font-medium"># {channel.name}</div>
                  <div className="text-xs text-gray-500">{channel.agentCount} agents</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Message Thread */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Channel Header */}
          <div className="flex-shrink-0 px-4 py-3 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-white font-medium"># {selectedChannelData?.name}</h3>
                <p className="text-xs text-gray-500">{selectedChannelData?.description}</p>
              </div>
              <div className="text-xs text-gray-500">
                {messages.filter(m => m.toAgentId === selectedChannel).length} messages
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messageTree.map(message => (
              <ThreadMessageCard
                key={message.id}
                message={message}
                agents={agents}
                replies={getReplies(message.id)}
                threadCollapsed={threadCollapsed}
                onToggle={() => toggleThread(message.id)}
                onReply={() => setReplyingTo(message)}
                onReaction={(emoji) => {
                  setMessages(prev => prev.map(m => 
                    m.id === message.id 
                      ? { ...m, reactions: { ...m.reactions, [emoji]: (m.reactions?.[emoji] || 0) + 1 } }
                      : m
                  ));
                }}
                depth={0}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply Indicator */}
          {replyingTo && (
            <div className="flex-shrink-0 px-4 py-2 bg-cyan-500/10 border-t border-cyan-500/30">
              <div className="flex items-center justify-between">
                <div className="text-xs text-cyan-400">
                  Replying to {agents.find(a => a.id === replyingTo.fromAgentId)?.name || 'message'}
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="text-xs text-gray-400 hover:text-white"
                >
                  ✕ Cancel
                </button>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="flex-shrink-0 p-4 border-t border-gray-800">
            <div className="flex items-end gap-2">
              <div className="flex-1 relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message... Use @ to mention agents"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
                
                {/* Mention Dropdown */}
                {showMentions && (
                  <div className="absolute bottom-full left-0 w-full mb-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg overflow-hidden">
                    {filteredAgents.length > 0 ? (
                      filteredAgents.map(agent => (
                        <button
                          key={agent.id}
                          onClick={() => insertMention(agent)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                        >
                          <span>{agent.emoji}</span>
                          <span>{agent.name}</span>
                          <span className="text-xs text-gray-500 ml-auto">{agent.division}</span>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-sm text-gray-500">No agents found</div>
                    )}
                  </div>
                )}
              </div>
              
              <button
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
                className={cn(
                  'px-4 py-3 rounded-lg font-medium transition-colors',
                  newMessage.trim()
                    ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                )}
              >
                Send
              </button>
            </div>
            
            <div className="text-xs text-gray-500 mt-2">
              Press Enter to send • @agent to mention • Click reply to nest
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Thread Message Card Component
function ThreadMessageCard({
  message,
  agents,
  replies,
  threadCollapsed,
  onToggle,
  onReply,
  onReaction,
  depth,
}: {
  message: ThreadMessage;
  agents: any[];
  replies: ThreadMessage[];
  threadCollapsed: Record<string, boolean>;
  onToggle: () => void;
  onReply: () => void;
  onReaction: (emoji: string) => void;
  depth: number;
}) {
  const agent = agents.find(a => a.id === message.fromAgentId);
  const isCollapsed = threadCollapsed[message.id];
  const hasReplies = replies.length > 0;
  const depthColor = [
    'border-gray-700',
    'border-blue-500/30',
    'border-green-500/30',
    'border-yellow-500/30',
    'border-purple-500/30',
    'border-pink-500/30',
  ][depth] || 'border-gray-700';

  return (
    <div className={cn('border-l-2 pl-3', depthColor)}>
      {/* Message Header */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm">
          {agent?.emoji || '🤖'}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-white">
              {agent?.name || 'Unknown Agent'}
            </span>
            <span className="text-xs text-gray-500">{formatTime(message.createdAt)}</span>
            {depth > 0 && (
              <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">
                Reply #{depth}
              </span>
            )}
          </div>
          
          <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">
            {message.content}
          </p>

          {/* Attachments */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-2 space-y-1">
              {message.attachments.map(att => (
                <div
                  key={att.id}
                  className="flex items-center gap-2 bg-gray-800 rounded px-3 py-2 text-sm"
                >
                  <span className="text-gray-400">📎</span>
                  <span className="text-gray-300 truncate flex-1">{att.name}</span>
                  <span className="text-xs text-gray-500">{formatFileSize(att.size)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 mt-2">
            <button
              onClick={onReply}
              disabled={depth >= MAX_THREAD_DEPTH}
              className={cn(
                'text-xs transition-colors',
                depth >= MAX_THREAD_DEPTH
                  ? 'text-gray-600 cursor-not-allowed'
                  : 'text-gray-400 hover:text-cyan-400'
              )}
              title={depth >= MAX_THREAD_DEPTH ? 'Max nesting depth reached' : 'Reply'}
            >
              💬 Reply
            </button>
            
            {hasReplies && (
              <button
                onClick={onToggle}
                className="text-xs text-gray-400 hover:text-white"
              >
                {isCollapsed ? `▼ Show ${replies.length} replies` : `▲ Hide replies`}
              </button>
            )}

            {/* Reactions */}
            <div className="flex items-center gap-1">
              {['👍', '✅', '🎉', '🚀'].map(emoji => (
                <button
                  key={emoji}
                  onClick={() => onReaction(emoji)}
                  className="text-xs hover:bg-gray-700 rounded px-1"
                >
                  {emoji} {message.reactions?.[emoji] || ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Nested Replies */}
      {hasReplies && !isCollapsed && (
        <div className="mt-3 space-y-3 pl-4">
          {replies.map(reply => (
            <ThreadMessageCard
              key={reply.id}
              message={reply}
              agents={agents}
              replies={[]}
              threadCollapsed={threadCollapsed}
              onToggle={() => {}}
              onReply={onReply}
              onReaction={onReaction}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}