export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { getStartupGenerator } from '@/lib/startup-generator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idea, projectName } = body;

    if (!idea || typeof idea !== 'string' || idea.trim().length < 10) {
      return NextResponse.json(
        { error: 'Please provide a startup idea (at least 10 characters)' },
        { status: 400 }
      );
    }

    const generator = getStartupGenerator();
    const project = await generator.generateStartup(idea.trim(), projectName);

    return NextResponse.json({
      success: true,
      project: {
        id: project.id,
        name: project.name,
        slug: project.slug,
        createdAt: project.createdAt,
        phases: project.phases,
        taskCount: project.tasks.length,
        tasks: project.tasks.map(t => ({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          assignedTo: t.assignedTo,
          phase: t.tags.find(tag => tag.startsWith('phase-'))?.replace('phase-', ''),
        })),
      },
    });
  } catch (error) {
    console.error('Startup generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate startup' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const generator = getStartupGenerator();
    const summary = generator.getPipelineSummary();

    return NextResponse.json({
      success: true,
      pipeline: {
        name: 'Default Startup Pipeline',
        ...summary,
      },
    });
  } catch (error) {
    console.error('Pipeline info error:', error);
    return NextResponse.json(
      { error: 'Failed to load pipeline configuration' },
      { status: 500 }
    );
  }
}
