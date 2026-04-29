// =====================================================
// Analytics Dashboard - Comprehensive System Metrics
// =====================================================

import db from './db';
import { createChildLogger } from './logger';
import { cache } from './cache';

const logger = createChildLogger('analytics');

// Types
export interface AgentMetrics {
  agentId: string;
  name: string;
  division: string;
  tasksCompleted: number;
  tasksInProgress: number;
  tasksFailed: number;
  successRate: number;
  avgResponseTime: number;
  avgTaskDuration: number;
  lastActive: string | null;
}

export interface TaskAnalytics {
  totalTasks: number;
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
  completionRate: number;
  avgDuration: number;
  bottlenecks: Array<{ status: string; count: number; avgAge: number }>;
  throughput: { daily: number; weekly: number; monthly: number };
}

export interface SystemHealth {
  database: {
    sizeBytes: number;
    sizeMB: number;
    tableCount: number;
    totalRows: number;
    walSize: number;
  };
  agents: {
    total: number;
    active: number;
    idle: number;
    byDivision: Record<string, number>;
  };
  connections: {
    active: number;
    total: number;
  };
  uptime: number;
  lastUpdated: string;
}

export interface HistoricalMetrics {
  date: string;
  tasksCreated: number;
  tasksCompleted: number;
  avgResponseTime: number;
  activeAgents: number;
}

const startTime = Date.now();

// Agent Performance Metrics
export function getAgentMetrics(agentId?: string): AgentMetrics[] {
  const cacheKey = `agent_metrics_${agentId || 'all'}`;
  const cached = cache.get<AgentMetrics[]>(cacheKey);
  if (cached) return cached;

  try {
    const query = agentId
      ? `
        SELECT 
          a.id as agentId,
          a.name,
          a.division,
          a.status,
          a.last_heartbeat,
          a.metrics,
          (SELECT COUNT(*) FROM tasks WHERE assigned_to = a.id AND status = 'done') as tasksCompleted,
          (SELECT COUNT(*) FROM tasks WHERE assigned_to = a.id AND status = 'in_progress') as tasksInProgress,
          (SELECT COUNT(*) FROM tasks WHERE assigned_to = a.id AND status = 'failed') as tasksFailed,
          (SELECT AVG(CAST((julianday(completed_at) - julianday(started_at)) * 24 * 60 AS REAL))
           FROM tasks WHERE assigned_to = a.id AND completed_at IS NOT NULL) as avgDuration
        FROM agents a
        WHERE a.id = ?
      `
      : `
        SELECT 
          a.id as agentId,
          a.name,
          a.division,
          a.status,
          a.last_heartbeat,
          a.metrics,
          (SELECT COUNT(*) FROM tasks WHERE assigned_to = a.id AND status = 'done') as tasksCompleted,
          (SELECT COUNT(*) FROM tasks WHERE assigned_to = a.id AND status = 'in_progress') as tasksInProgress,
          (SELECT COUNT(*) FROM tasks WHERE assigned_to = a.id AND status = 'failed') as tasksFailed,
          (SELECT AVG(CAST((julianday(completed_at) - julianday(started_at)) * 24 * 60 AS REAL))
           FROM tasks WHERE assigned_to = a.id AND completed_at IS NOT NULL) as avgDuration
        FROM agents a
        ORDER BY tasksCompleted DESC
      `;

    const rows = agentId
      ? db.prepare(query).all(agentId) as any[]
      : db.prepare(query).all() as any[];

    const metrics = rows.map((row) => {
      const totalTasks = row.tasksCompleted + row.tasksInProgress + row.tasksFailed;
      const savedMetrics = row.metrics ? JSON.parse(row.metrics) : {};

      return {
        agentId: row.agentId,
        name: row.name,
        division: row.division,
        tasksCompleted: row.tasksCompleted || 0,
        tasksInProgress: row.tasksInProgress || 0,
        tasksFailed: row.tasksFailed || 0,
        successRate: totalTasks > 0 ? (row.tasksCompleted / totalTasks) * 100 : 0,
        avgResponseTime: savedMetrics.avgResponseTime || 0,
        avgTaskDuration: row.avgDuration || 0,
        lastActive: row.last_heartbeat,
      };
    });

    cache.set(cacheKey, metrics, 30000); // 30 second TTL
    return metrics;
  } catch (error) {
    logger.error({ error }, 'Failed to get agent metrics');
    return [];
  }
}

// Task Analytics
export function getTaskAnalytics(): TaskAnalytics {
  const cacheKey = 'task_analytics';
  const cached = cache.get<TaskAnalytics>(cacheKey);
  if (cached) return cached;

  try {
    // Get task counts by status
    const statusCounts = db.prepare(`
      SELECT status, COUNT(*) as count FROM tasks GROUP BY status
    `).all() as { status: string; count: number }[];

    const byStatus: Record<string, number> = {};
    let totalTasks = 0;
    statusCounts.forEach((row) => {
      byStatus[row.status] = row.count;
      totalTasks += row.count;
    });

    // Get task counts by priority
    const priorityCounts = db.prepare(`
      SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority
    `).all() as { priority: string; count: number }[];

    const byPriority: Record<string, number> = {};
    priorityCounts.forEach((row) => {
      byPriority[row.priority] = row.count;
    });

    // Get average duration for completed tasks (in hours)
    const avgDurationRow = db.prepare(`
      SELECT AVG(CAST((julianday(completed_at) - julianday(started_at)) * 24 AS REAL)) as avgDuration
      FROM tasks WHERE completed_at IS NOT NULL AND started_at IS NOT NULL
    `).get() as { avgDuration: number | null };

    // Get bottlenecks (tasks stuck in certain statuses)
    const bottlenecks = db.prepare(`
      SELECT 
        status,
        COUNT(*) as count,
        AVG(CAST((julianday('now') - julianday(created_at)) * 24 AS REAL)) as avgAge
      FROM tasks
      WHERE status NOT IN ('done', 'cancelled')
      GROUP BY status
      HAVING count > 3
      ORDER BY avgAge DESC
    `).all() as { status: string; count: number; avgAge: number }[];

    // Get throughput
    const dailyThroughput = db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE completed_at >= datetime('now', '-1 day')
    `).get() as { count: number };

    const weeklyThroughput = db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE completed_at >= datetime('now', '-7 days')
    `).get() as { count: number };

    const monthlyThroughput = db.prepare(`
      SELECT COUNT(*) as count FROM tasks
      WHERE completed_at >= datetime('now', '-30 days')
    `).get() as { count: number };

    const completedCount = byStatus['done'] || 0;
    const completionRate = totalTasks > 0 ? (completedCount / totalTasks) * 100 : 0;

    const analytics: TaskAnalytics = {
      totalTasks,
      byStatus,
      byPriority,
      completionRate,
      avgDuration: avgDurationRow?.avgDuration || 0,
      bottlenecks,
      throughput: {
        daily: dailyThroughput?.count || 0,
        weekly: weeklyThroughput?.count || 0,
        monthly: monthlyThroughput?.count || 0,
      },
    };

    cache.set(cacheKey, analytics, 30000); // 30 second TTL
    return analytics;
  } catch (error) {
    logger.error({ error }, 'Failed to get task analytics');
    return {
      totalTasks: 0,
      byStatus: {},
      byPriority: {},
      completionRate: 0,
      avgDuration: 0,
      bottlenecks: [],
      throughput: { daily: 0, weekly: 0, monthly: 0 },
    };
  }
}

// System Health Metrics
export function getSystemHealth(): SystemHealth {
  const cacheKey = 'system_health';
  const cached = cache.get<SystemHealth>(cacheKey);
  if (cached) return cached;

  try {
    // Database size
    const dbStats = db.prepare(`
      SELECT page_count * page_size as sizeBytes FROM pragma_page_count(), pragma_page_size()
    `).get() as { sizeBytes: number };

    // WAL size
    const walStats = db.prepare(`
      SELECT * FROM pragma_wal_checkpoint(PASSIVE)
    `).get() as { busy: number; log: number; checkpointed: number } | undefined;

    // Table count
    const tableCount = db.prepare(`
      SELECT COUNT(*) as count FROM sqlite_master WHERE type='table'
    `).get() as { count: number };

    // Total rows across main tables
    const rowCounts = db.prepare(`
      SELECT 
        (SELECT COUNT(*) FROM agents) +
        (SELECT COUNT(*) FROM tasks) +
        (SELECT COUNT(*) FROM agent_messages) +
        (SELECT COUNT(*) FROM activity_log) as totalRows
    `).get() as { totalRows: number };

    // Agent stats
    const agentStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active,
        SUM(CASE WHEN status = 'idle' THEN 1 ELSE 0 END) as idle
      FROM agents
    `).get() as { total: number; active: number; idle: number };

    // Agents by division
    const divisionCounts = db.prepare(`
      SELECT division, COUNT(*) as count FROM agents GROUP BY division
    `).all() as { division: string; count: number }[];

    const byDivision: Record<string, number> = {};
    divisionCounts.forEach((row) => {
      byDivision[row.division] = row.count;
    });

    // Connection stats
    const connectionStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'connected' THEN 1 ELSE 0 END) as active
      FROM gateway_connections
    `).get() as { total: number; active: number };

    const health: SystemHealth = {
      database: {
        sizeBytes: dbStats?.sizeBytes || 0,
        sizeMB: Math.round((dbStats?.sizeBytes || 0) / 1024 / 1024 * 100) / 100,
        tableCount: tableCount?.count || 0,
        totalRows: rowCounts?.totalRows || 0,
        walSize: walStats?.log || 0,
      },
      agents: {
        total: agentStats?.total || 0,
        active: agentStats?.active || 0,
        idle: agentStats?.idle || 0,
        byDivision,
      },
      connections: {
        active: connectionStats?.active || 0,
        total: connectionStats?.total || 0,
      },
      uptime: Math.floor((Date.now() - startTime) / 1000),
      lastUpdated: new Date().toISOString(),
    };

    cache.set(cacheKey, health, 10000); // 10 second TTL
    return health;
  } catch (error) {
    logger.error({ error }, 'Failed to get system health');
    return {
      database: { sizeBytes: 0, sizeMB: 0, tableCount: 0, totalRows: 0, walSize: 0 },
      agents: { total: 0, active: 0, idle: 0, byDivision: {} },
      connections: { active: 0, total: 0 },
      uptime: Math.floor((Date.now() - startTime) / 1000),
      lastUpdated: new Date().toISOString(),
    };
  }
}

// Historical Data Tracking
export function getHistoricalMetrics(days: number = 30): HistoricalMetrics[] {
  const cacheKey = `historical_metrics_${days}`;
  const cached = cache.get<HistoricalMetrics[]>(cacheKey);
  if (cached) return cached;

  try {
    const metrics = db.prepare(`
      SELECT 
        date(created_at) as date,
        COUNT(*) as tasksCreated,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as tasksCompleted
      FROM tasks
      WHERE created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY date(created_at)
      ORDER BY date DESC
    `).all(days) as HistoricalMetrics[];

    // Add agent activity data
    const result = metrics.map((m) => ({
      ...m,
      avgResponseTime: 0, // Would need activity log data
      activeAgents: 0, // Would need heartbeat tracking
    }));

    cache.set(cacheKey, result, 60000); // 1 minute TTL
    return result;
  } catch (error) {
    logger.error({ error }, 'Failed to get historical metrics');
    return [];
  }
}

// Real-time Statistics Aggregation
export function getRealTimeStats() {
  const cacheKey = 'realtime_stats';
  const cached = cache.get<any>(cacheKey);
  if (cached) return cached;

  try {
    const stats = {
      agents: {
        total: db.prepare('SELECT COUNT(*) as c FROM agents').get() as { c: number },
        active: db.prepare("SELECT COUNT(*) as c FROM agents WHERE status = 'active'").get() as { c: number },
      },
      tasks: {
        total: db.prepare('SELECT COUNT(*) as c FROM tasks').get() as { c: number },
        inProgress: db.prepare("SELECT COUNT(*) as c FROM tasks WHERE status = 'in_progress'").get() as { c: number },
        pending: db.prepare("SELECT COUNT(*) as c FROM tasks WHERE status IN ('inbox', 'backlog', 'todo')").get() as { c: number },
        completed: db.prepare("SELECT COUNT(*) as c FROM tasks WHERE status = 'done'").get() as { c: number },
      },
      recentActivity: db.prepare(`
        SELECT COUNT(*) as c FROM activity_log
        WHERE created_at >= datetime('now', '-1 hour')
      `).get() as { c: number },
      timestamp: new Date().toISOString(),
    };

    const result = {
      totalAgents: stats.agents.total.c,
      activeAgents: stats.agents.active.c,
      totalTasks: stats.tasks.total.c,
      tasksInProgress: stats.tasks.inProgress.c,
      tasksPending: stats.tasks.pending.c,
      tasksCompleted: stats.tasks.completed.c,
      recentActivityCount: stats.recentActivity.c,
      timestamp: stats.timestamp,
    };

    cache.set(cacheKey, result, 5000); // 5 second TTL
    return result;
  } catch (error) {
    logger.error({ error }, 'Failed to get real-time stats');
    return null;
  }
}

// Division Analytics
export function getDivisionAnalytics() {
  const cacheKey = 'division_analytics';
  const cached = cache.get<any>(cacheKey);
  if (cached) return cached;

  try {
    const divisionStats = db.prepare(`
      SELECT 
        a.division,
        COUNT(DISTINCT a.id) as agentCount,
        COUNT(t.id) as totalTasks,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) as completedTasks,
        SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as inProgressTasks
      FROM agents a
      LEFT JOIN tasks t ON t.assigned_to = a.id
      GROUP BY a.division
      ORDER BY agentCount DESC
    `).all() as any[];

    const result = divisionStats.map((d) => ({
      division: d.division,
      agentCount: d.agentCount,
      totalTasks: d.totalTasks || 0,
      completedTasks: d.completedTasks || 0,
      inProgressTasks: d.inProgressTasks || 0,
      completionRate: d.totalTasks > 0 ? Math.round((d.completedTasks / d.totalTasks) * 100) : 0,
    }));

    cache.set(cacheKey, result, 30000); // 30 second TTL
    return result;
  } catch (error) {
    logger.error({ error }, 'Failed to get division analytics');
    return [];
  }
}

// Token Usage Analytics
export function getTokenUsageAnalytics(days: number = 7) {
  const cacheKey = `token_usage_${days}`;
  const cached = cache.get<any>(cacheKey);
  if (cached) return cached;

  try {
    const usage = db.prepare(`
      SELECT 
        date(created_at) as date,
        SUM(input_tokens) as inputTokens,
        SUM(output_tokens) as outputTokens,
        SUM(cost) as totalCost,
        COUNT(*) as requestCount
      FROM token_usage
      WHERE created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY date(created_at)
      ORDER BY date DESC
    `).all(days) as any[];

    const byAgent = db.prepare(`
      SELECT 
        t.agent_id,
        a.name as agentName,
        SUM(t.input_tokens) as inputTokens,
        SUM(t.output_tokens) as outputTokens,
        SUM(t.cost) as totalCost
      FROM token_usage t
      LEFT JOIN agents a ON a.id = t.agent_id
      WHERE t.created_at >= datetime('now', '-' || ? || ' days')
      GROUP BY t.agent_id
      ORDER BY totalCost DESC
      LIMIT 10
    `).all(days) as any[];

    const result = { daily: usage, byAgent };
    cache.set(cacheKey, result, 60000); // 1 minute TTL
    return result;
  } catch (error) {
    logger.error({ error }, 'Failed to get token usage analytics');
    return { daily: [], byAgent: [] };
  }
}

// Export singleton
let analyticsInstance: ReturnType<typeof createAnalytics> | null = null;

function createAnalytics() {
  return {
    getAgentMetrics,
    getTaskAnalytics,
    getSystemHealth,
    getHistoricalMetrics,
    getRealTimeStats,
    getDivisionAnalytics,
    getTokenUsageAnalytics,
  };
}

export function getAnalytics() {
  if (!analyticsInstance) {
    analyticsInstance = createAnalytics();
  }
  return analyticsInstance;
}
