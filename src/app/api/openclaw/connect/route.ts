export const dynamic = 'force-dynamic';
// =====================================================
// OpenClaw Connect API - Establish gateway connection
// POST /api/openclaw/connect
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getOpenClawClient, resetOpenClawClient } from '@/lib/openclaw-client';
import { updateConnectionConfig, getOpenClawConfig } from '@/lib/openclaw-config';
import { getMessageRouter } from '@/lib/message-router';
import { createChildLogger } from '@/lib/logger';

const logger = createChildLogger('api-openclaw-connect');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    // Update configuration if provided
    if (body.host || body.port) {
      updateConnectionConfig({
        host: body.host,
        port: body.port,
        secure: body.secure,
      });

      // Reset client to use new config
      resetOpenClawClient();
    }

    const client = getOpenClawClient();
    console.log('[DEBUG API] Got OpenClaw client, state:', client.getState());
    const router = getMessageRouter();

    // Check if already connected
    if (client.getState() === 'connected') {
      return NextResponse.json({
        success: true,
        message: 'Already connected to OpenClaw gateway',
        connection: client.getConnectionInfo(),
      });
    }

    // Attempt connection
    console.log('[DEBUG API] About to call client.connect()');
    await client.connect();

    // Start message router
    router.start();

    // Subscribe to configured channels
    const config = getOpenClawConfig();
    const subscribedChannels: string[] = [];

    for (const channel of config.channels) {
      if (channel.enabled) {
        try {
          await client.subscribeToChannel(channel.id);
          subscribedChannels.push(channel.id);
        } catch (error) {
          logger.error({ error, channelId: channel.id }, 'Failed to subscribe to channel');
        }
      }
    }

    logger.info(
      { channels: subscribedChannels.length },
      'Connected to OpenClaw gateway'
    );

    return NextResponse.json({
      success: true,
      message: 'Connected to OpenClaw gateway',
      connection: client.getConnectionInfo(),
      subscribedChannels,
    });

  } catch (error) {
    console.log('[DEBUG API] Caught error:', error);
    console.log('[DEBUG API] Error message:', error instanceof Error ? error.message : String(error));
    console.log('[DEBUG API] Error stack:', error instanceof Error ? error.stack : 'no stack');
    logger.error({ error, errorMessage: error instanceof Error ? error.message : String(error) }, 'Failed to connect to OpenClaw gateway');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      },
      { status: 500 }
    );
  }
}

// Disconnect endpoint
export async function DELETE() {
  try {
    const client = getOpenClawClient();
    const router = getMessageRouter();

    router.stop();
    client.disconnect();

    logger.info('Disconnected from OpenClaw gateway');

    return NextResponse.json({
      success: true,
      message: 'Disconnected from OpenClaw gateway',
    });

  } catch (error) {
    logger.error({ error }, 'Failed to disconnect');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Disconnect failed',
      },
      { status: 500 }
    );
  }
}
