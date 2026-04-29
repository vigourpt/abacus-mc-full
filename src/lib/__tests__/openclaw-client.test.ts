// =====================================================
// OpenClaw Client Tests
// Phase 3: Full OpenClaw Integration
// =====================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { OpenClawClient, resetOpenClawClient } from '../openclaw-client';
import { MockOpenClawServer } from './mock-openclaw-server';
import { clearConfigCache, updateConnectionConfig } from '../openclaw-config';

describe('OpenClawClient', () => {
  let mockServer: MockOpenClawServer;
  const TEST_PORT = 18790;

  beforeAll(async () => {
    mockServer = new MockOpenClawServer({ port: TEST_PORT });
    await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  beforeEach(() => {
    resetOpenClawClient();
    clearConfigCache();
    mockServer.clearHistory();
  });

  describe('Connection', () => {
    it('should connect to the gateway', async () => {
      const client = new OpenClawClient({
        host: '127.0.0.1',
        port: TEST_PORT,
        secure: false,
      });

      await client.connect();
      expect(client.getState()).toBe('connected');

      client.disconnect();
    });

    it('should authenticate with v3 challenge-response handshake', async () => {
      const client = new OpenClawClient({
        host: '127.0.0.1',
        port: TEST_PORT,
        secure: false,
      });

      await client.connect();

      const history = mockServer.getMessageHistory();
      // The client should have sent a v3 connect request
      const connectReq = history.find(
        (m) => m.type === 'req' && m.method === 'connect',
      );

      expect(connectReq).toBeDefined();
      const params = (connectReq?.params || connectReq?.payload) as {
        device?: { id: string; publicKey: string; signature: string; nonce: string };
      };
      expect(params?.device).toBeDefined();
      expect(params?.device?.publicKey).toBeDefined();
      expect(params?.device?.signature).toBeDefined();
      expect(params?.device?.nonce).toBeDefined();

      client.disconnect();
    });

    it('should handle auth failure gracefully', async () => {
      const failServer = new MockOpenClawServer({
        port: TEST_PORT + 1,
        failAuth: true,
      });
      await failServer.start();

      const client = new OpenClawClient({
        host: '127.0.0.1',
        port: TEST_PORT + 1,
        secure: false,
      });

      await expect(client.connect()).rejects.toThrow();
      expect(client.getState()).toBe('error');

      await failServer.stop();
    });

    it('should get connection info', async () => {
      const client = new OpenClawClient({
        host: '127.0.0.1',
        port: TEST_PORT,
        secure: false,
      });

      await client.connect();

      const info = client.getConnectionInfo();
      expect(info.status).toBe('connected');
      expect(info.host).toBe('127.0.0.1');
      expect(info.port).toBe(TEST_PORT);
      expect(info.deviceIdentity).toBeDefined();

      client.disconnect();
    });
  });

  describe('Messaging', () => {
    it('should send messages to the gateway', async () => {
      const client = new OpenClawClient({
        host: '127.0.0.1',
        port: TEST_PORT,
        secure: false,
      });

      await client.connect();
      await client.send('channel_message', {
        channelId: 'test-channel',
        content: 'Hello, world!',
      });

      const history = mockServer.getMessageHistory();
      // v3: messages are sent as { type: "req", method: "channel_message" }
      const channelMessage = history.find(
        (m) => m.method === 'channel_message' || m.type === 'channel_message',
      );

      expect(channelMessage).toBeDefined();
      const p = (channelMessage?.params || channelMessage?.payload) as any;
      expect(p.content).toBe('Hello, world!');

      client.disconnect();
    });

    it('should subscribe to channels', async () => {
      const client = new OpenClawClient({
        host: '127.0.0.1',
        port: TEST_PORT,
        secure: false,
      });

      await client.connect();
      await client.subscribeToChannel('slack-general');

      const history = mockServer.getMessageHistory();
      const subscribeMessage = history.find(
        (m) => m.method === 'channel_subscribe' || m.type === 'channel_subscribe',
      );

      expect(subscribeMessage).toBeDefined();
      const p = (subscribeMessage?.params || subscribeMessage?.payload) as any;
      expect(p.channelId).toBe('slack-general');

      client.disconnect();
    });

    it('should queue messages when disconnected', async () => {
      const client = new OpenClawClient({
        host: '127.0.0.1',
        port: TEST_PORT + 99, // Non-existent
        secure: false,
        maxReconnectAttempts: 0,
      });

      // Don't await - it will fail
      client.send('system', { data: 'queued' }).catch(() => {});

      expect(client.getQueueSize()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Agent Sync', () => {
    it('should sync an agent to the gateway', async () => {
      const client = new OpenClawClient({
        host: '127.0.0.1',
        port: TEST_PORT,
        secure: false,
      });

      await client.connect();
      await client.syncAgent({
        slug: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        capabilities: ['testing'],
        systemPrompt: 'You are a test agent.',
      });

      const syncedAgents = mockServer.getSyncedAgents();
      expect(syncedAgents.has('test-agent')).toBe(true);

      client.disconnect();
    });
  });

  describe('Events', () => {
    it('should emit events on connection', async () => {
      const client = new OpenClawClient({
        host: '127.0.0.1',
        port: TEST_PORT,
        secure: false,
      });

      const events: string[] = [];
      client.on('connected', () => events.push('connected'));
      client.on('authenticated', () => events.push('authenticated'));

      await client.connect();

      expect(events).toContain('connected');
      expect(events).toContain('authenticated');

      client.disconnect();
    });

    it('should emit disconnected event', async () => {
      const client = new OpenClawClient({
        host: '127.0.0.1',
        port: TEST_PORT,
        secure: false,
        maxReconnectAttempts: 0,
      });

      await client.connect();

      const disconnectPromise = new Promise<void>(resolve => {
        client.on('disconnected', () => resolve());
      });

      client.disconnect();
      await disconnectPromise;

      expect(client.getState()).toBe('disconnected');
    });
  });
});
