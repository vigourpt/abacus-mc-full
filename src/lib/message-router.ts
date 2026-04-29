// =====================================================
// Message Router - Route messages between OpenClaw & Agents
// Phase 3: Full OpenClaw Integration
// =====================================================

import { EventEmitter } from 'events';
import db from './db';
import { createChildLogger } from './logger';
import { generateId } from './utils';
import { getOpenClawClient, type OpenClawMessage } from './openclaw-client';
import {
  getOpenClawConfig,
  getAgentsForChannel,
  type OpenClawChannel,
  type MessageFilter,
  type AgentChannelMapping,
} from './openclaw-config';
import type { Agent, AgentMessage, Task } from '@/types';

const logger = createChildLogger('message-router');

// Incoming message from a channel
export interface IncomingMessage {
  id: string;
  channelId: string;
  platform: string;
  senderId: string;
  senderName?: string;
  content: string;
  timestamp: Date;
  metadata: Record<string, unknown>;
  replyTo?: string;
  threadId?: string;
}

// Outgoing message to a channel
export interface OutgoingMessage {
  channelId: string;
  content: string;
  agentId: string;
  replyTo?: string;
  threadId?: string;
  metadata?: Record<string, unknown>;
  format?: 'text' | 'markdown' | 'html';
}

// Message routing decision
export interface RoutingDecision {
  shouldProcess: boolean;
  targetAgents: string[];
  reason: string;
  priority: 'high' | 'medium' | 'low';
}

// Router events
export interface MessageRouterEvents {
  messageReceived: (message: IncomingMessage) => void;
  messageRouted: (message: IncomingMessage, agents: string[]) => void;
  agentResponse: (agentId: string, message: OutgoingMessage) => void;
  error: (error: Error) => void;
}

/**
 * Message Router - Routes messages between OpenClaw channels and agents
 * 
 * Responsibilities:
 * - Receive messages from OpenClaw channels
 * - Determine which agents should handle each message
 * - Route agent responses back to appropriate channels
 * - Handle message formatting and transformation
 * - Manage multi-channel message distribution
 */
export class MessageRouter extends EventEmitter {
  private isRunning = false;
  private messageHandlers: Map<string, (message: IncomingMessage) => Promise<string | null>> = new Map();

  constructor() {
    super();
    logger.info('Message router initialized');
  }

  /**
   * Start the message router
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Message router already running');
      return;
    }

    const client = getOpenClawClient();
    
    // Subscribe to channel messages
    client.on('channelMessage', this.handleChannelMessage.bind(this));
    client.on('message', this.handleGenericMessage.bind(this));

    this.isRunning = true;
    logger.info('Message router started');
  }

  /**
   * Stop the message router
   */
  stop(): void {
    if (!this.isRunning) return;

    const client = getOpenClawClient();
    client.off('channelMessage', this.handleChannelMessage.bind(this));
    client.off('message', this.handleGenericMessage.bind(this));

    this.isRunning = false;
    logger.info('Message router stopped');
  }

  /**
   * Register a message handler for an agent
   */
  registerAgentHandler(
    agentSlug: string,
    handler: (message: IncomingMessage) => Promise<string | null>
  ): void {
    this.messageHandlers.set(agentSlug, handler);
    logger.info({ agentSlug }, 'Agent handler registered');
  }

  /**
   * Unregister an agent handler
   */
  unregisterAgentHandler(agentSlug: string): void {
    this.messageHandlers.delete(agentSlug);
    logger.info({ agentSlug }, 'Agent handler unregistered');
  }

  /**
   * Manually route a message to agents
   */
  async routeMessage(message: IncomingMessage): Promise<void> {
    await this.processIncomingMessage(message);
  }

  /**
   * Send a response from an agent to a channel
   */
  async sendAgentResponse(response: OutgoingMessage): Promise<void> {
    const client = getOpenClawClient();

    if (client.getState() !== 'connected') {
      logger.warn('Cannot send response: not connected to OpenClaw');
      return;
    }

    try {
      // Format the message based on channel requirements
      const formattedContent = await this.formatOutgoingMessage(response);

      // Use WebSocket API with chat.send method
      await client.sendToChannel(response.channelId, formattedContent, {
        agentId: response.agentId,
        replyTo: response.replyTo,
        threadId: response.threadId,
        ...response.metadata,
      });

      // Log the message
      this.logMessage({
        id: generateId(),
        fromAgentId: response.agentId,
        toAgentId: 'channel:' + response.channelId,
        content: formattedContent,
        type: 'response',
        read: true,
        createdAt: new Date(),
      });

      this.emit('agentResponse', response.agentId, response);
      logger.info({ channelId: response.channelId, agentId: response.agentId }, 'Agent response sent');

    } catch (error) {
      logger.error({ error, response }, 'Failed to send agent response');
      this.emit('error', error as Error);
    }
  }

  /**
   * Broadcast a message to multiple channels
   */
  async broadcast(
    agentId: string,
    content: string,
    channelIds?: string[]
  ): Promise<number> {
    const config = getOpenClawConfig();
    const targetChannels = channelIds
      ? config.channels.filter(c => channelIds.includes(c.id) && c.enabled)
      : config.channels.filter(c => c.enabled);

    let sent = 0;
    for (const channel of targetChannels) {
      try {
        await this.sendAgentResponse({
          channelId: channel.id,
          content,
          agentId,
          format: 'markdown',
        });
        sent++;
      } catch (error) {
        logger.error({ error, channelId: channel.id }, 'Failed to broadcast to channel');
      }
    }

    logger.info({ sent, total: targetChannels.length }, 'Broadcast completed');
    return sent;
  }

  /**
   * Send message via OpenClaw CLI fallback
   * This is used when the WebSocket API fails
   */
  private async sendViaCli(channelId: string, content: string): Promise<void> {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    // Map channel names to target IDs
    const channelTargets: Record<string, string> = {
      telegram: process.env.TELEGRAM_TARGET_ID || '6986929051', // Default to Dan's ID
    };

    const target = channelTargets[channelId] || channelId;

    // Escape the message content for shell
    const escapedContent = content.replace(/"/g, '\\"').replace(/\n/g, '\\n');

    // Use docker exec to run openclaw CLI from the openclaw container
    const command = `docker exec openclaw-whdd-openclaw-1 openclaw message send --channel ${channelId} --target ${target} --message "${escapedContent}"`;

    logger.info({ channelId, target, command: command.substring(0, 100) }, 'Sending via CLI fallback');

    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 10000 });

      if (stderr && !stderr.includes('warning')) {
        logger.warn({ stderr }, 'CLI stderr');
      }

      logger.info({ stdout }, 'CLI send completed');
    } catch (error: any) {
      logger.error({ error: error.message }, 'CLI fallback failed');
      throw error;
    }
  }

  // =====================================================
  // Private Methods
  // =====================================================

  private handleChannelMessage(channelId: string, payload: unknown): void {
    const messagePayload = payload as {
      id: string;
      senderId: string;
      senderName?: string;
      content: string;
      timestamp?: number;
      metadata?: Record<string, unknown>;
      replyTo?: string;
      threadId?: string;
    };

    const config = getOpenClawConfig();
    const channel = config.channels.find(c => c.id === channelId);

    if (!channel) {
      logger.warn({ channelId }, 'Received message for unknown channel');
      return;
    }

    const message: IncomingMessage = {
      id: messagePayload.id || generateId(),
      channelId,
      platform: channel.platform,
      senderId: messagePayload.senderId,
      senderName: messagePayload.senderName,
      content: messagePayload.content,
      timestamp: new Date(messagePayload.timestamp || Date.now()),
      metadata: messagePayload.metadata || {},
      replyTo: messagePayload.replyTo,
      threadId: messagePayload.threadId,
    };

    this.emit('messageReceived', message);
    this.processIncomingMessage(message).catch(error => {
      logger.error({ error, messageId: message.id }, 'Failed to process message');
    });
  }

  private handleGenericMessage(message: OpenClawMessage): void {
    // Handle other message types if needed
    if (message.type === 'system') {
      logger.info({ payload: message.payload }, 'System message received');
    }
  }

  private async processIncomingMessage(message: IncomingMessage): Promise<void> {
    // Make routing decision
    const decision = this.makeRoutingDecision(message);

    if (!decision.shouldProcess) {
      logger.debug({ messageId: message.id, reason: decision.reason }, 'Message not routed');
      return;
    }

    // Log the incoming message
    this.logMessage({
      id: generateId(),
      fromAgentId: `external:${message.senderId}`,
      toAgentId: decision.targetAgents.join(','),
      content: message.content,
      type: 'request',
      read: false,
      createdAt: message.timestamp,
    });

    this.emit('messageRouted', message, decision.targetAgents);

    // Route to target agents
    for (const agentSlug of decision.targetAgents) {
      await this.deliverToAgent(agentSlug, message);
    }
  }

  private makeRoutingDecision(message: IncomingMessage): RoutingDecision {
    const config = getOpenClawConfig();
    const channel = config.channels.find(c => c.id === message.channelId);

    if (!channel || !channel.enabled) {
      return {
        shouldProcess: false,
        targetAgents: [],
        reason: 'Channel disabled or not found',
        priority: 'low',
      };
    }

    const eligibleAgents: string[] = [];

    for (const mapping of channel.agentMappings) {
      if (this.passesFilter(message, mapping.filter)) {
        eligibleAgents.push(mapping.agentSlug);
      }
    }

    if (eligibleAgents.length === 0) {
      // Use default agent if configured
      const defaultAgent = config.defaultAgent;
      if (defaultAgent) {
        return {
          shouldProcess: true,
          targetAgents: [defaultAgent],
          reason: 'Routed to default agent',
          priority: 'medium',
        };
      }

      return {
        shouldProcess: false,
        targetAgents: [],
        reason: 'No agents matched filters',
        priority: 'low',
      };
    }

    // Determine priority based on message content
    const priority = this.determinePriority(message);

    return {
      shouldProcess: true,
      targetAgents: eligibleAgents,
      reason: `Matched ${eligibleAgents.length} agent(s)`,
      priority,
    };
  }

  private passesFilter(message: IncomingMessage, filter?: MessageFilter): boolean {
    if (!filter) return true;

    // Check minimum length
    if (filter.minMessageLength && message.content.length < filter.minMessageLength) {
      return false;
    }

    // Check mention requirement
    if (filter.mentionRequired) {
      const hasMention = message.content.includes('@') ||
        message.metadata.mentions !== undefined;
      if (!hasMention) return false;
    }

    // Check keyword triggers
    if (filter.keywordTriggers && filter.keywordTriggers.length > 0) {
      const contentLower = message.content.toLowerCase();
      const hasKeyword = filter.keywordTriggers.some(kw =>
        contentLower.includes(kw.toLowerCase())
      );
      if (!hasKeyword) return false;
    }

    // Check exclude patterns
    if (filter.excludePatterns && filter.excludePatterns.length > 0) {
      const contentLower = message.content.toLowerCase();
      const hasExcluded = filter.excludePatterns.some(pattern =>
        contentLower.includes(pattern.toLowerCase())
      );
      if (hasExcluded) return false;
    }

    return true;
  }

  private determinePriority(message: IncomingMessage): 'high' | 'medium' | 'low' {
    const content = message.content.toLowerCase();

    // High priority indicators
    const highPriorityKeywords = [
      'urgent', 'emergency', 'critical', 'asap', 'immediately',
      'production', 'down', 'broken', 'error', 'bug',
    ];

    if (highPriorityKeywords.some(kw => content.includes(kw))) {
      return 'high';
    }

    // Low priority indicators
    const lowPriorityKeywords = [
      'fyi', 'when you have time', 'no rush', 'eventually',
      'nice to have', 'optional',
    ];

    if (lowPriorityKeywords.some(kw => content.includes(kw))) {
      return 'low';
    }

    return 'medium';
  }

  private async deliverToAgent(
    agentSlug: string,
    message: IncomingMessage
  ): Promise<void> {
    // Check if we have a handler for this agent
    const handler = this.messageHandlers.get(agentSlug);

    if (handler) {
      try {
        const response = await handler(message);
        
        if (response) {
          await this.sendAgentResponse({
            channelId: message.channelId,
            content: response,
            agentId: agentSlug,
            replyTo: message.id,
            threadId: message.threadId,
          });
        }
      } catch (error) {
        logger.error({ error, agentSlug, messageId: message.id }, 'Agent handler error');
      }
      return;
    }

    // No handler - create a task for the agent
    await this.createTaskFromMessage(agentSlug, message);
  }

  private async createTaskFromMessage(
    agentSlug: string,
    message: IncomingMessage
  ): Promise<void> {
    // Get agent ID from slug
    const agent = db
      .prepare('SELECT id FROM agents WHERE slug = ?')
      .get(agentSlug) as { id: string } | undefined;

    if (!agent) {
      logger.warn({ agentSlug }, 'Agent not found for task creation');
      return;
    }

    const taskId = generateId();
    const priority = this.determinePriority(message);

    const stmt = db.prepare(`
      INSERT INTO tasks (
        id, title, description, status, priority, assigned_to,
        context, tags, created_at, updated_at
      ) VALUES (?, ?, ?, 'todo', ?, ?, ?, ?, datetime('now'), datetime('now'))
    `);

    stmt.run(
      taskId,
      `Channel Message: ${message.content.substring(0, 50)}...`,
      message.content,
      priority,
      agent.id,
      JSON.stringify({
        channelId: message.channelId,
        platform: message.platform,
        senderId: message.senderId,
        senderName: message.senderName,
        messageId: message.id,
        threadId: message.threadId,
      }),
      JSON.stringify(['channel-message', message.platform])
    );

    logger.info(
      { taskId, agentSlug, channelId: message.channelId },
      'Created task from channel message'
    );
  }

  private async formatOutgoingMessage(response: OutgoingMessage): Promise<string> {
    const config = getOpenClawConfig();
    const channel = config.channels.find(c => c.id === response.channelId);

    if (!channel) {
      return response.content;
    }

    // Platform-specific formatting
    switch (channel.platform) {
      case 'slack':
        return this.formatForSlack(response.content, response.format);
      case 'discord':
        return this.formatForDiscord(response.content, response.format);
      case 'telegram':
        return this.formatForTelegram(response.content, response.format);
      case 'email':
        return this.formatForEmail(response.content, response.format);
      default:
        return response.content;
    }
  }

  private formatForSlack(content: string, format?: string): string {
    if (format === 'markdown') {
      // Convert markdown to Slack mrkdwn
      return content
        .replace(/\*\*(.+?)\*\*/g, '*$1*')  // Bold
        .replace(/\*(.+?)\*/g, '_$1_')      // Italic
        .replace(/```(\w+)?\n/g, '```')     // Code blocks
        .replace(/^#{1,6}\s/gm, '*');       // Headers to bold
    }
    return content;
  }

  private formatForDiscord(content: string, format?: string): string {
    // Discord supports markdown natively
    return content;
  }

  private formatForTelegram(content: string, format?: string): string {
    if (format === 'markdown') {
      // Telegram uses its own markdown variant
      return content
        .replace(/\*\*(.+?)\*\*/g, '*$1*')  // Bold
        .replace(/_(.+?)_/g, '_$1_');       // Italic
    }
    return content;
  }

  private formatForEmail(content: string, format?: string): string {
    if (format === 'markdown' || format === 'html') {
      // Convert to basic HTML for email
      return content
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>')
        .replace(/```(\w+)?\n([\s\S]+?)```/g, '<pre><code>$2</code></pre>');
    }
    return content;
  }

  private logMessage(message: Omit<AgentMessage, 'metadata'>): void {
    try {
      const stmt = db.prepare(`
        INSERT INTO agent_messages (
          id, from_agent_id, to_agent_id, content, type, task_id, read, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        message.id,
        message.fromAgentId,
        message.toAgentId,
        message.content,
        message.type,
        message.taskId || null,
        message.read ? 1 : 0,
        message.createdAt.toISOString()
      );
    } catch (error) {
      logger.error({ error }, 'Failed to log message');
    }
  }
}

// Singleton instance
let routerInstance: MessageRouter | null = null;

/**
 * Get or create message router instance
 */
export function getMessageRouter(): MessageRouter {
  if (!routerInstance) {
    routerInstance = new MessageRouter();
  }
  return routerInstance;
}

/**
 * Reset router instance (for testing)
 */
export function resetMessageRouter(): void {
  if (routerInstance) {
    routerInstance.stop();
    routerInstance = null;
  }
}

export default MessageRouter;
