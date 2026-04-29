// =====================================================
// Performance Monitoring - Request & System Tracking
// =====================================================

import db from './db';
import { createChildLogger } from './logger';
import { cache } from './cache';

const logger = createChildLogger('performance');

// Types
export interface RequestMetric {
  id: string;
  path: string;
  method: string;
  duration: number;
  statusCode: number;
  timestamp: number;
}

export interface QueryMetric {
  query: string;
  duration: number;
  rowCount: number;
  timestamp: number;
}

export interface WebSocketMetric {
  connectionId: string;
  event: 'connect' | 'disconnect' | 'message' | 'error';
  latency?: number;
  timestamp: number;
}

export interface WorkloadMetric {
  agentId: string;
  taskCount: number;
  avgWaitTime: number;
  timestamp: number;
}

export interface PerformanceStats {
  requests: {
    total: number;
    avgDuration: number;
    p50: number;
    p95: number;
    p99: number;
    errorRate: number;
    byPath: Record<string, { count: number; avgDuration: number }>;
  };
  database: {
    totalQueries: number;
    avgQueryTime: number;
    slowQueries: QueryMetric[];
  };
  websocket: {
    activeConnections: number;
    totalMessages: number;
    avgLatency: number;
    errors: number;
  };
  workload: {
    agentUtilization: number;
    avgTasksPerAgent: number;
    overloadedAgents: string[];
  };
}

export interface Alert {
  id: string;
  type: 'warning' | 'critical';
  metric: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

// Configuration
const CONFIG = {
  maxMetrics: 10000,
  alertThresholds: {
    requestDuration: { warning: 1000, critical: 5000 }, // ms
    queryDuration: { warning: 100, critical: 500 }, // ms
    errorRate: { warning: 5, critical: 15 }, // %
    agentWorkload: { warning: 10, critical: 20 }, // tasks
    memoryUsage: { warning: 80, critical: 95 }, // %
  },
  retentionPeriodMs: 3600000, // 1 hour
};

class PerformanceMonitor {
  private requestMetrics: RequestMetric[] = [];
  private queryMetrics: QueryMetric[] = [];
  private wsMetrics: WebSocketMetric[] = [];
  private workloadMetrics: WorkloadMetric[] = [];
  private alerts: Alert[] = [];
  private alertHandlers: Array<(alert: Alert) => void> = [];
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start cleanup interval
    this.cleanupInterval = setInterval(() => this.cleanup(), 60000);
    logger.info('Performance monitor initialized');
  }

  // Request tracking
  trackRequest(metric: Omit<RequestMetric, 'id' | 'timestamp'>): void {
    const fullMetric: RequestMetric = {
      ...metric,
      id: `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    this.requestMetrics.push(fullMetric);
    this.trimMetrics();

    // Check for slow requests
    if (metric.duration > CONFIG.alertThresholds.requestDuration.critical) {
      this.emitAlert({
        type: 'critical',
        metric: 'request_duration',
        message: `Slow request: ${metric.method} ${metric.path} took ${metric.duration}ms`,
        value: metric.duration,
        threshold: CONFIG.alertThresholds.requestDuration.critical,
      });
    } else if (metric.duration > CONFIG.alertThresholds.requestDuration.warning) {
      this.emitAlert({
        type: 'warning',
        metric: 'request_duration',
        message: `Slow request: ${metric.method} ${metric.path} took ${metric.duration}ms`,
        value: metric.duration,
        threshold: CONFIG.alertThresholds.requestDuration.warning,
      });
    }

    logger.debug({ ...fullMetric }, 'Request tracked');
  }

  // Create request tracking middleware
  createRequestMiddleware() {
    return (handler: (req: Request) => Promise<Response>) => {
      return async (req: Request): Promise<Response> => {
        const start = Date.now();
        const url = new URL(req.url);

        try {
          const response = await handler(req);
          const duration = Date.now() - start;

          this.trackRequest({
            path: url.pathname,
            method: req.method,
            duration,
            statusCode: response.status,
          });

          return response;
        } catch (error) {
          const duration = Date.now() - start;

          this.trackRequest({
            path: url.pathname,
            method: req.method,
            duration,
            statusCode: 500,
          });

          throw error;
        }
      };
    };
  }

  // Database query tracking
  trackQuery(metric: Omit<QueryMetric, 'timestamp'>): void {
    const fullMetric: QueryMetric = {
      ...metric,
      timestamp: Date.now(),
    };

    this.queryMetrics.push(fullMetric);
    this.trimMetrics();

    // Check for slow queries
    if (metric.duration > CONFIG.alertThresholds.queryDuration.critical) {
      this.emitAlert({
        type: 'critical',
        metric: 'query_duration',
        message: `Slow query took ${metric.duration}ms`,
        value: metric.duration,
        threshold: CONFIG.alertThresholds.queryDuration.critical,
      });
    }

    logger.debug({ ...fullMetric }, 'Query tracked');
  }

  // Create query wrapper for timing
  wrapQuery<T>(queryFn: () => T, queryName: string): T {
    const start = Date.now();
    try {
      const result = queryFn();
      const duration = Date.now() - start;

      let rowCount = 0;
      if (Array.isArray(result)) {
        rowCount = result.length;
      } else if (result !== null && result !== undefined) {
        rowCount = 1;
      }

      this.trackQuery({
        query: queryName,
        duration,
        rowCount,
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.trackQuery({
        query: queryName,
        duration,
        rowCount: 0,
      });
      throw error;
    }
  }

  // WebSocket connection tracking
  trackWebSocket(metric: Omit<WebSocketMetric, 'timestamp'>): void {
    const fullMetric: WebSocketMetric = {
      ...metric,
      timestamp: Date.now(),
    };

    this.wsMetrics.push(fullMetric);
    this.trimMetrics();

    if (metric.event === 'error') {
      this.emitAlert({
        type: 'warning',
        metric: 'websocket_error',
        message: `WebSocket error for connection ${metric.connectionId}`,
        value: 1,
        threshold: 0,
      });
    }

    logger.debug({ ...fullMetric }, 'WebSocket event tracked');
  }

  // Agent workload tracking
  trackWorkload(agentId: string): void {
    try {
      const result = db.prepare(`
        SELECT COUNT(*) as taskCount,
               AVG(CAST((julianday('now') - julianday(created_at)) * 24 * 60 AS REAL)) as avgWaitTime
        FROM tasks
        WHERE assigned_to = ? AND status IN ('todo', 'in_progress')
      `).get(agentId) as { taskCount: number; avgWaitTime: number };

      const metric: WorkloadMetric = {
        agentId,
        taskCount: result?.taskCount || 0,
        avgWaitTime: result?.avgWaitTime || 0,
        timestamp: Date.now(),
      };

      this.workloadMetrics.push(metric);
      this.trimMetrics();

      // Check for overloaded agents
      if (metric.taskCount > CONFIG.alertThresholds.agentWorkload.critical) {
        this.emitAlert({
          type: 'critical',
          metric: 'agent_workload',
          message: `Agent ${agentId} is overloaded with ${metric.taskCount} tasks`,
          value: metric.taskCount,
          threshold: CONFIG.alertThresholds.agentWorkload.critical,
        });
      } else if (metric.taskCount > CONFIG.alertThresholds.agentWorkload.warning) {
        this.emitAlert({
          type: 'warning',
          metric: 'agent_workload',
          message: `Agent ${agentId} has high workload: ${metric.taskCount} tasks`,
          value: metric.taskCount,
          threshold: CONFIG.alertThresholds.agentWorkload.warning,
        });
      }
    } catch (error) {
      logger.error({ error, agentId }, 'Failed to track workload');
    }
  }

  // Get comprehensive performance stats
  getStats(): PerformanceStats {
    const cacheKey = 'performance_stats';
    const cached = cache.get<PerformanceStats>(cacheKey);
    if (cached) return cached;

    const now = Date.now();
    const recentRequests = this.requestMetrics.filter(
      (m) => now - m.timestamp < CONFIG.retentionPeriodMs
    );
    const recentQueries = this.queryMetrics.filter(
      (m) => now - m.timestamp < CONFIG.retentionPeriodMs
    );
    const recentWs = this.wsMetrics.filter(
      (m) => now - m.timestamp < CONFIG.retentionPeriodMs
    );

    // Calculate request stats
    const durations = recentRequests.map((r) => r.duration).sort((a, b) => a - b);
    const errorCount = recentRequests.filter((r) => r.statusCode >= 400).length;

    const byPath: Record<string, { count: number; avgDuration: number }> = {};
    for (const req of recentRequests) {
      if (!byPath[req.path]) {
        byPath[req.path] = { count: 0, avgDuration: 0 };
      }
      const entry = byPath[req.path];
      entry.avgDuration = (entry.avgDuration * entry.count + req.duration) / (entry.count + 1);
      entry.count++;
    }

    // Calculate query stats
    const queryDurations = recentQueries.map((q) => q.duration);
    const slowQueries = recentQueries
      .filter((q) => q.duration > CONFIG.alertThresholds.queryDuration.warning)
      .slice(-10);

    // Calculate WebSocket stats
    const activeConnections = new Set(
      recentWs.filter((m) => m.event === 'connect').map((m) => m.connectionId)
    ).size;
    const disconnected = new Set(
      recentWs.filter((m) => m.event === 'disconnect').map((m) => m.connectionId)
    ).size;
    const messages = recentWs.filter((m) => m.event === 'message');
    const wsErrors = recentWs.filter((m) => m.event === 'error').length;

    // Calculate workload stats
    const latestWorkloads = new Map<string, WorkloadMetric>();
    for (const w of this.workloadMetrics) {
      latestWorkloads.set(w.agentId, w);
    }
    const workloads = Array.from(latestWorkloads.values());
    const totalTasks = workloads.reduce((sum, w) => sum + w.taskCount, 0);
    const overloadedAgents = workloads
      .filter((w) => w.taskCount > CONFIG.alertThresholds.agentWorkload.warning)
      .map((w) => w.agentId);

    const stats: PerformanceStats = {
      requests: {
        total: recentRequests.length,
        avgDuration: durations.length > 0
          ? durations.reduce((a, b) => a + b, 0) / durations.length
          : 0,
        p50: this.percentile(durations, 50),
        p95: this.percentile(durations, 95),
        p99: this.percentile(durations, 99),
        errorRate: recentRequests.length > 0
          ? (errorCount / recentRequests.length) * 100
          : 0,
        byPath,
      },
      database: {
        totalQueries: recentQueries.length,
        avgQueryTime: queryDurations.length > 0
          ? queryDurations.reduce((a, b) => a + b, 0) / queryDurations.length
          : 0,
        slowQueries,
      },
      websocket: {
        activeConnections: activeConnections - disconnected,
        totalMessages: messages.length,
        avgLatency: messages.length > 0
          ? messages.reduce((sum, m) => sum + (m.latency || 0), 0) / messages.length
          : 0,
        errors: wsErrors,
      },
      workload: {
        agentUtilization: workloads.length > 0
          ? (workloads.filter((w) => w.taskCount > 0).length / workloads.length) * 100
          : 0,
        avgTasksPerAgent: workloads.length > 0 ? totalTasks / workloads.length : 0,
        overloadedAgents,
      },
    };

    cache.set(cacheKey, stats, 5000); // 5 second TTL
    return stats;
  }

  // Get recent alerts
  getAlerts(limit: number = 50): Alert[] {
    return this.alerts.slice(-limit);
  }

  // Subscribe to alerts
  onAlert(handler: (alert: Alert) => void): () => void {
    this.alertHandlers.push(handler);
    return () => {
      this.alertHandlers = this.alertHandlers.filter((h) => h !== handler);
    };
  }

  // Emit an alert
  private emitAlert(alert: Omit<Alert, 'id' | 'timestamp'>): void {
    const fullAlert: Alert = {
      ...alert,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    this.alerts.push(fullAlert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Notify handlers
    for (const handler of this.alertHandlers) {
      try {
        handler(fullAlert);
      } catch (error) {
        logger.error({ error }, 'Alert handler failed');
      }
    }

    logger.warn({ alert: fullAlert }, 'Performance alert');
  }

  // Calculate percentile
  private percentile(arr: number[], p: number): number {
    if (arr.length === 0) return 0;
    const index = Math.ceil((p / 100) * arr.length) - 1;
    return arr[Math.max(0, index)];
  }

  // Cleanup old metrics
  private cleanup(): void {
    const cutoff = Date.now() - CONFIG.retentionPeriodMs;

    const beforeCount = {
      requests: this.requestMetrics.length,
      queries: this.queryMetrics.length,
      ws: this.wsMetrics.length,
      workload: this.workloadMetrics.length,
    };

    this.requestMetrics = this.requestMetrics.filter((m) => m.timestamp > cutoff);
    this.queryMetrics = this.queryMetrics.filter((m) => m.timestamp > cutoff);
    this.wsMetrics = this.wsMetrics.filter((m) => m.timestamp > cutoff);
    this.workloadMetrics = this.workloadMetrics.filter((m) => m.timestamp > cutoff);

    const cleaned = {
      requests: beforeCount.requests - this.requestMetrics.length,
      queries: beforeCount.queries - this.queryMetrics.length,
      ws: beforeCount.ws - this.wsMetrics.length,
      workload: beforeCount.workload - this.workloadMetrics.length,
    };

    if (Object.values(cleaned).some((v) => v > 0)) {
      logger.debug({ cleaned }, 'Performance metrics cleanup');
    }
  }

  // Trim metrics if exceeding max
  private trimMetrics(): void {
    if (this.requestMetrics.length > CONFIG.maxMetrics) {
      this.requestMetrics = this.requestMetrics.slice(-CONFIG.maxMetrics);
    }
    if (this.queryMetrics.length > CONFIG.maxMetrics) {
      this.queryMetrics = this.queryMetrics.slice(-CONFIG.maxMetrics);
    }
    if (this.wsMetrics.length > CONFIG.maxMetrics) {
      this.wsMetrics = this.wsMetrics.slice(-CONFIG.maxMetrics);
    }
    if (this.workloadMetrics.length > CONFIG.maxMetrics) {
      this.workloadMetrics = this.workloadMetrics.slice(-CONFIG.maxMetrics);
    }
  }

  // Destroy monitor
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    logger.info('Performance monitor destroyed');
  }
}

// Export singleton
let performanceMonitorInstance: PerformanceMonitor | null = null;

export function getPerformanceMonitor(): PerformanceMonitor {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new PerformanceMonitor();
  }
  return performanceMonitorInstance;
}

export { PerformanceMonitor };
