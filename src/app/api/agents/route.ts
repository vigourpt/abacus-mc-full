export const dynamic = 'force-dynamic';
// =====================================================
// Agents API - CRUD operations for agents (Phase 2)
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { generateId, slugify } from '@/lib/utils';
import type { Agent, AgentRow } from '@/types';

// GET /api/agents - List all agents
export async function GET() {
  try {
    const stmt = db.prepare('SELECT * FROM agents ORDER BY division, name');
    const rows = stmt.all() as AgentRow[];

    const agents = rows.map(rowToAgent);
    return NextResponse.json(agents);
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

// POST /api/agents - Create a new agent
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const id = generateId();
    const slug = slugify(body.name);

    const stmt = db.prepare(`
      INSERT INTO agents (
        id, name, slug, description, emoji, color, division, specialization,
        source, source_url, status, capabilities, technical_skills, personality_traits,
        system_prompt, workspace_path, model_config, metrics
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      id,
      body.name,
      slug,
      body.description || '',
      body.emoji || '🤖',
      body.color || 'blue',
      body.division || 'engineering',
      body.specialization || null,
      body.source || 'local',
      body.sourceUrl || null,
      'idle',
      JSON.stringify(body.capabilities || []),
      JSON.stringify(body.technicalSkills || []),
      JSON.stringify(body.personalityTraits || []),
      body.systemPrompt || '',
      body.workspacePath || null,
      JSON.stringify(body.model || { primary: 'claude-3-opus', fallbacks: [] }),
      JSON.stringify({ tasksCompleted: 0, successRate: 0, avgResponseTime: 0 })
    );

    // Fetch the created agent
    const getStmt = db.prepare('SELECT * FROM agents WHERE id = ?');
    const row = getStmt.get(id) as AgentRow;

    return NextResponse.json(rowToAgent(row), { status: 201 });
  } catch (error) {
    console.error('Failed to create agent:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}

function rowToAgent(row: AgentRow): Agent {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    emoji: row.emoji,
    color: row.color,
    division: row.division as Agent['division'],
    specialization: row.specialization || undefined,
    source: (row.source || 'local') as Agent['source'],
    sourceUrl: row.source_url || undefined,
    status: row.status as Agent['status'],
    capabilities: JSON.parse(row.capabilities || '[]'),
    technicalSkills: JSON.parse(row.technical_skills || '[]'),
    personalityTraits: JSON.parse(row.personality_traits || '[]'),
    systemPrompt: row.system_prompt,
    workspacePath: row.workspace_path || undefined,
    model: JSON.parse(row.model_config || '{"primary":"claude-3-opus","fallbacks":[]}'),
    metrics: JSON.parse(row.metrics || '{"tasksCompleted":0,"successRate":0,"avgResponseTime":0}'),
    dependencies: JSON.parse(row.dependencies || '[]'),
    collaborationStyle: row.collaboration_style || undefined,
    lastHeartbeat: row.last_heartbeat ? new Date(row.last_heartbeat) : undefined,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}
