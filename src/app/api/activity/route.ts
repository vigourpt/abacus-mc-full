export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { generateId } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const type = searchParams.get('type');

    let query = 'SELECT * FROM activity_log';
    const params: any[] = [];

    if (type) {
      query += ' WHERE type = ?';
      params.push(type);
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    const rows = db.prepare(query).all(...params) as any[];

    const activities = rows.map(row => ({
      id: row.id,
      type: row.type,
      agentId: row.agent_id,
      taskId: row.task_id,
      message: row.message,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: row.created_at,
    }));

    return NextResponse.json(activities);
  } catch (error) {
    console.error('Failed to fetch activities:', error);
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = generateId();

    db.prepare(`
      INSERT INTO activity_log (id, type, agent_id, task_id, message, metadata)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      id,
      body.type || 'system',
      body.agentId || null,
      body.taskId || null,
      body.message || '',
      JSON.stringify(body.metadata || {})
    );

    return NextResponse.json({ id, success: true }, { status: 201 });
  } catch (error) {
    console.error('Failed to create activity:', error);
    return NextResponse.json({ error: 'Failed to create activity' }, { status: 500 });
  }
}
