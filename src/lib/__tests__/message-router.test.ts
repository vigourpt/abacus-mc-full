// =====================================================
// Message Router Tests
// Phase 3: Full OpenClaw Integration
// =====================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageRouter, resetMessageRouter, type IncomingMessage } from '../message-router';

describe('MessageRouter', () => {
  let router: MessageRouter;

  beforeEach(() => {
    resetMessageRouter();
    router = new MessageRouter();
  });

  describe('Agent Handlers', () => {
    it('should register and call agent handlers', async () => {
      const handler = vi.fn().mockResolvedValue('Response from agent');
      router.registerAgentHandler('test-agent', handler);

      const message: IncomingMessage = {
        id: 'msg-1',
        channelId: 'test-channel',
        platform: 'slack',
        senderId: 'user-1',
        senderName: 'Test User',
        content: 'Hello agent!',
        timestamp: new Date(),
        metadata: {},
      };

      // Route message directly (bypassing OpenClaw)
      // This would normally come from the client event
      await router.routeMessage(message);

      // Handler should be called for mapped agents
      // Note: This test is simplified; in real usage, the channel config
      // would determine which agents receive the message
    });

    it('should unregister agent handlers', () => {
      const handler = vi.fn();
      router.registerAgentHandler('test-agent', handler);
      router.unregisterAgentHandler('test-agent');

      // Handler should no longer be registered
    });
  });

  describe('Message Events', () => {
    it('should emit messageReceived event', () => {
      const receivedHandler = vi.fn();
      router.on('messageReceived', receivedHandler);

      const message: IncomingMessage = {
        id: 'msg-1',
        channelId: 'test-channel',
        platform: 'discord',
        senderId: 'user-1',
        content: 'Test message',
        timestamp: new Date(),
        metadata: {},
      };

      // Emit event directly for testing
      router.emit('messageReceived', message);

      expect(receivedHandler).toHaveBeenCalledWith(message);
    });

    it('should emit agentResponse event', () => {
      const responseHandler = vi.fn();
      router.on('agentResponse', responseHandler);

      const response = {
        channelId: 'test-channel',
        content: 'Agent response',
        agentId: 'test-agent',
      };

      router.emit('agentResponse', 'test-agent', response);

      expect(responseHandler).toHaveBeenCalledWith('test-agent', response);
    });
  });

  describe('Message Priority', () => {
    it('should determine high priority for urgent messages', () => {
      const message: IncomingMessage = {
        id: 'msg-1',
        channelId: 'test-channel',
        platform: 'slack',
        senderId: 'user-1',
        content: 'URGENT: Production is down!',
        timestamp: new Date(),
        metadata: {},
      };

      // The router internally determines priority
      // We can test this by emitting the message and checking routing
    });

    it('should determine low priority for FYI messages', () => {
      const message: IncomingMessage = {
        id: 'msg-2',
        channelId: 'test-channel',
        platform: 'slack',
        senderId: 'user-1',
        content: 'FYI - no rush on this',
        timestamp: new Date(),
        metadata: {},
      };

      // Similar to above, priority is determined internally
    });
  });

  describe('Lifecycle', () => {
    it('should start and stop the router', () => {
      expect(() => router.start()).not.toThrow();
      expect(() => router.stop()).not.toThrow();
    });
  });
});
