#!/usr/bin/env npx tsx
// =====================================================
// Performance Report Generator
// =====================================================

import { getAnalytics } from '../src/lib/analytics';
import { getPerformanceMonitor } from '../src/lib/performance-monitor';
import { cache, agentCache, taskCache, apiCache } from '../src/lib/cache';
import { dbMaintenance } from '../src/lib/db-optimizer';
import '../src/lib/db';

async function main() {
  console.log('\n📊 Performance Report\n');
  console.log('Generated:', new Date().toISOString());
  console.log('='.repeat(60));

  const analytics = getAnalytics();
  const monitor = getPerformanceMonitor();

  // System Health
  console.log('\n🏥 SYSTEM HEALTH\n');
  const health = analytics.getSystemHealth();
  console.log(`  Uptime: ${Math.floor(health.uptime / 3600)}h ${Math.floor((health.uptime % 3600) / 60)}m`);
  console.log(`  Database Size: ${health.database.sizeMB} MB`);
  console.log(`  Total Rows: ${health.database.totalRows.toLocaleString()}`);
  console.log(`  Agents: ${health.agents.total} total, ${health.agents.active} active`);

  // Agent Stats
  console.log('\n🤖 AGENT STATISTICS\n');
  const agentMetrics = analytics.getAgentMetrics();
  const topAgents = agentMetrics
    .sort((a, b) => b.tasksCompleted - a.tasksCompleted)
    .slice(0, 5);
  
  if (topAgents.length > 0) {
    console.log('  Top Performers:');
    topAgents.forEach((agent, i) => {
      console.log(`    ${i + 1}. ${agent.name} - ${agent.tasksCompleted} tasks (${Math.round(agent.successRate)}% success)`);
    });
  } else {
    console.log('  No agent activity data available');
  }

  // Task Analytics
  console.log('\n📋 TASK ANALYTICS\n');
  const taskAnalytics = analytics.getTaskAnalytics();
  console.log(`  Total Tasks: ${taskAnalytics.totalTasks}`);
  console.log(`  Completion Rate: ${Math.round(taskAnalytics.completionRate)}%`);
  console.log(`  Avg Duration: ${Math.round(taskAnalytics.avgDuration * 10) / 10} hours`);
  console.log('\n  By Status:');
  Object.entries(taskAnalytics.byStatus).forEach(([status, count]) => {
    console.log(`    ${status}: ${count}`);
  });
  console.log('\n  Throughput:');
  console.log(`    Daily: ${taskAnalytics.throughput.daily}`);
  console.log(`    Weekly: ${taskAnalytics.throughput.weekly}`);
  console.log(`    Monthly: ${taskAnalytics.throughput.monthly}`);

  // Performance Stats
  console.log('\n⚡ PERFORMANCE METRICS\n');
  const perfStats = monitor.getStats();
  console.log(`  Requests: ${perfStats.requests.total} (past hour)`);
  console.log(`  Avg Latency: ${Math.round(perfStats.requests.avgDuration)}ms`);
  console.log(`  P95 Latency: ${Math.round(perfStats.requests.p95)}ms`);
  console.log(`  Error Rate: ${Math.round(perfStats.requests.errorRate * 100) / 100}%`);
  console.log(`\n  Database:`);
  console.log(`    Queries: ${perfStats.database.totalQueries}`);
  console.log(`    Avg Query Time: ${Math.round(perfStats.database.avgQueryTime)}ms`);
  console.log(`    Slow Queries: ${perfStats.database.slowQueries.length}`);

  // Cache Stats
  console.log('\n💾 CACHE STATISTICS\n');
  const caches = [
    { name: 'Main', stats: cache.getStats() },
    { name: 'Agent', stats: agentCache.getStats() },
    { name: 'Task', stats: taskCache.getStats() },
    { name: 'API', stats: apiCache.getStats() },
  ];
  caches.forEach(({ name, stats }) => {
    console.log(`  ${name}: ${stats.size} entries, ${Math.round(stats.hitRate)}% hit rate`);
  });

  // Alerts
  console.log('\n🚨 RECENT ALERTS\n');
  const alerts = monitor.getAlerts(10);
  if (alerts.length === 0) {
    console.log('  No recent alerts');
  } else {
    alerts.forEach((alert) => {
      const time = new Date(alert.timestamp).toISOString();
      const icon = alert.type === 'critical' ? '🔴' : '🟡';
      console.log(`  ${icon} [${time}] ${alert.message}`);
    });
  }

  // Database Details
  console.log('\n🗄️  DATABASE DETAILS\n');
  const dbStats = dbMaintenance.getStats();
  console.log('  Tables:');
  Object.entries(dbStats.tables).forEach(([table, count]) => {
    console.log(`    ${table}: ${count.toLocaleString()} rows`);
  });

  console.log('\n' + '='.repeat(60));
  console.log('Report complete!\n');
}

main().catch(console.error);
