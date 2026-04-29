export const dynamic = 'force-dynamic';
// =====================================================
// Tasks API - CRUD operations for tasks (Phase 2)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { generateId } from '@/lib/utils';
import { getTaskPlanner } from '@/lib/task-planner';
import type { Task, TaskRow } from '@/types';

// GET /api/tasks - List all tasks
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const assignedTo = searchParams.get('assigned_to');

    let query = 'SELECT * FROM tasks';
    const params: string[] = [];
    const conditions: string[] = [];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (assignedTo) {
      conditions.push('assigned_to = ?');
      params.push(assignedTo);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += " ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, created_at DESC";

    const stmt = db.prepare(query);
    const rows = stmt.all(...params) as TaskRow[];

    const tasks = rows.map(rowToTask);
    return NextResponse.json(tasks);
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

// POST /api/tasks - Create a new task
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const id = generateId();

    const stmt = db.prepare(`
      INSERT INTO tasks (
        id, title, description, status, priority,
        assigned_to, created_by, context, expected_output, 
        due_date, dependencies, estimated_hours, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      body.title,
      body.description || '',
      body.status || 'inbox',
      body.priority || 'medium',
      body.assignedTo || null,
      body.createdBy || 'system',
      JSON.stringify(body.context || {}),
      body.expectedOutput || null,
      body.dueDate || null,
      JSON.stringify(body.dependencies || []),
      body.estimatedHours || null,
      JSON.stringify(body.tags || [])
    );

    // Auto-assign if requested
    if (body.autoAssign) {
      const planner = getTaskPlanner();
      await planner.assignTask(id);
    }

    // Fetch the created task
    const getStmt = db.prepare('SELECT * FROM tasks WHERE id = ?');
    const row = getStmt.get(id) as TaskRow;

    return NextResponse.json(rowToTask(row), { status: 201 });
  } catch (error) {
    console.error('Failed to create task:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status as Task['status'],
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
    startedAt: row.started_at ? new Date(row.started_at) : undefined,
    completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
