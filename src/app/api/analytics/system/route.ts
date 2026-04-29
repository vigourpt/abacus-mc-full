export const dynamic = 'force-dynamic';
// API: System Health Dashboard
import { NextResponse } from 'next/server';
import { getSystemHealth, getRealTimeStats, getTokenUsageAnalytics } from '@/lib/analytics';
import { cache, agentCache, taskCache, apiCache } from '@/lib/cache';
import { dbMaintenance } from '@/lib/db-optimizer';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';

    const health = getSystemHealth();
    const realtime = getRealTimeStats();

    const response: any = {
      success: true,
      data: {
        health,
        realtime,
        cache: {
          main: cache.getStats(),
          agents: agentCache.getStats(),
          tasks: taskCache.getStats(),
          api: apiCache.getStats(),
        },
      },
      timestamp: new Date().toISOString(),
    };

    if (detailed) {
      response.data.database = dbMaintenance.getStats();
      response.data.tokenUsage = getTokenUsageAnalytics(7);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get system health:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve system health' },
      { status: 500 }
    );
  }
}

// POST: Run maintenance operations
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { operation } = body;

    let result: any;

    switch (operation) {
      case 'checkpoint':
        result = dbMaintenance.checkpoint();
        break;
      case 'vacuum':
        result = { success: dbMaintenance.vacuum() };
        break;
      case 'analyze':
        result = { success: dbMaintenance.analyze() };
        break;
      case 'integrity':
        result = dbMaintenance.integrityCheck();
        break;
      case 'optimize':
        result = dbMaintenance.optimize();
        break;
      case 'clear-cache':
        cache.clear();
        agentCache.clear();
        taskCache.clear();
        apiCache.clear();
        result = { success: true, message: 'All caches cleared' };
        break;
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid operation' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      operation,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to run maintenance:', error);
    return NextResponse.json(
      { success: false, error: 'Maintenance operation failed' },
      { status: 500 }
    );
  }
}
