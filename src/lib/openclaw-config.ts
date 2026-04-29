// =====================================================
// OpenClaw Configuration - Gateway & Channel Settings
// Phase 3: Full OpenClaw Integration
// =====================================================

import fs from 'fs';
import path from 'path';
import { createChildLogger } from './logger';

const logger = createChildLogger('openclaw-config');

// OpenClaw Protocol Version (2026.x)
export const OPENCLAW_PROTOCOL_VERSION = 3;

// Connection settings
export interface OpenClawConnectionConfig {
  host: string;
  port: number;
  secure: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  pingInterval: number;
  messageTimeout: number;
  maxQueueSize: number;
}

// Channel definition
export interface OpenClawChannel {
  id: string;
  name: string;
  platform: ChannelPlatform;
  enabled: boolean;
  config: ChannelConfig;
  agentMappings: AgentChannelMapping[];
}

// Supported platforms
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

// Platform-specific configuration
export interface ChannelConfig {
  // Slack
  slackWorkspace?: string;
  slackChannel?: string;
  // Discord
  discordGuild?: string;
  discordChannel?: string;
  // Telegram
  telegramChatId?: string;
  telegramBotToken?: string;
  telegramGroups?: Record<string, GroupPolicy>;
  // WhatsApp
  whatsappNumber?: string;
  // Email
  emailAddress?: string;
  // Generic
  webhookUrl?: string;
  apiKey?: string;
  metadata?: Record<string, unknown>;
}

export interface GroupPolicy {
  groupPolicy?: 'open' | 'restricted' | 'admin_only';
  [key: string]: unknown;
}

// Agent-to-channel mapping
export interface AgentChannelMapping {
  agentSlug: string;
  role: 'responder' | 'listener' | 'broadcaster';
  filter?: MessageFilter;
}

// Message filtering rules
export interface MessageFilter {
  mentionRequired?: boolean;
  keywordTriggers?: string[];
  excludePatterns?: string[];
  minMessageLength?: number;
}

// Full OpenClaw configuration
export interface OpenClawConfig {
  connection: OpenClawConnectionConfig;
  channels: OpenClawChannel[];
  defaultAgent?: string;
  autoConnect: boolean;
  debugMode: boolean;
}

// Default configuration
const DEFAULT_CONFIG: OpenClawConfig = {
  connection: {
    host: process.env.OPENCLAW_GATEWAY_HOST || '127.0.0.1',
    port: parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789'),
    secure: process.env.OPENCLAW_GATEWAY_SECURE === 'true',
    reconnectInterval: 5000,
    maxReconnectAttempts: 10,
    pingInterval: 30000,
    messageTimeout: 30000,
    maxQueueSize: 1000,
  },
  channels: [],
  defaultAgent: 'task-planner',
  autoConnect: false,
  debugMode: process.env.NODE_ENV !== 'production',
};

// Configuration state
let cachedConfig: OpenClawConfig | null = null;

/**
 * Get OpenClaw configuration
 */
export function getOpenClawConfig(): OpenClawConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const configPath = process.env.OPENCLAW_CONFIG_PATH ||
    path.join(process.cwd(), '.data', 'openclaw-config.json');

  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as Partial<OpenClawConfig>;
      cachedConfig = {
        connection: { ...DEFAULT_CONFIG.connection, ...fileConfig.connection },
        channels: fileConfig.channels || DEFAULT_CONFIG.channels,
        defaultAgent: fileConfig.defaultAgent ?? DEFAULT_CONFIG.defaultAgent,
        autoConnect: fileConfig.autoConnect ?? DEFAULT_CONFIG.autoConnect,
        debugMode: fileConfig.debugMode ?? DEFAULT_CONFIG.debugMode,
      };
      logger.info({ path: configPath }, 'Loaded OpenClaw config from file');
    } catch (error) {
      logger.error({ error, path: configPath }, 'Failed to load config file');
      cachedConfig = { ...DEFAULT_CONFIG };
    }
  } else {
    cachedConfig = { ...DEFAULT_CONFIG };
    logger.info('Using default OpenClaw config');
  }

  return cachedConfig!;
}

/**
 * Save OpenClaw configuration
 */
export function saveOpenClawConfig(config: OpenClawConfig): void {
  const configPath = path.join(process.cwd(), '.data', 'openclaw-config.json');
  const dir = path.dirname(configPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  cachedConfig = config;
  logger.info({ path: configPath }, 'Saved OpenClaw config');
}

/**
 * Update connection settings
 */
export function updateConnectionConfig(
  updates: Partial<OpenClawConnectionConfig>
): OpenClawConfig {
  const config = getOpenClawConfig();
  config.connection = { ...config.connection, ...updates };
  saveOpenClawConfig(config);
  return config;
}

/**
 * Add or update a channel
 */
export function upsertChannel(channel: OpenClawChannel): OpenClawConfig {
  const config = getOpenClawConfig();
  const existingIndex = config.channels.findIndex(c => c.id === channel.id);

  if (existingIndex >= 0) {
    config.channels[existingIndex] = channel;
  } else {
    config.channels.push(channel);
  }

  saveOpenClawConfig(config);
  return config;
}

/**
 * Remove a channel
 */
export function removeChannel(channelId: string): OpenClawConfig {
  const config = getOpenClawConfig();
  config.channels = config.channels.filter(c => c.id !== channelId);
  saveOpenClawConfig(config);
  return config;
}

/**
 * Get channels for an agent
 */
export function getChannelsForAgent(agentSlug: string): OpenClawChannel[] {
  const config = getOpenClawConfig();
  return config.channels.filter(channel =>
    channel.enabled &&
    channel.agentMappings.some(m => m.agentSlug === agentSlug)
  );
}

/**
 * Get agents mapped to a channel
 */
export function getAgentsForChannel(channelId: string): AgentChannelMapping[] {
  const config = getOpenClawConfig();
  const channel = config.channels.find(c => c.id === channelId);
  return channel?.agentMappings || [];
}

/**
 * Map an agent to a channel
 */
export function mapAgentToChannel(
  channelId: string,
  mapping: AgentChannelMapping
): OpenClawConfig {
  const config = getOpenClawConfig();
  const channel = config.channels.find(c => c.id === channelId);

  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  const existingIndex = channel.agentMappings.findIndex(
    m => m.agentSlug === mapping.agentSlug
  );

  if (existingIndex >= 0) {
    channel.agentMappings[existingIndex] = mapping;
  } else {
    channel.agentMappings.push(mapping);
  }

  saveOpenClawConfig(config);
  return config;
}

/**
 * Remove agent from channel
 */
export function unmapAgentFromChannel(
  channelId: string,
  agentSlug: string
): OpenClawConfig {
  const config = getOpenClawConfig();
  const channel = config.channels.find(c => c.id === channelId);

  if (channel) {
    channel.agentMappings = channel.agentMappings.filter(
      m => m.agentSlug !== agentSlug
    );
    saveOpenClawConfig(config);
  }

  return config;
}

/**
 * Get WebSocket URL for connection
 */
export function getWebSocketUrl(config?: OpenClawConnectionConfig): string {
  const conn = config || getOpenClawConfig().connection;
  const protocol = conn.secure ? 'wss' : 'ws';
  return `${protocol}://${conn.host}:${conn.port}/v${OPENCLAW_PROTOCOL_VERSION}/control`;
}

/**
 * Clear configuration cache (for testing)
 */
export function clearConfigCache(): void {
  cachedConfig = null;
}

/**
 * Set a specific channel config property
 */
export function setChannelConfig(
  channelId: string,
  key: string,
  value: unknown
): OpenClawConfig {
  const config = getOpenClawConfig();
  const channel = config.channels.find(c => c.id === channelId);

  if (!channel) {
    throw new Error(`Channel not found: ${channelId}`);
  }

  const keys = key.split('.');
  let target: Record<string, unknown> = channel.config as Record<string, unknown>;
  
  for (let i = 0; i < keys.length - 1; i++) {
    if (!target[keys[i]]) {
      target[keys[i]] = {};
    }
    target = target[keys[i]] as Record<string, unknown>;
  }
  
  target[keys[keys.length - 1]] = value;
  saveOpenClawConfig(config);
  return config;
}
// Export for external use
export default {
  getOpenClawConfig,
  saveOpenClawConfig,
  updateConnectionConfig,
  upsertChannel,
  removeChannel,
  getChannelsForAgent,
  getAgentsForChannel,
  mapAgentToChannel,
  unmapAgentFromChannel,
  getWebSocketUrl,
  clearConfigCache,
  setChannelConfig,
};
