export const dynamic = 'force-dynamic';
// =====================================================
// OpenClaw Status API - Get connection status
// GET /api/openclaw/status
// =====================================================

import { NextResponse } from 'next/server';
import { getOpenClawClient } from '@/lib/openclaw-client';
import { getOpenClawConfig } from '@/lib/openclaw-config';
import { getAgentCountBySource, getAgentCountByDivision } from '@/lib/agent-sync';
import db from '@/lib/db';

export async function GET() {
  try {
    const client = getOpenClawClient();
    const config = getOpenClawConfig();
    const connectionInfo = client.getConnectionInfo();

    // Get agent statistics
    const agentsBySource = getAgentCountBySource();
    const agentsByDivision = getAgentCountByDivision();
    const totalAgents = Object.values(agentsBySource).reduce((a, b) => a + b, 0);

    // Get message statistics
    const messageStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN type = 'request' THEN 1 ELSE 0 END) as requests,
        SUM(CASE WHEN type = 'response' THEN 1 ELSE 0 END) as responses,
        SUM(CASE WHEN read = 0 THEN 1 ELSE 0 END) as unread
      FROM agent_messages
      WHERE created_at > datetime('now', '-24 hours')
    `).get() as { total: number; requests: number; responses: number; unread: number };

    // Get task statistics
    const taskStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed
      FROM tasks
      WHERE created_at > datetime('now', '-24 hours')
    `).get() as { total: number; inProgress: number; completed: number };

    return NextResponse.json({
      success: true,
      connection: {
        status: connectionInfo.status,
        host: connectionInfo.host,
        port: connectionInfo.port,
        deviceId: connectionInfo.deviceIdentity?.deviceId,
        latency: client.getLatency(),
        queueSize: client.getQueueSize(),
      },
      config: {
        autoConnect: config.autoConnect,
        debugMode: config.debugMode,
        defaultAgent: config.defaultAgent,
        channelsConfigured: config.channels.length,
        channelsEnabled: config.channels.filter(c => c.enabled).length,
      },
      stats: {
        agents: {
          total: totalAgents,
          bySource: agentsBySource,
          byDivision: agentsByDivision,
        },
        messages: messageStats,
        tasks: taskStats,
      },
      channels: config.channels.map(ch => ({
        id: ch.id,
        name: ch.name,
        platform: ch.platform,
        enabled: ch.enabled,
        agentCount: ch.agentMappings.length,
      })),
    });

  } catch (error) {
    console.error('Failed to get OpenClaw status:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get status',
      },
      { status: 500 }
    );
  }
}
