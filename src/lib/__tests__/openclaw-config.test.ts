// =====================================================
// OpenClaw Config Tests
// Phase 3: Full OpenClaw Integration
// =====================================================

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOpenClawConfig,
  saveOpenClawConfig,
  clearConfigCache,
  upsertChannel,
  removeChannel,
  mapAgentToChannel,
  unmapAgentFromChannel,
  getChannelsForAgent,
  getAgentsForChannel,
  getWebSocketUrl,
  type OpenClawConfig,
  type OpenClawChannel,
} from '../openclaw-config';

describe('OpenClawConfig', () => {
  beforeEach(() => {
    clearConfigCache();
  });

  describe('Configuration Management', () => {
    it('should return default configuration', () => {
      const config = getOpenClawConfig();

      expect(config).toBeDefined();
      expect(config.connection).toBeDefined();
      expect(config.connection.host).toBeDefined();
      expect(config.connection.port).toBeDefined();
      expect(config.channels).toEqual([]);
    });

    it('should generate correct WebSocket URL', () => {
      const config = getOpenClawConfig();
      const url = getWebSocketUrl(config.connection);

      expect(url).toMatch(/^wss?:\/\//); // Either ws or wss
      expect(url).toContain(config.connection.host);
      expect(url).toContain(config.connection.port.toString());
      expect(url).toContain('/v3/control');
    });
  });

  describe('Channel Management', () => {
    it('should add a new channel', () => {
      const channel: OpenClawChannel = {
        id: 'slack-general',
        name: 'General',
        platform: 'slack',
        enabled: true,
        config: { slackChannel: '#general' },
        agentMappings: [],
      };

      upsertChannel(channel);
      const config = getOpenClawConfig();

      expect(config.channels).toHaveLength(1);
      expect(config.channels[0].id).toBe('slack-general');
    });

    it('should update existing channel', () => {
      const channel: OpenClawChannel = {
        id: 'slack-general',
        name: 'General',
        platform: 'slack',
        enabled: true,
        config: {},
        agentMappings: [],
      };

      upsertChannel(channel);
      
      channel.name = 'Updated General';
      upsertChannel(channel);

      const config = getOpenClawConfig();
      expect(config.channels).toHaveLength(1);
      expect(config.channels[0].name).toBe('Updated General');
    });

    it('should remove a channel', () => {
      const channel: OpenClawChannel = {
        id: 'to-remove',
        name: 'To Remove',
        platform: 'discord',
        enabled: true,
        config: {},
        agentMappings: [],
      };

      upsertChannel(channel);
      removeChannel('to-remove');

      const config = getOpenClawConfig();
      expect(config.channels.find(c => c.id === 'to-remove')).toBeUndefined();
    });
  });

  describe('Agent-Channel Mapping', () => {
    beforeEach(() => {
      const channel: OpenClawChannel = {
        id: 'test-channel',
        name: 'Test',
        platform: 'slack',
        enabled: true,
        config: {},
        agentMappings: [],
      };
      upsertChannel(channel);
    });

    it('should map an agent to a channel', () => {
      mapAgentToChannel('test-channel', {
        agentSlug: 'support-agent',
        role: 'responder',
      });

      const agents = getAgentsForChannel('test-channel');
      expect(agents).toHaveLength(1);
      expect(agents[0].agentSlug).toBe('support-agent');
    });

    it('should get channels for an agent', () => {
      mapAgentToChannel('test-channel', {
        agentSlug: 'multi-agent',
        role: 'listener',
      });

      const channels = getChannelsForAgent('multi-agent');
      expect(channels).toHaveLength(1);
      expect(channels[0].id).toBe('test-channel');
    });

    it('should unmap an agent from a channel', () => {
      mapAgentToChannel('test-channel', {
        agentSlug: 'temp-agent',
        role: 'broadcaster',
      });

      unmapAgentFromChannel('test-channel', 'temp-agent');

      const agents = getAgentsForChannel('test-channel');
      expect(agents.find(a => a.agentSlug === 'temp-agent')).toBeUndefined();
    });

    it('should handle filters in agent mapping', () => {
      mapAgentToChannel('test-channel', {
        agentSlug: 'filtered-agent',
        role: 'responder',
        filter: {
          mentionRequired: true,
          keywordTriggers: ['help', 'support'],
        },
      });

      const agents = getAgentsForChannel('test-channel');
      expect(agents[0].filter).toBeDefined();
      expect(agents[0].filter?.mentionRequired).toBe(true);
      expect(agents[0].filter?.keywordTriggers).toContain('help');
    });
  });
});
