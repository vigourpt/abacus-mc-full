// =====================================================
// WebSocket Client for OpenClaw Gateway
// Implements the OpenClaw Protocol v3 challenge-response
// handshake (connect.challenge → connect → hello-ok).
// =====================================================

import WebSocket from 'ws';
import { createChildLogger } from './logger';
import { getOrCreateDeviceIdentity, signChallenge } from './device-identity';
import type { GatewayConnection, RealtimeEvent } from '@/types';

const logger = createChildLogger('websocket');

// Protocol version for OpenClaw 2026.x
const PROTOCOL_VERSION = 3;

// Client identification sent during the connect handshake.
// OpenClaw validates client.id against a whitelist of known constants.
// "openclaw-control-ui" is the standard control-plane client identifier.
// Override via OPENCLAW_CLIENT_ID env var if your gateway uses a different value.
const CLIENT_ID = process.env.OPENCLAW_CLIENT_ID || 'cli';
const CLIENT_VERSION = '1.0.0';
const CLIENT_ROLE = 'operator';
const CLIENT_MODE = process.env.OPENCLAW_CLIENT_MODE || 'cli';
const CLIENT_SCOPES = ['operator.admin', 'operator.read', 'operator.write', 'operator.approvals', 'operator.pairing'];

/** Timeout (ms) to wait for the full handshake to complete. */
const HANDSHAKE_TIMEOUT_MS = 15_000;

export type EventHandler = (event: RealtimeEvent) => void;

export class OpenClawWebSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private eventHandlers: EventHandler[] = [];
  private connection: GatewayConnection;
  private messageCounter = 0;

  constructor(
    host: string = process.env.OPENCLAW_GATEWAY_HOST || '127.0.0.1',
    port: number = parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789')
  ) {
    this.connection = {
      id: 'primary',
      host,
      port,
      status: 'disconnected',
    };
  }

  /**
   * Connect to OpenClaw Gateway using the v3 challenge-response handshake.
   *
   * Flow:
   *  1. Open a WebSocket to the gateway.
   *  2. Gateway sends  { type: "event", event: "connect.challenge", payload: { nonce, ts } }
   *  3. Client responds { type: "req", id, method: "connect", params: { ... device, auth ... } }
   *  4. Gateway replies  { type: "res", id, ok: true, payload: { type: "hello-ok", ... } }
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      logger.info('Already connected to gateway');
      return;
    }

    const identity = getOrCreateDeviceIdentity();
    this.connection.deviceIdentity = identity;
    this.connection.status = 'connecting';

    const protocol = process.env.NODE_ENV === 'production' ? 'wss' : 'ws';
    const url = `${protocol}://${this.connection.host}:${this.connection.port}/v${PROTOCOL_VERSION}/control`;

    return new Promise((resolve, reject) => {
      try {
        // Build minimal headers – only Origin and Host are needed for the
        // HTTP upgrade; authentication happens inside the WS frames.
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

        // Overall handshake timeout
        const handshakeTimeout = setTimeout(() => {
          if (
            this.connection.status === 'connecting' ||
            this.connection.status === 'connected' /* still waiting for hello-ok */
          ) {
            const err = new Error('OpenClaw handshake timeout');
            logger.error({ url }, err.message);
            this.connection.status = 'error';
            this.ws?.close();
            reject(err);
          }
        }, HANDSHAKE_TIMEOUT_MS);

        this.ws.on('open', () => {
          logger.info({ url }, 'WebSocket open, waiting for connect.challenge…');
          // Don't resolve yet – wait for the full handshake to complete.
        });

        this.ws.on('message', (data) => {
          const raw = data.toString();

          // During the handshake we intercept protocol frames.
          if (this.connection.status === 'connecting') {
            try {
              const frame = JSON.parse(raw);

              // Step 2: Gateway sends connect.challenge
              if (
                frame.type === 'event' &&
                frame.event === 'connect.challenge'
              ) {
                const { nonce } = frame.payload as { nonce: string; ts: number };
                logger.info('Received connect.challenge, signing nonce…');

                const token =
                  process.env.OPENCLAW_GATEWAY_TOKEN || undefined;

                const device = signChallenge(identity, nonce, {
                  clientId: CLIENT_ID,
                  clientMode: CLIENT_MODE,
                  role: CLIENT_ROLE,
                  scopes: CLIENT_SCOPES,
                  token,
                  platform: 'node',
                  deviceFamily: 'node',
                });

                const connectId = this.nextMessageId();

                // Step 3: Send connect request
                const connectReq = {
                  type: 'req',
                  id: connectId,
                  method: 'connect',
                  params: {
                    minProtocol: PROTOCOL_VERSION,
                    maxProtocol: PROTOCOL_VERSION,
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

                this.ws?.send(JSON.stringify(connectReq));
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
                this.connection.status = 'connected';
                this.connection.lastConnected = new Date();
                logger.info(
                  { protocol: (frame.payload as { protocol?: number }).protocol },
                  'OpenClaw handshake complete (hello-ok)',
                );
                this.startPing();
                resolve();
                return;
              }

              // If the gateway sends an error response during handshake
              if (frame.type === 'res' && frame.ok === false) {
                clearTimeout(handshakeTimeout);
                const errPayload = frame.payload as { message?: string; code?: string } | undefined;
                const msg = errPayload?.message || errPayload?.code || 'Handshake rejected by gateway';
                const err = new Error(msg);
                logger.error({ payload: frame.payload }, 'Handshake error from gateway');
                this.connection.status = 'error';
                this.ws?.close();
                reject(err);
                return;
              }

              // Unknown frame during handshake – log but continue waiting
              logger.warn({ frame }, 'Unexpected frame during handshake');
            } catch (parseErr) {
              logger.error({ error: parseErr, raw }, 'Failed to parse handshake frame');
            }
            return;
          }

          // After handshake – normal message handling
          this.handleMessage(raw);
        });

        this.ws.on('close', (code, reason) => {
          clearTimeout(handshakeTimeout);
          logger.info(
            { code, reason: reason.toString() },
            'Disconnected from gateway',
          );
          this.connection.status = 'disconnected';
          this.cleanup();
          this.scheduleReconnect();
        });

        this.ws.on('error', (error) => {
          clearTimeout(handshakeTimeout);
          logger.error({ error }, 'WebSocket error');
          this.connection.status = 'error';
          reject(error);
        });
      } catch (error) {
        logger.error({ error }, 'Failed to connect to gateway');
        this.connection.status = 'error';
        reject(error);
      }
    });
  }

  // =====================================================
  // Message Handling (post-handshake)
  // =====================================================

  /**
   * Handle incoming message after the handshake is complete.
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);

      // Handle pong
      if (message.type === 'pong' || (message.type === 'event' && message.event === 'pong')) {
        return;
      }

      // Create event for subscribers
      const event: RealtimeEvent = {
        type: message.type === 'event' ? message.event : message.type,
        payload: message.payload,
        timestamp: new Date(),
      };

      this.eventHandlers.forEach((handler) => handler(event));
    } catch (error) {
      logger.error({ error, data }, 'Failed to parse message');
    }
  }

  /**
   * Send a message to gateway (post-handshake).
   * Uses the v3 frame format: { type: "req", id, method, params }.
   */
  send(message: Record<string, unknown>): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      logger.warn('Cannot send message: not connected');
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Send a v3 "req" frame.
   */
  sendRequest(method: string, params: Record<string, unknown> = {}): string {
    const id = this.nextMessageId();
    this.send({ type: 'req', id, method, params });
    return id;
  }

  // =====================================================
  // Ping / Reconnect / Lifecycle
  // =====================================================

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      this.send({ type: 'req', id: this.nextMessageId(), method: 'ping', params: { timestamp: Date.now() } });
    }, 30000);
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((error) => {
        logger.error({ error }, 'Reconnection failed');
      });
    }, 5000);
  }

  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  subscribe(handler: EventHandler): () => void {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
    };
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanup();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnecting');
      this.ws = null;
    }
    this.connection.status = 'disconnected';
  }

  getConnection(): GatewayConnection {
    return { ...this.connection };
  }

  private nextMessageId(): string {
    return `msg-${++this.messageCounter}-${Date.now()}`;
  }
}

// Singleton instance
let wsInstance: OpenClawWebSocket | null = null;

export function getWebSocketClient(): OpenClawWebSocket {
  if (!wsInstance) {
    wsInstance = new OpenClawWebSocket();
  }
  return wsInstance;
}
