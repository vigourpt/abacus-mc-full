// =====================================================
// OpenClaw WebSocket Client - Enhanced Connection Manager
// Phase 3: Full OpenClaw Integration
//
// Implements the OpenClaw Protocol v3 challenge-response
// handshake (connect.challenge → connect → hello-ok).
// =====================================================

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { createChildLogger } from './logger';
import { getOrCreateDeviceIdentity, signChallenge, signMessage } from './device-identity';
import {
  getOpenClawConfig,
  getWebSocketUrl,
  OPENCLAW_PROTOCOL_VERSION,
  type OpenClawConnectionConfig,
} from './openclaw-config';
import type { DeviceIdentity, GatewayConnection } from '@/types';

const logger = createChildLogger('openclaw-client');

// Client identification sent during the connect handshake.
// OpenClaw validates client.id against a whitelist of known constants.
// "openclaw-control-ui" is the standard control-plane client identifier.
// Override via OPENCLAW_CLIENT_ID env var if your gateway uses a different value.
const CLIENT_ID = process.env.OPENCLAW_CLIENT_ID || 'cli';
const CLIENT_VERSION = '1.0.0';
const CLIENT_ROLE = 'operator';
const CLIENT_MODE = process.env.OPENCLAW_CLIENT_MODE || 'cli';
const CLIENT_SCOPES = ['operator.admin', 'operator.read', 'operator.write', 'operator.approvals', 'operator.pairing'];

/** Timeout (ms) to wait for the full protocol handshake to complete. */
const HANDSHAKE_TIMEOUT_MS = 15_000;

// Message types from/to OpenClaw
export interface OpenClawMessage {
  id: string;
  type: OpenClawMessageType;
  // Legacy field - prefer params for v3
  payload?: unknown;
  timestamp?: number;
  signature?: string;
  // v3 frame fields
  method?: string;
  event?: string;
  ok?: boolean;
  params?: unknown;
}

export type OpenClawMessageType =
  | 'req'
  | 'res'
  | 'event'
  // Legacy types kept for internal routing
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

// Queued message for offline handling
interface QueuedMessage {
  message: OpenClawMessage;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timestamp: number;
  retries: number;
}

// Event types
export interface OpenClawClientEvents {
  connected: () => void;
  disconnected: (reason: string) => void;
  authenticated: () => void;
  authError: (error: Error) => void;
  message: (message: OpenClawMessage) => void;
  channelMessage: (channelId: string, message: unknown) => void;
  error: (error: Error) => void;
  reconnecting: (attempt: number) => void;
  queueFull: () => void;
}

// Connection states
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'error';

/**
 * Enhanced OpenClaw WebSocket Client
 * Features:
 * - OpenClaw Protocol v3 challenge-response handshake
 * - Connection lifecycle management
 * - Automatic reconnection with exponential backoff
 * - Message queue for offline scenarios
 * - Ed25519 device authentication
 * - Heartbeat/ping-pong
 * - Event-based architecture
 */
export class OpenClawClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: OpenClawConnectionConfig;
  private identity: DeviceIdentity;
  private state: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingTimer: NodeJS.Timeout | null = null;
  private pongTimer: NodeJS.Timeout | null = null;
  private messageQueue: QueuedMessage[] = [];
  private pendingResponses: Map<string, QueuedMessage> = new Map();
  private lastPingTime = 0;
  private latency = 0;
  private messageCounter = 0;

  constructor(config?: Partial<OpenClawConnectionConfig>) {
    super();
    const fullConfig = getOpenClawConfig();
    this.config = { ...fullConfig.connection, ...config };
    this.identity = getOrCreateDeviceIdentity();
    logger.info({ deviceId: this.identity.deviceId }, 'OpenClaw client initialized');
  }

  // =====================================================
  // Public Getters
  // =====================================================

  getState(): ConnectionState {
    return this.state;
  }

  getConnectionInfo(): GatewayConnection {
    return {
      id: this.identity.deviceId,
      host: this.config.host,
      port: this.config.port,
      status:
        this.state === 'connected'
          ? 'connected'
          : this.state === 'connecting' || this.state === 'authenticating'
            ? 'connecting'
            : this.state === 'error'
              ? 'error'
              : 'disconnected',
      deviceIdentity: this.identity,
    };
  }

  getLatency(): number {
    return this.latency;
  }

  getQueueSize(): number {
    return this.messageQueue.length;
  }

  // =====================================================
  // Connect – OpenClaw Protocol v3 Handshake
  // =====================================================

  /**
   * Connect to OpenClaw gateway.
   *
   * Protocol v3 flow:
   *  1. Open a WebSocket to the gateway endpoint.
   *  2. Gateway sends  { type:"event", event:"connect.challenge", payload:{ nonce, ts } }
   *  3. Client replies { type:"req", id, method:"connect", params:{ …device, auth… } }
   *  4. Gateway sends  { type:"res", id, ok:true, payload:{ type:"hello-ok", … } }
   */
  async connect(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      logger.info('Already connected or connecting');
      return;
    }

    this.state = 'connecting';
    const url = getWebSocketUrl(this.config);
    console.log('[DEBUG] About to connect WebSocket to:', url);

    return new Promise((resolve, reject) => {
      try {
        // Build minimal HTTP headers for the upgrade request.
        // Authentication happens inside WebSocket frames, not HTTP headers.
        const originUrl =
          process.env.NEXT_PUBLIC_OPENCLAW_ORIGIN_URL ||
          process.env.NEXT_PUBLIC_APP_URL ||
          '';
        const headers: Record<string, string> = {
          'User-Agent': `${CLIENT_ID}/${CLIENT_VERSION}`,
        };
        if (originUrl) {
          headers['Origin'] = originUrl;
          const urlObj = new URL(originUrl);
          headers['Host'] = urlObj.host;
        }

        this.ws = new WebSocket(url, { headers });
        console.log('[DEBUG] WebSocket created for URL:', url);

        const handshakeTimeout = setTimeout(() => {
          if (this.state === 'connecting' || this.state === 'authenticating') {
            this.handleError(new Error('OpenClaw handshake timeout'));
            reject(new Error('OpenClaw handshake timeout'));
          }
        }, HANDSHAKE_TIMEOUT_MS);

        this.ws.on('open', () => {
          logger.info({ url }, 'WebSocket open, waiting for connect.challenge…');
          this.state = 'authenticating';
        });

        this.ws.on('message', (data) => {
          const raw = data.toString();
          console.log('[DEBUG] Received frame:', raw.substring(0, 200));

          // During handshake, intercept protocol frames
          if (this.state === 'authenticating' || this.state === 'connecting') {
            this.handleHandshakeFrame(raw, handshakeTimeout, resolve, reject);
            return;
          }

          // Post-handshake: normal message handling
          this.handleMessage(raw);
        });

        this.ws.on('close', (code, reason) => {
          clearTimeout(handshakeTimeout);
          this.handleDisconnect(code, reason.toString());
        });

        this.ws.on('error', (error) => {
          clearTimeout(handshakeTimeout);
          if (this.state === 'connecting' || this.state === 'authenticating') {
            reject(error);
          }
          this.handleError(error as Error);
        });
      } catch (error) {
        this.handleError(error as Error);
        reject(error);
      }
    });
  }

  /**
   * Handle a single frame during the challenge-response handshake.
   */
  private handleHandshakeFrame(
    raw: string,
    handshakeTimeout: NodeJS.Timeout,
    resolve: () => void,
    reject: (err: Error) => void,
  ): void {
    try {
      const frame = JSON.parse(raw);

      // Step 2: Gateway sends connect.challenge
      if (frame.type === 'event' && frame.event === 'connect.challenge') {
        const { nonce } = frame.payload as { nonce: string; ts: number };
        logger.info('Received connect.challenge, signing nonce…');

        const token = process.env.OPENCLAW_GATEWAY_TOKEN || undefined;
        
        const device = signChallenge(this.identity, nonce, {
          clientId: CLIENT_ID,
          clientMode: CLIENT_MODE,
          role: CLIENT_ROLE,
          scopes: CLIENT_SCOPES,
          token,
        });

        const connectId = this.generateMessageId();

        // Step 3: Send connect request
        const connectReq = {
          type: 'req',
          id: connectId,
          method: 'connect',
          params: {
            minProtocol: OPENCLAW_PROTOCOL_VERSION,
            maxProtocol: OPENCLAW_PROTOCOL_VERSION,
            client: {
              id: CLIENT_ID,
              version: CLIENT_VERSION,
              platform: 'node',
              mode: CLIENT_MODE,
            },
            role: CLIENT_ROLE,
            scopes: CLIENT_SCOPES,
            caps: [],
            commands: [],
            permissions: {},
            auth: token ? { token } : {},
            locale: 'en-US',
            userAgent: `${CLIENT_ID}/${CLIENT_VERSION}`,
            device,
          },
        };
        console.log('[DEBUG] Connect request prepared, about to send');

        this.sendRaw(connectReq as unknown as OpenClawMessage);
        console.log('[DEBUG] sendRaw called');
        logger.info({ connectId }, 'Sent connect request');
        return;
      }

      // Step 4: Gateway responds with hello-ok
      if (
        frame.type === 'res' &&
        frame.ok === true &&
        (frame.payload as { type?: string })?.type === 'hello-ok'
      ) {
        clearTimeout(handshakeTimeout);
        this.state = 'connected';
        this.reconnectAttempts = 0;

        // If gateway issued a device token, we could persist it here.
        const helloPayload = frame.payload as {
          protocol?: number;
          auth?: { deviceToken?: string };
        };
        if (helloPayload?.auth?.deviceToken) {
          logger.info('Gateway issued device token (persisting not yet implemented)');
        }

        logger.info(
          { protocol: helloPayload?.protocol },
          'OpenClaw handshake complete (hello-ok)',
        );

        this.startPingLoop();
        this.drainQueue();
        this.emit('connected');
        this.emit('authenticated');
        resolve();
        return;
      }

      // Gateway rejects handshake
      if (frame.type === 'res' && frame.ok === false) {
        clearTimeout(handshakeTimeout);
        const errPayload = frame.payload as {
          message?: string;
          code?: string;
        } | undefined;
        const msg =
          errPayload?.message ||
          errPayload?.code ||
          'Handshake rejected by gateway';
        const err = new Error(msg);
        logger.error({ payload: frame.payload }, 'Handshake error from gateway');
        this.state = 'error';
        this.emit('authError', err);
        this.ws?.close();
        reject(err);
        return;
      }

      // Unknown frame during handshake – log and continue
      logger.warn({ frame }, 'Unexpected frame during handshake');
    } catch (parseErr) {
      logger.error({ error: parseErr, raw }, 'Failed to parse handshake frame');
    }
  }

  // =====================================================
  // Disconnect
  // =====================================================

  disconnect(): void {
    this.clearTimers();
    this.reconnectAttempts = this.config.maxReconnectAttempts; // Prevent reconnection

    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }

    this.state = 'disconnected';
    this.emit('disconnected', 'Client requested disconnect');
    logger.info('Disconnected from OpenClaw gateway');
  }

  // =====================================================
  // Sending Messages (post-handshake)
  // =====================================================

  /**
   * Send a message to the gateway using v3 frame format.
   *
   * For v3, messages are wrapped as:
   *   { type: "req", id, method: <type>, params: <payload> }
   * so the gateway can route them correctly.
   */
  async send(
    type: OpenClawMessageType,
    payload: unknown,
    waitForResponse = false,
  ): Promise<unknown> {
    // Only use params (not payload) - OpenClaw rejects extra properties at root level
    const message: OpenClawMessage = {
      id: this.generateMessageId(),
      type: 'req',
      method: type as string,
      params: payload,
    };

    // Note: Signature handling may need to be done differently in v3
    // For now, we skip signature as it's rejected at root level

    if (this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN) {
      return this.sendImmediate(message, waitForResponse);
    }

    return this.queueMessage(message);
  }

  async subscribeToChannel(channelId: string): Promise<void> {
    // Note: channel_subscribe is deprecated, messages come in automatically
    // Silently skip subscription - gateway handles Telegram messages via events
    logger.debug({ channelId }, 'Channel subscription handled by gateway');
  }

  async unsubscribeFromChannel(channelId: string): Promise<void> {
    logger.debug({ channelId }, 'Channel unsubscription handled by gateway');
  }

  async sendToChannel(
    channelId: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    const idempotencyKey = `send-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const target = metadata?.target as string || metadata?.to as string || '6986929051';
    const channel = metadata?.channel as string || channelId || 'telegram';
    
    await this.send('send', {
      to: target,
      channel: channel,
      message: content,
      idempotencyKey,
    });
    
    logger.info({ channelId: channel, target, contentLength: content.length }, 'Message sent to channel');
  }

  async syncAgent(agent: {
    slug: string;
    name: string;
    description: string;
    capabilities: string[];
    systemPrompt: string;
  }): Promise<unknown> {
    return this.send('agent_sync', agent, true);
  }

  // =====================================================
  // Resource Listing (Skills, Tools, Models)
  // =====================================================

  async listSkills(): Promise<Array<{
    id: string;
    name: string;
    description: string;
    status: 'ready' | 'missing' | 'disabled';
    source: string;
    commands?: string[];
    autoExec?: boolean;
    tags?: string[];
  }>> {
    const response = await this.send('skills.list', {}, true);
    return (response as any)?.skills || [];
  }

  async listTools(): Promise<Array<{
    id: string;
    name: string;
    category: string;
    description: string;
    enabled: boolean;
    permissions?: string[];
  }>> {
    const response = await this.send('tools.list', {}, true);
    return (response as any)?.tools || [];
  }

  async listModels(): Promise<Array<{
    id: string;
    name: string;
    provider: string;
    inputModes: string[];
    contextWindow: number;
    local: boolean;
    authRequired: boolean;
    tags: string[];
    aliases?: string[];
  }>> {
    const response = await this.send('models.list', {}, true);
    return (response as any)?.models || [];
  }

  // =====================================================
  // Private – Message Handling
  // =====================================================

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as OpenClawMessage;

      // Handle pong / ping responses
      if (
        message.type === 'pong' ||
        (message.type === 'event' && message.event === 'pong')
      ) {
        this.handlePong();
        return;
      }

      // Handle pending response
      if (message.id && this.pendingResponses.has(message.id)) {
        const pending = this.pendingResponses.get(message.id)!;
        this.pendingResponses.delete(message.id);
        pending.resolve(message.payload);
        return;
      }

      // Emit general message event
      this.emit('message', message);

      // Handle specific event types
      if (message.type === 'event') {
        switch (message.event) {
          case 'channel_message': {
            const channelPayload = message.payload as { channelId: string };
            this.emit('channelMessage', channelPayload.channelId, message.payload);
            break;
          }
          case 'error': {
            const errorPayload = message.payload as { message: string };
            logger.error({ payload: message.payload }, 'Server error');
            this.emit('error', new Error(errorPayload.message));
            break;
          }
          case 'system':
            logger.info({ payload: message.payload }, 'System message');
            break;
        }
      }

      // Handle res-type frames (responses to our requests)
      if (message.type === 'res') {
        if (message.ok === false) {
          const errPayload = message.payload as { message?: string };
          logger.error({ payload: message.payload }, 'Request error response');
          this.emit('error', new Error(errPayload?.message || 'Request failed'));
        }
      }
    } catch (error) {
      logger.error({ error, data }, 'Failed to parse message');
    }
  }

  // =====================================================
  // Private – Connection Lifecycle
  // =====================================================

  private handleDisconnect(code: number, reason: string): void {
    this.clearTimers();
    const wasConnected = this.state === 'connected';
    this.state = 'disconnected';

    logger.info({ code, reason }, 'Disconnected from gateway');
    this.emit('disconnected', reason);

    if (wasConnected && this.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    }
  }

  private handleError(error: Error): void {
    logger.error({ error }, 'WebSocket error');
    this.state = 'error';
    this.emit('error', error);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectAttempts++;
    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1),
      60000,
    );

    logger.info(
      { attempt: this.reconnectAttempts, delay },
      'Scheduling reconnection',
    );

    this.state = 'reconnecting';
    this.emit('reconnecting', this.reconnectAttempts);

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((error) => {
        logger.error({ error }, 'Reconnection failed');
        if (this.reconnectAttempts < this.config.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      });
    }, delay);
  }

  private startPingLoop(): void {
    // Use health check instead of ping since gateway doesn't support ping method
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.lastPingTime = Date.now();
        // Gateway doesn't support ping, but health events come automatically
        // Just mark that we received data
        logger.debug('Health check - connection alive');
        
        // Set a short timeout just in case
        this.pongTimer = setTimeout(() => {
          logger.warn('Health check timeout');
        }, 5000);
      }
    }, this.config.pingInterval);
  }

  private handlePong(): void {
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
    this.latency = Date.now() - this.lastPingTime;
  }

  private clearTimers(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    if (this.pongTimer) {
      clearTimeout(this.pongTimer);
      this.pongTimer = null;
    }
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  // =====================================================
  // Private – Send Helpers
  // =====================================================

  private sendRaw(message: OpenClawMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const json = JSON.stringify(message);
      console.log('[DEBUG] Sending frame:', json.substring(0, 200));
      this.ws.send(json);
    } else {
      console.log('[DEBUG] Cannot send - WebSocket not open, state:', this.ws?.readyState);
    }
  }

  private async sendImmediate(
    message: OpenClawMessage,
    waitForResponse: boolean,
  ): Promise<unknown> {
    if (waitForResponse) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.pendingResponses.delete(message.id);
          reject(new Error('Response timeout'));
        }, this.config.messageTimeout);

        this.pendingResponses.set(message.id, {
          message,
          resolve: (value) => {
            clearTimeout(timeout);
            resolve(value);
          },
          reject: (error) => {
            clearTimeout(timeout);
            reject(error);
          },
          timestamp: Date.now(),
          retries: 0,
        });

        this.sendRaw(message);
      });
    }

    this.sendRaw(message);
    return Promise.resolve();
  }

  private queueMessage(message: OpenClawMessage): Promise<unknown> {
    if (this.messageQueue.length >= this.config.maxQueueSize) {
      this.emit('queueFull');
      return Promise.reject(new Error('Message queue is full'));
    }

    return new Promise((resolve, reject) => {
      this.messageQueue.push({
        message,
        resolve,
        reject,
        timestamp: Date.now(),
        retries: 0,
      });

      logger.debug(
        { queueSize: this.messageQueue.length },
        'Message queued for later delivery',
      );
    });
  }

  private async drainQueue(): Promise<void> {
    if (this.messageQueue.length === 0) return;

    logger.info(
      { count: this.messageQueue.length },
      'Draining message queue',
    );

    const queue = [...this.messageQueue];
    this.messageQueue = [];

    for (const item of queue) {
      try {
        const result = await this.sendImmediate(item.message, false);
        item.resolve(result);
      } catch (error) {
        if (item.retries < 3) {
          item.retries++;
          this.messageQueue.push(item);
        } else {
          item.reject(error as Error);
        }
      }
    }
  }

  private generateMessageId(): string {
    return `msg-${this.identity.deviceId.substring(0, 8)}-${++this.messageCounter}-${Date.now()}`;
  }
}

// Singleton instance
let clientInstance: OpenClawClient | null = null;

export function getOpenClawClient(
  config?: Partial<OpenClawConnectionConfig>,
): OpenClawClient {
  if (!clientInstance) {
    clientInstance = new OpenClawClient(config);
  }
  return clientInstance;
}

export function resetOpenClawClient(): void {
  if (clientInstance) {
    clientInstance.disconnect();
    clientInstance = null;
  }
}

export default OpenClawClient;
