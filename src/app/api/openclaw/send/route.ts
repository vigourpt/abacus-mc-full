export const dynamic = 'force-dynamic';
// =====================================================
// OpenClaw Send API - Send message to channel
// POST /api/openclaw/send
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/openclaw-client';
import { getMessageRouter } from '@/lib/message-router';
import { getOpenClawConfig } from '@/lib/openclaw-config';
import { createChildLogger } from '@/lib/logger';
import db from '@/lib/db';

const logger = createChildLogger('api-openclaw-send');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      channelId,
      agentSlug,
      content,
      format = 'text',
      replyTo,
      threadId,
      broadcast = false,
      metadata,
    } = body;

    // Validate required fields
    if (!content) {
      return NextResponse.json(
        { success: false, error: 'content is required' },
        { status: 400 }
      );
    }

    if (!broadcast && !channelId) {
      return NextResponse.json(
        { success: false, error: 'channelId is required (or set broadcast: true)' },
        { status: 400 }
      );
    }

    // Check connection
    const client = getOpenClawClient();
    if (client.getState() !== 'connected') {
      return NextResponse.json(
        {
          success: false,
          error: 'Not connected to OpenClaw gateway',
          hint: 'Call POST /api/openclaw/connect first',
        },
        { status: 400 }
      );
    }

    // Get agent ID (use default if not specified)
    const config = getOpenClawConfig();
    const effectiveAgentSlug = agentSlug || config.defaultAgent || 'system';

    // Validate agent exists
    if (effectiveAgentSlug !== 'system') {
      const agent = db
        .prepare('SELECT id FROM agents WHERE slug = ?')
        .get(effectiveAgentSlug) as { id: string } | undefined;

      if (!agent) {
        return NextResponse.json(
          { success: false, error: `Agent not found: ${effectiveAgentSlug}` },
          { status: 404 }
        );
      }
    }

    const router = getMessageRouter();

    if (broadcast) {
      // Broadcast to all enabled channels (or specified channels)
      const channelIds = body.channels as string[] | undefined;
      const sent = await router.broadcast(effectiveAgentSlug, content, channelIds);

      logger.info({ sent, agentSlug: effectiveAgentSlug }, 'Broadcast sent');

      return NextResponse.json({
        success: true,
        broadcast: true,
        sent,
        agentSlug: effectiveAgentSlug,
      });
    }

    // Send to specific channel
    await router.sendAgentResponse({
      channelId,
      agentId: effectiveAgentSlug,
      content,
      format,
      replyTo,
      threadId,
      metadata,
    });

    logger.info(
      { channelId, agentSlug: effectiveAgentSlug },
      'Message sent to channel'
    );

    return NextResponse.json({
      success: true,
      channelId,
      agentSlug: effectiveAgentSlug,
      format,
    });

  } catch (error) {
    logger.error({ error }, 'Failed to send message');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Send failed',
      },
      { status: 500 }
    );
  }
}
