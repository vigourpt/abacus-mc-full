export const dynamic = 'force-dynamic';
// API: Agent Performance Analytics
import { NextResponse } from 'next/server';
import { getAgentMetrics, getDivisionAnalytics } from '@/lib/analytics';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agentId');
    const includesDivisions = searchParams.get('divisions') === 'true';

    const metrics = getAgentMetrics(agentId || undefined);

    const response: any = {
      success: true,
      data: {
        agents: metrics,
        totalAgents: metrics.length,
        summary: {
          totalTasksCompleted: metrics.reduce((sum, m) => sum + m.tasksCompleted, 0),
          avgSuccessRate: metrics.length > 0
            ? metrics.reduce((sum, m) => sum + m.successRate, 0) / metrics.length
            : 0,
          avgResponseTime: metrics.length > 0
            ? metrics.reduce((sum, m) => sum + m.avgResponseTime, 0) / metrics.length
            : 0,
        },
      },
      timestamp: new Date().toISOString(),
    };

    if (includesDivisions) {
      response.data.divisions = getDivisionAnalytics();
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get agent analytics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve agent analytics' },
      { status: 500 }
    );
  }
}
