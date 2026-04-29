// =====================================================
// Mock OpenClaw Server for Testing
// Phase 3: Full OpenClaw Integration
//
// Implements the OpenClaw Protocol v3 challenge-response
// handshake so that tests exercise the real client flow.
// =====================================================

import { WebSocketServer, WebSocket } from 'ws';
import { createChildLogger } from '../logger';
import { randomBytes } from 'crypto';

const logger = createChildLogger('mock-openclaw');

interface MockMessage {
  id: string;
  type: string;
  method?: string;
  event?: string;
  ok?: boolean;
  payload: unknown;
  params?: unknown;
  timestamp?: number;
  signature?: string;
}

interface MockServerOptions {
  port?: number;
  authDelay?: number;
  simulateLatency?: number;
  failAuth?: boolean;
  disconnectAfter?: number;
}

/**
 * Mock OpenClaw Server for testing.
 * Simulates the OpenClaw gateway's v3 protocol handshake.
 */
export class MockOpenClawServer {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();
  private options: MockServerOptions;
  private messageHistory: MockMessage[] = [];
  private syncedAgents: Map<string, unknown> = new Map();
  private subscribedChannels: Map<WebSocket, Set<string>> = new Map();
  /** Track which sockets have completed the v3 handshake. */
  private authenticatedClients: Set<WebSocket> = new Set();

  constructor(options: MockServerOptions = {}) {
    this.options = {
      port: options.port || 18789,
      authDelay: options.authDelay || 100,
      simulateLatency: options.simulateLatency || 50,
      failAuth: options.failAuth || false,
      disconnectAfter: options.disconnectAfter,
    };
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.wss = new WebSocketServer({
          port: this.options.port,
          path: '/v3/control',
        });

        this.wss.on('connection', (ws, req) => {
          logger.info({ url: req.url }, 'Mock client connected');
          this.handleConnection(ws);
        });

        this.wss.on('listening', () => {
          logger.info({ port: this.options.port }, 'Mock OpenClaw server started');
          resolve();
        });

        this.wss.on('error', (error) => {
          logger.error({ error }, 'Mock server error');
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const client of this.clients) {
        client.close(1000, 'Server shutting down');
      }
      this.clients.clear();
      this.authenticatedClients.clear();

      if (this.wss) {
        this.wss.close(() => {
          logger.info('Mock OpenClaw server stopped');
          this.wss = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  getMessageHistory(): MockMessage[] {
    return [...this.messageHistory];
  }

  getSyncedAgents(): Map<string, unknown> {
    return new Map(this.syncedAgents);
  }

  clearHistory(): void {
    this.messageHistory = [];
  }

  broadcast(type: string, payload: unknown): void {
    const message: MockMessage = {
      id: `server-${Date.now()}`,
      type: 'event',
      event: type,
      payload,
      timestamp: Date.now(),
    };

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    }
  }

  simulateChannelMessage(
    channelId: string,
    senderId: string,
    content: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.broadcast('channel_message', {
      channelId,
      senderId,
      senderName: `User ${senderId}`,
      content,
      timestamp: Date.now(),
      metadata,
    });
  }

  // =====================================================
  // Private Methods
  // =====================================================

  private handleConnection(ws: WebSocket): void {
    this.clients.add(ws);
    this.subscribedChannels.set(ws, new Set());

    // Step 1: Send connect.challenge to the client (v3 protocol)
    const nonce = randomBytes(16).toString('hex');
    const challengeFrame = {
      type: 'event',
      event: 'connect.challenge',
      payload: { nonce, ts: Date.now() },
    };
    ws.send(JSON.stringify(challengeFrame));
    logger.info('Sent connect.challenge');

    ws.on('message', (data) => {
      this.handleMessage(ws, data.toString());
    });

    ws.on('close', () => {
      this.clients.delete(ws);
      this.subscribedChannels.delete(ws);
      this.authenticatedClients.delete(ws);
      logger.info('Mock client disconnected');
    });

    // Auto-disconnect if configured
    if (this.options.disconnectAfter) {
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(4000, 'Test disconnect');
        }
      }, this.options.disconnectAfter);
    }
  }

  private async handleMessage(ws: WebSocket, data: string): Promise<void> {
    try {
      const message = JSON.parse(data) as MockMessage;
      this.messageHistory.push(message);

      // Simulate latency
      if (this.options.simulateLatency) {
        await this.sleep(this.options.simulateLatency);
      }

      // Handle v3 "req" frames
      if (message.type === 'req') {
        switch (message.method) {
          case 'connect':
            await this.handleV3Connect(ws, message);
            return;
          case 'ping':
            this.handlePing(ws, message);
            return;
          case 'channel_subscribe':
            this.handleChannelSubscribe(ws, message);
            return;
          case 'channel_unsubscribe':
            this.handleChannelUnsubscribe(ws, message);
            return;
          case 'channel_message':
            this.handleChannelMessage(ws, message);
            return;
          case 'agent_sync':
            this.handleAgentSync(ws, message);
            return;
          default:
            logger.warn({ method: message.method }, 'Unknown req method');
            return;
        }
      }

      // Legacy: handle old-style frames for backwards compatibility
      switch (message.type) {
        case 'ping':
          this.handlePing(ws, message);
          break;
        case 'auth':
          // Translate to v3 connect
          await this.handleLegacyAuth(ws, message);
          break;
        case 'agent_sync':
          this.handleAgentSync(ws, message);
          break;
        case 'channel_subscribe':
          this.handleChannelSubscribe(ws, message);
          break;
        case 'channel_unsubscribe':
          this.handleChannelUnsubscribe(ws, message);
          break;
        case 'channel_message':
          this.handleChannelMessage(ws, message);
          break;
        default:
          logger.warn({ type: message.type }, 'Unknown message type');
      }
    } catch (error) {
      logger.error({ error, data }, 'Failed to process message');
    }
  }

  /**
   * Handle the v3 connect request (step 3 of the handshake).
   * Respond with hello-ok or an error.
   */
  private async handleV3Connect(ws: WebSocket, message: MockMessage): Promise<void> {
    if (this.options.authDelay) {
      await this.sleep(this.options.authDelay);
    }

    if (this.options.failAuth) {
      this.send(ws, {
        id: message.id,
        type: 'res',
        ok: false,
        payload: {
          type: 'error',
          code: 'AUTH_FAILED',
          message: 'Authentication failed (test mode)',
        },
      });
      ws.close(1008, 'Authentication failed');
      return;
    }

    // Mark client as authenticated
    this.authenticatedClients.add(ws);

    // Send hello-ok (step 4 of the handshake)
    this.send(ws, {
      id: message.id,
      type: 'res',
      ok: true,
      payload: {
        type: 'hello-ok',
        protocol: 3,
        policy: { tickIntervalMs: 15000 },
      },
    });

    const params = (message.params || message.payload) as { device?: { id?: string } } | undefined;
    logger.info({ deviceId: params?.device?.id }, 'v3 connect handshake complete');
  }

  /** Legacy auth handler — kept for any tests that still send old-style auth frames. */
  private async handleLegacyAuth(ws: WebSocket, message: MockMessage): Promise<void> {
    if (this.options.authDelay) {
      await this.sleep(this.options.authDelay);
    }

    if (this.options.failAuth) {
      this.send(ws, {
        id: message.id,
        type: 'auth_response',
        payload: { success: false, error: 'Authentication failed (test mode)' },
      });
      return;
    }

    const authPayload = message.payload as { deviceId: string; publicKey: string };
    this.authenticatedClients.add(ws);

    this.send(ws, {
      id: message.id,
      type: 'auth_response',
      payload: {
        success: true,
        sessionId: `session-${authPayload.deviceId}-${Date.now()}`,
        expiresAt: Date.now() + 3600000,
      },
    });

    logger.info({ deviceId: authPayload.deviceId }, 'Legacy auth successful');
  }

  private handlePing(ws: WebSocket, message: MockMessage): void {
    this.send(ws, {
      id: message.id,
      type: 'pong',
      payload: { timestamp: Date.now() },
    });
  }

  private handleAgentSync(ws: WebSocket, message: MockMessage): void {
    const payload = (message.params || message.payload) as {
      action?: string;
      agentId?: string;
      slug?: string;
      name?: string;
    };

    switch (payload.action) {
      case 'list':
        this.send(ws, {
          id: message.id,
          type: 'res',
          ok: true,
          payload: {
            success: true,
            action: 'list',
            agents: Array.from(this.syncedAgents.values()),
          },
        });
        break;

      case 'delete':
        this.syncedAgents.delete(payload.agentId || '');
        this.send(ws, {
          id: message.id,
          type: 'res',
          ok: true,
          payload: { success: true, action: 'delete', agentId: payload.agentId },
        });
        break;

      default: {
        const agentId = payload.slug || payload.agentId || `agent-${Date.now()}`;
        this.syncedAgents.set(agentId, payload);
        this.send(ws, {
          id: message.id,
          type: 'res',
          ok: true,
          payload: { success: true, action: 'sync', agentId },
        });
        logger.info({ agentId }, 'Agent synced to mock server');
      }
    }
  }

  private handleChannelSubscribe(ws: WebSocket, message: MockMessage): void {
    const payload = (message.params || message.payload) as { channelId: string };
    const channels = this.subscribedChannels.get(ws) || new Set();
    channels.add(payload.channelId);
    this.subscribedChannels.set(ws, channels);

    this.send(ws, {
      id: message.id,
      type: 'res',
      ok: true,
      payload: { event: 'channel_subscribed', channelId: payload.channelId },
    });
    logger.info({ channelId: payload.channelId }, 'Channel subscribed');
  }

  private handleChannelUnsubscribe(ws: WebSocket, message: MockMessage): void {
    const payload = (message.params || message.payload) as { channelId: string };
    const channels = this.subscribedChannels.get(ws);
    if (channels) {
      channels.delete(payload.channelId);
    }

    this.send(ws, {
      id: message.id,
      type: 'res',
      ok: true,
      payload: { event: 'channel_unsubscribed', channelId: payload.channelId },
    });
    logger.info({ channelId: payload.channelId }, 'Channel unsubscribed');
  }

  private handleChannelMessage(ws: WebSocket, message: MockMessage): void {
    const payload = (message.params || message.payload) as {
      channelId: string;
      content: string;
      agentId: string;
    };

    // Echo to other subscribers
    for (const [client, channels] of this.subscribedChannels.entries()) {
      if (channels.has(payload.channelId) && client !== ws) {
        this.send(client, {
          id: `echo-${message.id}`,
          type: 'event',
          event: 'channel_message',
          payload: {
            channelId: payload.channelId,
            senderId: payload.agentId,
            senderName: `Agent ${payload.agentId}`,
            content: payload.content,
            timestamp: Date.now(),
          },
        });
      }
    }

    logger.info(
      { channelId: payload.channelId, agentId: payload.agentId },
      'Channel message processed',
    );
  }

  private send(ws: WebSocket, message: Partial<MockMessage>): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Helper to create and start a mock server
export async function createMockServer(
  options?: MockServerOptions,
): Promise<MockOpenClawServer> {
  const server = new MockOpenClawServer(options);
  await server.start();
  return server;
}

export default MockOpenClawServer;
