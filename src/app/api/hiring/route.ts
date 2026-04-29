export const dynamic = 'force-dynamic';
// =====================================================
// Hiring Requests API
// GET /api/hiring - List hiring requests
// POST /api/hiring - Create a hiring request
// POST /api/hiring/approve - Approve and create agent
// POST /api/hiring/reject - Reject a request
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import { getAgentHiringFramework } from '@/lib/agent-hiring';
import { getAgentImporter } from '@/lib/agent-importer';
import db from '@/lib/db';
import { generateId } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    let query = 'SELECT * FROM hiring_requests';
    const params: string[] = [];
    
    if (status && status !== 'all') {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC';
    
    const stmt = db.prepare(query);
    const rows = params.length > 0 ? stmt.all(...params) : stmt.all();
    
    const requests = rows.map((row: any) => ({
      id: row.id,
      role: row.suggested_role,
      division: row.suggested_division || 'engineering',
      suggestedBy: row.approved_by || 'System',
      reason: row.justification || '',
      priority: row.priority || 'medium',
      status: row.status,
      createdAt: row.created_at,
      skills: row.required_capabilities ? JSON.parse(row.required_capabilities) : [],
    }));
    
    return NextResponse.json(requests);
  } catch (error) {
    console.error('Failed to fetch hiring requests:', error);
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { role, division, reason, skills, priority = 'medium' } = body;
    
    if (!role) {
      return NextResponse.json({ error: 'Role is required' }, { status: 400 });
    }
    
    const id = generateId();
    
    const stmt = db.prepare(`
      INSERT INTO hiring_requests (
        id, suggested_role, suggested_division, required_capabilities,
        justification, priority, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', datetime('now'))
    `);
    
    stmt.run(
      id,
      role,
      division || 'engineering',
      JSON.stringify(skills || []),
      reason || `Need agent for ${role}`,
      priority
    );
    
    return NextResponse.json({
      id,
      role,
      division,
      status: 'pending',
      message: 'Hiring request created'
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create hiring request:', error);
    return NextResponse.json({ error: 'Failed to create request' }, { status: 500 });
  }
}
