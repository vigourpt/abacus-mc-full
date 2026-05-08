// =====================================================
// Minimal HTTPS Agents API
// Returns agents from the database - used by page.tsx on initial load
// GET /api/minimal-https
// =====================================================

import { NextResponse } from 'next/server';
import db from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stmt = db.prepare('SELECT * FROM agents ORDER BY division, name');
    const rows = await stmt.all() as any[];

    const agents = rows.map(row => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description || `${row.name} - ${row.specialization || 'General'}`,
      emoji: row.emoji || '🤖',
      color: row.color || 'blue',
      division: row.division,
      specialization: row.specialization || null,
      source: row.source || 'local',
      sourceUrl: row.source_url || null,
      status: row.status || 'active',
      capabilities: JSON.parse(row.capabilities || '[]'),
      technicalSkills: JSON.parse(row.technical_skills || '[]'),
      personalityTraits: JSON.parse(row.personality_traits || '[]'),
      systemPrompt: row.system_prompt || '',
      workspacePath: row.workspace_path || null,
      model: JSON.parse(row.model_config || '{"primary":"claude-3-haiku","fallbacks":[]}'),
      metrics: JSON.parse(row.metrics || '{"tasksCompleted":0,"successRate":0.85,"avgResponseTime":2000}'),
      dependencies: JSON.parse(row.dependencies || '[]'),
      collaborationStyle: row.collaboration_style || null,
      lastHeartbeat: row.last_heartbeat ? new Date(row.last_heartbeat) : null,
      createdAt: row.created_at ? new Date(row.created_at) : new Date(),
      updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
    }));

    return NextResponse.json(agents);
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    return NextResponse.json([], { status: 200 });
  }
}