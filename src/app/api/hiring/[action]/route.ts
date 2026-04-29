export const dynamic = 'force-dynamic';
// =====================================================
// Hiring Actions API
// POST /api/hiring/[action] - approve or reject
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { generateId, slugify } from '@/lib/utils';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  try {
    const { action } = await params;
    const body = await request.json();
    const { requestId, approvedBy = 'admin' } = body;
    
    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required' }, { status: 400 });
    }
    
    // Get the hiring request
    const requestStmt = db.prepare('SELECT * FROM hiring_requests WHERE id = ?');
    const hiringRequest = requestStmt.get(requestId) as any;
    
    if (!hiringRequest) {
      return NextResponse.json({ error: 'Hiring request not found' }, { status: 404 });
    }
    
    if (action === 'approve') {
      // Create the agent directly
      const agentId = generateId();
      const slug = slugify(hiringRequest.suggested_role);
      const roleName = hiringRequest.suggested_role;
      const division = hiringRequest.suggested_division || 'engineering';
      const justification = hiringRequest.justification || `AI agent for ${roleName}`;
      
      // Get capabilities from request
      let capabilitiesStr = '';
      try {
        const caps = hiringRequest.required_capabilities;
        if (typeof caps === 'string') {
          const arr = JSON.parse(caps || '[]');
          capabilitiesStr = Array.isArray(arr) ? arr.join(', ') : String(caps);
        } else if (Array.isArray(caps)) {
          capabilitiesStr = caps.join(', ');
        } else {
          capabilitiesStr = String(caps || '');
        }
      } catch (e) {
        capabilitiesStr = String(hiringRequest.required_capabilities || '');
      }
      
      // Insert the agent with all required fields
      const agentStmt = db.prepare(`
        INSERT INTO agents (
          id, name, slug, description, emoji, color, division, specialization,
          source, status, system_prompt, capabilities, technical_skills, personality_traits,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?, ?, datetime('now'))
      `);
      
      agentStmt.run(
        agentId,
        roleName,
        slug,
        justification,
        '🤖',
        '#6b7280',
        division,
        capabilitiesStr,
        'hired',
        `You are ${roleName}, an AI agent specialized in ${capabilitiesStr || 'general tasks'}.`,
        JSON.stringify(capabilitiesStr.split(',').map(s => s.trim()).filter(Boolean)),
        '[]',
        '[]'
      );
      
      // Update hiring request status
      const updateStmt = db.prepare(`
        UPDATE hiring_requests 
        SET status = 'completed', created_agent_id = ?, approved_by = ?
        WHERE id = ?
      `);
      updateStmt.run(agentId, approvedBy, requestId);
      
      return NextResponse.json({
        success: true,
        message: 'Agent hired successfully',
        agent: {
          id: agentId,
          name: hiringRequest.suggested_role,
          slug: slug,
          division: hiringRequest.suggested_division || 'engineering',
        }
      });
      
    } else if (action === 'reject') {
      const stmt = db.prepare(`
        UPDATE hiring_requests 
        SET status = 'rejected', approved_by = ?
        WHERE id = ? AND status = 'pending'
      `);
      const result = stmt.run(approvedBy, requestId);
      
      return NextResponse.json({
        success: result.changes > 0,
        message: result.changes > 0 ? 'Request rejected' : 'Request not found'
      });
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Hiring action failed:', error);
    return NextResponse.json({ error: 'Action failed' }, { status: 500 });
  }
}
