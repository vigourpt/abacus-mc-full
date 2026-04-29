export const dynamic = 'force-dynamic';
// =====================================================
// Agent Sync API - Sync from OpenClaw and workspace
// =====================================================

import { NextResponse } from 'next/server';
import { syncAll } from '@/lib/agent-sync';

// POST /api/agents/sync - Sync agents from all sources
export async function POST() {
  try {
    const result = await syncAll();

    return NextResponse.json({
      success: true,
      synced: result,
      message: `Synced ${result.openclaw} from OpenClaw, ${result.workspace} from workspace`,
    });
  } catch (error) {
    console.error('Sync failed:', error);
    return NextResponse.json(
      { success: false, error: 'Sync failed' },
      { status: 500 }
    );
  }
}
