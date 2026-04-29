export const dynamic = 'force-dynamic';
// =====================================================
// Task Queue API - Poll next task for agent (Phase 2)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import type { Task, TaskRow } from '@/types';

// GET /api/tasks/queue?agent=<agent_id> - Get next task for agent
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get('agent');

    if (!agentId) {
      return NextResponse.json(
        { error: 'Agent ID required' },
        { status: 400 }
      );
    }

    // Get next available task for this agent
    const stmt = db.prepare(`
      SELECT * FROM tasks 
      WHERE assigned_to = ? 
        AND status = 'todo'
      ORDER BY 
        CASE priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END,
        created_at ASC
      LIMIT 1
    `);

    const row = stmt.get(agentId) as TaskRow | undefined;

    if (!row) {
      return NextResponse.json({ task: null });
    }

    // Mark task as in_progress
    const updateStmt = db.prepare(`
      UPDATE tasks 
      SET status = 'in_progress', started_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `);
    updateStmt.run(row.id);

    const task: Task = {
      id: row.id,
      title: row.title,
      description: row.description,
      status: 'in_progress',
      priority: row.priority as Task['priority'],
      assignedTo: row.assigned_to || undefined,
      createdBy: row.created_by || undefined,
      parentTaskId: row.parent_task_id || undefined,
      subtasks: JSON.parse(row.subtasks || '[]'),
      dependencies: JSON.parse(row.dependencies || '[]'),
      context: JSON.parse(row.context || '{}'),
      expectedOutput: row.expected_output || undefined,
      actualOutput: row.actual_output || undefined,
      qualityScore: row.quality_score || undefined,
      estimatedHours: row.estimated_hours || undefined,
      actualHours: row.actual_hours || undefined,
      tags: JSON.parse(row.tags || '[]'),
      dueDate: row.due_date ? new Date(row.due_date) : undefined,
      startedAt: new Date(),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(),
    };

    return NextResponse.json({ task });
  } catch (error) {
    console.error('Failed to get task from queue:', error);
    return NextResponse.json(
      { error: 'Failed to get task from queue' },
      { status: 500 }
    );
  }
}
