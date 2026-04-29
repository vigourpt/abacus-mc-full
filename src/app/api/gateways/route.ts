export const dynamic = 'force-dynamic';
// =====================================================
// Gateways API - OpenClaw Gateway connections
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { generateId } from '@/lib/utils';
import { getOpenClawClient } from '@/lib/openclaw-client';
import type { GatewayConnection } from '@/types';

interface GatewayRow {
  id: string;
  host: string;
  port: number;
  status: string;
  last_connected: string | null;
  device_identity: string | null;
  created_at: string;
  updated_at: string;
}

// GET /api/gateways - List all gateway connections
export async function GET() {
  try {
    const stmt = db.prepare('SELECT * FROM gateway_connections ORDER BY created_at DESC');
    const rows = stmt.all() as GatewayRow[];

    // Get actual connection state from OpenClaw client
    const openclawClient = getOpenClawClient();
    const clientState = openclawClient.getConnectionInfo();
    const isActuallyConnected = clientState.status === 'connected';

    // Merge database records with actual connection state
    const gateways = rows.map(row => {
      // Check if this gateway matches the current client connection
      const isCurrentGateway = row.host === clientState.host && row.port === clientState.port;
      
      return {
        ...rowToGateway(row),
        // Use actual connection state if this is the current gateway
        status: isCurrentGateway && isActuallyConnected ? 'connected' as const : (row.status as GatewayConnection['status']),
        lastConnected: isCurrentGateway && isActuallyConnected ? new Date() : row.last_connected,
        deviceIdentity: isCurrentGateway && isActuallyConnected ? clientState.deviceIdentity : (row.device_identity ? JSON.parse(row.device_identity) : undefined),
      };
    });

    // Return as array for easy consumption by frontend
    return NextResponse.json(gateways);
  } catch (error) {
    console.error('Failed to fetch gateways:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/gateways - Create a new gateway connection
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const id = generateId();

    const stmt = db.prepare(`
      INSERT INTO gateway_connections (id, host, port, status)
      VALUES (?, ?, ?, 'disconnected')
    `);

    const host = body.host || process.env.OPENCLAW_GATEWAY_HOST || '127.0.0.1';
    const port = body.port || parseInt(process.env.OPENCLAW_GATEWAY_PORT || '18789');

    stmt.run(id, host, port);

    const getStmt = db.prepare('SELECT * FROM gateway_connections WHERE id = ?');
    const row = getStmt.get(id) as GatewayRow;

    return NextResponse.json(rowToGateway(row), { status: 201 });
  } catch (error) {
    console.error('Failed to create gateway:', error);
    return NextResponse.json(
      { error: 'Failed to create gateway' },
      { status: 500 }
    );
  }
}

function rowToGateway(row: GatewayRow): GatewayConnection {
  return {
    id: row.id,
    host: row.host,
    port: row.port,
    status: row.status as GatewayConnection['status'],
    lastConnected: row.last_connected ? new Date(row.last_connected) : undefined,
    deviceIdentity: row.device_identity ? JSON.parse(row.device_identity) : undefined,
  };
}
