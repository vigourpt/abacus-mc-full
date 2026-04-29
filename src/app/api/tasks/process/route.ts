export const dynamic = 'force-dynamic';
// =====================================================
// Task Process API - Process a task via OpenClaw agent
// POST /api/tasks/process
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { generateId } from '@/lib/utils';
import { getOpenClawClient } from '@/lib/openclaw-client';

export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 });
    }
    const { taskId, agentSlug } = body;

    let client;
    try {
      client = getOpenClawClient();
    } catch (e) {
      return NextResponse.json({ success: false, error: 'Failed to get OpenClaw client' }, { status: 500 });
    }
    
    // Check connection
    if (client.getState() !== 'connected') {
      console.log('Not connected');
      return NextResponse.json(
        { success: false, error: 'Not connected to OpenClaw gateway' },
        { status: 400 }
      );
    }

    // Get task
    console.log('Getting task from DB');
    let task;
    if (taskId) {
      task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    } else {
      // Get next available task
      task = db.prepare(`
        SELECT * FROM tasks 
        WHERE status = 'todo'
        ORDER BY 
          CASE priority 
            WHEN 'critical' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'medium' THEN 3 
            ELSE 4 
          END,
          created_at ASC
        LIMIT 1
      `).get();
    }

    if (!task) {
      return NextResponse.json(
        { success: false, error: 'No tasks available to process' },
        { status: 404 }
      );
    }

    // Mark as in_progress
    db.prepare(`
      UPDATE tasks 
      SET status = 'in_progress', started_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).run(task.id);

    // Send to agent via OpenClaw
    const effectiveAgent = agentSlug || 'task-planner';
    
    // Safely parse context
    let contextObj = {};
    try {
      if (task.context && typeof task.context === 'string' && task.context.trim()) {
        contextObj = JSON.parse(task.context);
      }
    } catch (e) {
      // Ignore parse errors, use empty context
    }
    
    const taskMessage = `
## New Task

**Title:** ${task.title}
**Priority:** ${task.priority}
**Assigned by:** ${task.created_by || 'system'}

### Description
${task.description || 'No description provided'}

### Context
${JSON.stringify(contextObj, null, 2)}
`;

    try {
      // Send message directly via client - use telegram as it's the working channel
      await client.sendToChannel('telegram', taskMessage, {
        agentId: effectiveAgent,
        taskId: task.id,
      });

      // Log activity
      db.prepare(`
        INSERT INTO activity_log (id, type, message, metadata, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(
        generateId(),
        'task_processed',
        `Task "${task.title}" sent to agent ${effectiveAgent}`,
        JSON.stringify({ taskId: task.id, agentId: effectiveAgent })
      );

      return NextResponse.json({
        success: true,
        taskId: task.id,
        title: task.title,
        agent: effectiveAgent,
        status: 'in_progress',
        message: `Task sent to agent ${effectiveAgent}`,
      });

    } catch (error) {
      // Revert status on error
      db.prepare(`
        UPDATE tasks 
        SET status = 'todo', updated_at = datetime('now')
        WHERE id = ?
      `).run(task.id);

      return NextResponse.json(
        { success: false, error: error instanceof Error ? error.message : 'Failed to process task' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Task processing failed:', error);
    return NextResponse.json(
      { success: false, error: 'Task processing failed' },
      { status: 500 }
    );
  }
}

// GET - Get next task without processing
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const includeDetails = searchParams.get('details') === 'true';

    const task = db.prepare(`
      SELECT * FROM tasks 
      WHERE status = 'todo'
      ORDER BY 
        CASE priority 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          ELSE 4 
        END,
        created_at ASC
      LIMIT 1
    `).get();

    if (!task) {
      return NextResponse.json({ task: null, message: 'No tasks in queue' });
    }

    if (includeDetails) {
      return NextResponse.json({ task });
    }

    return NextResponse.json({
      taskId: task.id,
      title: task.title,
      priority: task.priority,
      status: task.status,
    });

  } catch (error) {
    console.error('Failed to get next task:', error);
    return NextResponse.json(
      { error: 'Failed to get next task' },
      { status: 500 }
    );
  }
}
