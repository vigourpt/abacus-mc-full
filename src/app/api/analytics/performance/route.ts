export const dynamic = 'force-dynamic';
// API: Performance Metrics
import { NextResponse } from 'next/server';
import { getPerformanceMonitor } from '@/lib/performance-monitor';
import { getOpenClawClient } from '@/lib/openclaw-client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const includeAlerts = searchParams.get('alerts') === 'true';
    const alertLimit = parseInt(searchParams.get('alertLimit') || '20', 10);

    const monitor = getPerformanceMonitor();
    const stats = monitor.getStats();

    // Get OpenClaw connection info
    const openclawClient = getOpenClawClient();
    const openclawState = openclawClient.getState();
    const openclawConnection = openclawClient.getConnectionInfo();

    // If OpenClaw is connected, use its stats
    const isOpenClawConnected = openclawState === 'connected';
    const openclawLatency = isOpenClawConnected ? openclawClient.getLatency() : 0;
    const openclawQueueSize = isOpenClawConnected ? openclawClient.getQueueSize() : 0;

    const response: any = {
      success: true,
      data: {
        performance: stats,
        openclaw: {
          connected: isOpenClawConnected,
          host: openclawConnection.host,
          port: openclawConnection.port,
          latency: openclawLatency,
          queueSize: openclawQueueSize,
        },
        summary: {
          requestsPerHour: stats.requests.total,
          avgLatencyMs: Math.round(stats.requests.avgDuration * 100) / 100,
          p95LatencyMs: Math.round(stats.requests.p95 * 100) / 100,
          errorRatePercent: Math.round(stats.requests.errorRate * 100) / 100,
          dbQueriesPerHour: stats.database.totalQueries,
          avgQueryTimeMs: Math.round(stats.database.avgQueryTime * 100) / 100,
          activeWebsockets: isOpenClawConnected ? 1 : 0,
          agentUtilization: Math.round(stats.workload.agentUtilization * 100) / 100,
        },
      },
      timestamp: new Date().toISOString(),
    };

    if (includeAlerts) {
      response.data.alerts = monitor.getAlerts(alertLimit);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get performance metrics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve performance metrics' },
      { status: 500 }
    );
  }
}
