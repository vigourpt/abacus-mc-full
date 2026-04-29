export const dynamic = 'force-dynamic';
/**
 * Agent Performance Analytics API
 * 
 * Returns agent reputation data and performance metrics from SQLite.
 * 
 * Endpoints:
 * - GET: Fetch all agent performance data
 */

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';

interface AgentReputation {
  agent_name: string;
  tasks_completed: number;
  tasks_failed: number;
  total_execution_time: number;
  average_execution_time: number;
  success_rate: number;
  last_updated: string;
}

interface PerformanceMetrics {
  totalAgents: number;
  totalTasksCompleted: number;
  totalTasksFailed: number;
  overallSuccessRate: number;
  averageExecutionTime: number;
  topPerformers: AgentReputation[];
  recentlyActive: AgentReputation[];
  performanceByDivision: Record<string, {
    count: number;
    avgSuccessRate: number;
    totalTasks: number;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    // Check if the table exists
    const tableCheck = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='agent_reputation'
    `).get() as { name: string } | undefined;

    // If table doesn't exist, return empty data
    if (!tableCheck) {
      return NextResponse.json({
        success: true,
        data: {
          totalAgents: 0,
          totalTasksCompleted: 0,
          totalTasksFailed: 0,
          overallSuccessRate: 0,
          averageExecutionTime: 0,
          topPerformers: [],
          recentlyActive: [],
          performanceByDivision: {}
        } as PerformanceMetrics,
        message: 'Agent reputation table not yet initialized. Performance tracking will begin after task executions.'
      });
    }

    // Fetch all agent reputations
    const reputations = db.prepare(`
      SELECT * FROM agent_reputation 
      ORDER BY success_rate DESC, tasks_completed DESC
    `).all() as AgentReputation[];

    // Calculate aggregate metrics
    const totalAgents = reputations.length;
    const totalTasksCompleted = reputations.reduce((sum, r) => sum + r.tasks_completed, 0);
    const totalTasksFailed = reputations.reduce((sum, r) => sum + r.tasks_failed, 0);
    const totalTasks = totalTasksCompleted + totalTasksFailed;
    const overallSuccessRate = totalTasks > 0 
      ? totalTasksCompleted / totalTasks 
      : 0;
    const averageExecutionTime = reputations.length > 0
      ? reputations.reduce((sum, r) => sum + r.average_execution_time, 0) / reputations.length
      : 0;

    // Get top performers (at least 3 completed tasks, sorted by success rate)
    const topPerformers = reputations
      .filter(r => r.tasks_completed >= 3)
      .slice(0, 10);

    // Get recently active (sorted by last_updated)
    const recentlyActive = [...reputations]
      .sort((a, b) => {
        const dateA = new Date(a.last_updated || 0);
        const dateB = new Date(b.last_updated || 0);
        return dateB.getTime() - dateA.getTime();
      })
      .slice(0, 10);

    // Calculate performance by division (based on agent name patterns)
    const performanceByDivision: Record<string, {
      count: number;
      avgSuccessRate: number;
      totalTasks: number;
    }> = {};

    // Try to join with agents table to get division info
    try {
      const agentDivisions = db.prepare(`
        SELECT slug, division FROM agents WHERE slug IS NOT NULL
      `).all() as { slug: string; division: string }[];

      const divisionMap = new Map(agentDivisions.map(a => [a.slug, a.division]));

      for (const rep of reputations) {
        const division = divisionMap.get(rep.agent_name) || 'unknown';
        
        if (!performanceByDivision[division]) {
          performanceByDivision[division] = {
            count: 0,
            avgSuccessRate: 0,
            totalTasks: 0
          };
        }
        
        const div = performanceByDivision[division];
        div.count++;
        div.totalTasks += rep.tasks_completed + rep.tasks_failed;
        div.avgSuccessRate = (
          (div.avgSuccessRate * (div.count - 1) + rep.success_rate) / div.count
        );
      }
    } catch (e) {
      // If agents table doesn't exist or query fails, skip division grouping
      console.warn('Could not fetch agent divisions:', e);
    }

    const metrics: PerformanceMetrics = {
      totalAgents,
      totalTasksCompleted,
      totalTasksFailed,
      overallSuccessRate,
      averageExecutionTime,
      topPerformers,
      recentlyActive,
      performanceByDivision
    };

    return NextResponse.json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching agent performance:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch agent performance data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
