// =====================================================
// OpenClaw-specific Type Definitions
// Phase 3: Full OpenClaw Integration
// =====================================================

import type { AgentDivision, AgentSource } from './index';

// =====================================================
// Connection & Authentication
// =====================================================

export interface OpenClawAuthPayload {
  deviceId: string;
  publicKey: string;
  timestamp: number;
  signature: string;
}

export interface OpenClawAuthResponse {
  success: boolean;
  error?: string;
  sessionId?: string;
  expiresAt?: number;
}

export type OpenClawConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'error';

export interface OpenClawConnectionInfo {
  status: OpenClawConnectionStatus;
  host: string;
  port: number;
  secure: boolean;
  deviceId: string;
  latency: number;
  queueSize: number;
  lastConnected?: Date;
  reconnectAttempts: number;
}

// =====================================================
// Messages
// =====================================================

export type OpenClawMessageType =
  | 'auth'
  | 'auth_response'
  | 'ping'
  | 'pong'
  | 'channel_message'
  | 'agent_response'
  | 'agent_sync'
  | 'agent_sync_response'
  | 'channel_subscribe'
  | 'channel_unsubscribe'
  | 'error'
  | 'system';

export interface OpenClawMessage<T = unknown> {
  id: string;
  type: OpenClawMessageType;
  payload: T;
  timestamp?: number;
  signature?: string;
}

// Channel message payload
export interface ChannelMessagePayload {
  channelId: string;
  senderId: string;
  senderName?: string;
  content: string;
  format?: 'text' | 'markdown' | 'html';
  attachments?: OpenClawAttachment[];
  replyTo?: string;
  threadId?: string;
  metadata?: Record<string, unknown>;
}

// Agent response payload
export interface AgentResponsePayload {
  channelId: string;
  agentId: string;
  content: string;
  format?: 'text' | 'markdown' | 'html';
  attachments?: OpenClawAttachment[];
  replyTo?: string;
  threadId?: string;
  metadata?: Record<string, unknown>;
}

// Attachment
export interface OpenClawAttachment {
  type: 'image' | 'file' | 'link' | 'code';
  url?: string;
  content?: string;
  filename?: string;
  mimeType?: string;
  language?: string;
}

// =====================================================
// Channels
// =====================================================

export type ChannelPlatform =
  | 'slack'
  | 'discord'
  | 'whatsapp'
  | 'telegram'
  | 'teams'
  | 'email'
  | 'sms'
  | 'webchat'
  | 'api'
  | 'matrix'
  | 'irc';

export interface OpenClawChannelConfig {
  id: string;
  name: string;
  platform: ChannelPlatform;
  enabled: boolean;
  credentials?: ChannelCredentials;
  settings?: ChannelSettings;
}

export interface ChannelCredentials {
  apiKey?: string;
  apiSecret?: string;
  accessToken?: string;
  webhookUrl?: string;
  botToken?: string;
}

export interface ChannelSettings {
  // Slack
  slackWorkspace?: string;
  slackChannel?: string;
  slackBotUserId?: string;
  // Discord
  discordGuildId?: string;
  discordChannelId?: string;
  // Telegram
  telegramBotUsername?: string;
  telegramChatId?: string;
  // WhatsApp
  whatsappBusinessId?: string;
  whatsappPhoneNumber?: string;
  // Teams
  teamsTenantId?: string;
  teamsTeamId?: string;
  teamsChannelId?: string;
  // Email
  emailAddress?: string;
  smtpHost?: string;
  imapHost?: string;
  // Generic
  customEndpoint?: string;
  metadata?: Record<string, unknown>;
}

// =====================================================
// Agent Sync
// =====================================================

export interface OpenClawAgentDefinition {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  systemPrompt: string;
  channels: string[];
  status: 'online' | 'offline' | 'busy';
  metadata: {
    division: AgentDivision;
    source: AgentSource;
    technicalSkills: string[];
    personalityTraits: string[];
    emoji?: string;
    color?: string;
  };
}

export interface AgentSyncRequest {
  action: 'sync' | 'list' | 'delete' | 'update_channels' | 'update_status';
  agentId?: string;
  agent?: Partial<OpenClawAgentDefinition>;
  channels?: string[];
  status?: 'online' | 'offline' | 'busy';
}

export interface AgentSyncResponse {
  success: boolean;
  action: string;
  agentId?: string;
  agents?: OpenClawAgentDefinition[];
  error?: string;
}

// =====================================================
// Message Routing
// =====================================================

export interface IncomingChannelMessage {
  id: string;
  channelId: string;
  platform: ChannelPlatform;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  content: string;
  timestamp: Date;
  attachments: OpenClawAttachment[];
  mentions: string[];
  replyTo?: string;
  threadId?: string;
  metadata: Record<string, unknown>;
}

export interface OutgoingAgentMessage {
  channelId: string;
  agentId: string;
  content: string;
  format: 'text' | 'markdown' | 'html';
  attachments?: OpenClawAttachment[];
  replyTo?: string;
  threadId?: string;
  ephemeral?: boolean;
  metadata?: Record<string, unknown>;
}

export interface MessageRoutingDecision {
  shouldProcess: boolean;
  targetAgents: string[];
  reason: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  confidence: number;
}

export interface MessageFilter {
  mentionRequired?: boolean;
  keywordTriggers?: string[];
  excludePatterns?: string[];
  minMessageLength?: number;
  maxMessageLength?: number;
  allowedSenders?: string[];
  blockedSenders?: string[];
  channelTypes?: ChannelPlatform[];
}

export interface AgentChannelMapping {
  agentSlug: string;
  role: 'responder' | 'listener' | 'broadcaster' | 'moderator';
  priority: number;
  filter?: MessageFilter;
  responseDelay?: number; // ms
  rateLimitPerMinute?: number;
}

// =====================================================
// Events & Webhooks
// =====================================================

export type OpenClawEventType =
  | 'connection.established'
  | 'connection.lost'
  | 'connection.error'
  | 'message.received'
  | 'message.sent'
  | 'message.failed'
  | 'agent.synced'
  | 'agent.removed'
  | 'channel.subscribed'
  | 'channel.unsubscribed'
  | 'rate_limit.exceeded';

export interface OpenClawEvent {
  type: OpenClawEventType;
  timestamp: Date;
  data: unknown;
  source: string;
}

export interface OpenClawWebhookConfig {
  url: string;
  events: OpenClawEventType[];
  secret?: string;
  headers?: Record<string, string>;
  retryPolicy?: {
    maxRetries: number;
    retryDelay: number;
  };
}

// =====================================================
// Statistics & Monitoring
// =====================================================

export interface OpenClawStats {
  connection: {
    uptime: number;
    reconnects: number;
    latency: number;
  };
  messages: {
    received: number;
    sent: number;
    failed: number;
    queued: number;
  };
  agents: {
    synced: number;
    active: number;
  };
  channels: {
    subscribed: number;
    total: number;
  };
}

// =====================================================
// API Responses
// =====================================================

export interface OpenClawApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    requestId: string;
    timestamp: number;
  };
}

export interface ConnectResponse {
  connected: boolean;
  deviceId: string;
  sessionId?: string;
}

export interface SyncResponse {
  synced: number;
  failed: number;
  skipped: number;
  agents: string[];
}

export interface StatusResponse {
  status: OpenClawConnectionStatus;
  stats: OpenClawStats;
  config: {
    host: string;
    port: number;
    secure: boolean;
  };
}
