export const dynamic = 'force-dynamic';
// API: Task Analytics
import { NextResponse } from 'next/server';
import { getTaskAnalytics, getHistoricalMetrics } from '@/lib/analytics';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30', 10);
    const includeHistory = searchParams.get('history') === 'true';

    const analytics = getTaskAnalytics();

    const response: any = {
      success: true,
      data: {
        ...analytics,
        efficiency: {
          avgDurationHours: Math.round(analytics.avgDuration * 100) / 100,
          completionRatePercent: Math.round(analytics.completionRate * 100) / 100,
          throughputDaily: analytics.throughput.daily,
          throughputWeekly: analytics.throughput.weekly,
        },
      },
      timestamp: new Date().toISOString(),
    };

    if (includeHistory) {
      response.data.history = getHistoricalMetrics(days);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to get task analytics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve task analytics' },
      { status: 500 }
    );
  }
}
