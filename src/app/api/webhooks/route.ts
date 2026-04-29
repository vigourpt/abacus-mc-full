export const dynamic = 'force-dynamic';
// =====================================================
// Webhooks API - CRUD operations for webhooks
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { generateId } from '@/lib/utils';

interface WebhookRow {
  id: string;
  name: string;
  url: string;
  method: string;
  events: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// GET /api/webhooks - List all webhooks
export async function GET() {
  try {
    const stmt = db.prepare('SELECT * FROM webhooks ORDER BY created_at DESC');
    const rows = stmt.all() as WebhookRow[];

    const webhooks = rows.map(row => ({
      id: row.id,
      name: row.name,
      url: row.url,
      method: row.method,
      events: JSON.parse(row.events || '[]'),
      status: row.status,
      lastTriggered: row.updated_at,
      successRate: 100,
      totalCalls: 0,
    }));

    return NextResponse.json(webhooks);
  } catch (error) {
    console.error('Failed to fetch webhooks:', error);
    return NextResponse.json([], { status: 200 });
  }
}

// POST /api/webhooks - Create a new webhook
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, url, method = 'POST', events = [] } = body;

    if (!name || !url) {
      return NextResponse.json(
        { error: 'name and url are required' },
        { status: 400 }
      );
    }

    const id = generateId();

    const stmt = db.prepare(`
      INSERT INTO webhooks (id, name, url, method, events, status)
      VALUES (?, ?, ?, ?, ?, 'active')
    `);

    stmt.run(id, name, url, method, JSON.stringify(events));

    return NextResponse.json({
      id,
      name,
      url,
      method,
      events,
      status: 'active',
      lastTriggered: null,
      successRate: 100,
      totalCalls: 0,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create webhook:', error);
    return NextResponse.json(
      { error: 'Failed to create webhook' },
      { status: 500 }
    );
  }
}

// DELETE /api/webhooks - Delete a webhook
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id is required' },
        { status: 400 }
      );
    }

    const stmt = db.prepare('DELETE FROM webhooks WHERE id = ?');
    stmt.run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete webhook:', error);
    return NextResponse.json(
      { error: 'Failed to delete webhook' },
      { status: 500 }
    );
  }
}
