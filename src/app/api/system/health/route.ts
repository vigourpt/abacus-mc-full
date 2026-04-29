export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import * as os from 'os';
import { getEnvironmentSummary } from '@/lib/env-validation';

export async function GET() {
  try {
    // Database health
    const agentCount = (db.prepare('SELECT COUNT(*) as count FROM agents').get() as any).count;
    const taskCount = (db.prepare('SELECT COUNT(*) as count FROM tasks').get() as any).count;
    const activeTaskCount = (db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status = 'in_progress'").get() as any).count;
    const activityCount = (db.prepare('SELECT COUNT(*) as count FROM activity_log').get() as any).count;

    // System metrics
    const cpuUsage = os.loadavg()[0];
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsage = Math.round(((totalMem - freeMem) / totalMem) * 100);

    // OpenClaw status (check without importing heavy client)
    const openclawConfigured = !!process.env.OPENCLAW_GATEWAY_HOST;
    const gatewayConnections = db.prepare('SELECT COUNT(*) as count FROM gateway_connections').get() as any;

    // Determine overall status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const checks: Record<string, { status: string; detail?: string }> = {};

    // Database check
    try {
      db.prepare('SELECT 1').get();
      checks.database = { status: 'pass' };
    } catch {
      checks.database = { status: 'fail', detail: 'Database query failed' };
      status = 'unhealthy';
    }

    // Memory check
    if (memoryUsage > 95) {
      checks.memory = { status: 'fail', detail: `Memory usage at ${memoryUsage}%` };
      status = 'unhealthy';
    } else if (memoryUsage > 85) {
      checks.memory = { status: 'warn', detail: `Memory usage at ${memoryUsage}%` };
      if (status === 'healthy') status = 'degraded';
    } else {
      checks.memory = { status: 'pass' };
    }

    // OpenClaw check
    if (openclawConfigured) {
      checks.openclaw = {
        status: 'pass',
        detail: `Configured: ${process.env.OPENCLAW_GATEWAY_HOST}:${process.env.OPENCLAW_GATEWAY_PORT || '18789'}`,
      };
    } else {
      checks.openclaw = { status: 'warn', detail: 'Not configured (standalone mode)' };
    }

    const envSummary = getEnvironmentSummary();

    return NextResponse.json({
      status,
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      checks,
      database: {
        agents: agentCount,
        tasks: taskCount,
        activeTasks: activeTaskCount,
        activities: activityCount,
        gateways: gatewayConnections.count,
      },
      system: {
        cpuLoad: Math.round(cpuUsage * 100) / 100,
        memoryUsagePercent: memoryUsage,
        totalMemoryMB: Math.round(totalMem / 1024 / 1024),
        freeMemoryMB: Math.round(freeMem / 1024 / 1024),
        platform: os.platform(),
        nodeVersion: process.version,
      },
      environment: {
        nodeEnv: envSummary.nodeEnv,
        openclawConfigured: (envSummary.openclaw as any)?.configured || false,
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return NextResponse.json(
      { status: 'unhealthy', error: String(error), timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
