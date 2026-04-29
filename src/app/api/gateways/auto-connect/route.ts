export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getOpenClawClient, resetOpenClawClient } from '@/lib/openclaw-client';
import { updateConnectionConfig } from '@/lib/openclaw-config';
import { getMessageRouter } from '@/lib/message-router';

interface GatewayRow {
  id: string;
  host: string;
  port: number;
  status: string;
  last_connected: string | null;
}

export async function POST() {
  try {
    const stmt = db.prepare('SELECT * FROM gateway_connections ORDER BY created_at DESC');
    const gateways = stmt.all() as GatewayRow[];

    if (gateways.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No gateways configured',
        connected: false,
      });
    }

    const client = getOpenClawClient();
    const router = getMessageRouter();

    if (client.getState() === 'connected') {
      return NextResponse.json({
        success: true,
        message: 'Already connected to OpenClaw gateway',
        connected: true,
        connection: client.getConnectionInfo(),
      });
    }

    const primaryGateway = gateways[0];
    
    updateConnectionConfig({
      host: primaryGateway.host,
      port: primaryGateway.port,
    });

    resetOpenClawClient();
    
    const newClient = getOpenClawClient();
    await newClient.connect();
    
    router.start();

    db.prepare(`
      UPDATE gateway_connections 
      SET status = 'connected', last_connected = datetime('now')
      WHERE id = ?
    `).run(primaryGateway.id);

    return NextResponse.json({
      success: true,
      message: `Connected to ${primaryGateway.host}:${primaryGateway.port}`,
      connected: true,
      connection: newClient.getConnectionInfo(),
      gatewayId: primaryGateway.id,
    });

  } catch (error) {
    console.error('Auto-connect failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Connection failed',
        connected: false,
      },
      { status: 500 }
    );
  }
}
