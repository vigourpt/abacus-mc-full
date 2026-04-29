export const dynamic = 'force-dynamic';
// =====================================================
// OpenClaw Channels API - Manage channel configurations
// /api/openclaw/channels
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  getOpenClawConfig,
  upsertChannel,
  removeChannel,
  mapAgentToChannel,
  unmapAgentFromChannel,
  type OpenClawChannel,
} from '@/lib/openclaw-config';
import { getOpenClawClient } from '@/lib/openclaw-client';
import { createChildLogger } from '@/lib/logger';

const logger = createChildLogger('api-openclaw-channels');

// GET /api/openclaw/channels - List all channels
export async function GET() {
  try {
    const config = getOpenClawConfig();

    return NextResponse.json({
      success: true,
      channels: config.channels,
      count: config.channels.length,
      enabled: config.channels.filter(c => c.enabled).length,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to get channels' },
      { status: 500 }
    );
  }
}

// POST /api/openclaw/channels - Create or update a channel
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { channel } = body as { channel: OpenClawChannel };

    if (!channel || !channel.id || !channel.platform) {
      return NextResponse.json(
        { success: false, error: 'channel object with id and platform required' },
        { status: 400 }
      );
    }

    // Ensure agentMappings exists
    if (!channel.agentMappings) {
      channel.agentMappings = [];
    }

    upsertChannel(channel);

    // If connected, subscribe to the channel
    const client = getOpenClawClient();
    if (client.getState() === 'connected' && channel.enabled) {
      await client.subscribeToChannel(channel.id);
    }

    logger.info({ channelId: channel.id }, 'Channel configured');

    return NextResponse.json({
      success: true,
      channel,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to configure channel');
    return NextResponse.json(
      { success: false, error: 'Failed to configure channel' },
      { status: 500 }
    );
  }
}

// DELETE /api/openclaw/channels - Remove a channel
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const channelId = searchParams.get('channelId');

    if (!channelId) {
      return NextResponse.json(
        { success: false, error: 'channelId query parameter required' },
        { status: 400 }
      );
    }

    // Unsubscribe if connected
    const client = getOpenClawClient();
    if (client.getState() === 'connected') {
      await client.unsubscribeFromChannel(channelId);
    }

    removeChannel(channelId);
    logger.info({ channelId }, 'Channel removed');

    return NextResponse.json({
      success: true,
      channelId,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to remove channel');
    return NextResponse.json(
      { success: false, error: 'Failed to remove channel' },
      { status: 500 }
    );
  }
}

// PATCH /api/openclaw/channels - Map/unmap agent to channel
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, channelId, agentSlug, role, filter } = body;

    if (!channelId || !agentSlug) {
      return NextResponse.json(
        { success: false, error: 'channelId and agentSlug required' },
        { status: 400 }
      );
    }

    if (action === 'unmap') {
      unmapAgentFromChannel(channelId, agentSlug);
      logger.info({ channelId, agentSlug }, 'Agent unmapped from channel');

      return NextResponse.json({
        success: true,
        action: 'unmapped',
        channelId,
        agentSlug,
      });
    }

    // Default: map agent to channel
    mapAgentToChannel(channelId, {
      agentSlug,
      role: role || 'responder',
      filter,
    });

    logger.info({ channelId, agentSlug, role }, 'Agent mapped to channel');

    return NextResponse.json({
      success: true,
      action: 'mapped',
      channelId,
      agentSlug,
      role: role || 'responder',
    });
  } catch (error) {
    logger.error({ error }, 'Failed to update agent mapping');
    return NextResponse.json(
      { success: false, error: 'Failed to update agent mapping' },
      { status: 500 }
    );
  }
}
