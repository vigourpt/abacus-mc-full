export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import db from '@/lib/db';
import { generateId, slugify } from '@/lib/utils';

export async function GET() {
  try {
    const result = await db.prepare('SELECT * FROM agents ORDER BY division, name').all();
    const agents = result.map((row: any) => ({
      id: row.id, name: row.name, slug: row.slug, description: row.description,
      emoji: row.emoji || '🤖', color: row.color || 'blue', division: row.division,
      specialization: row.specialization,
      source: row.source || 'local', status: row.status || 'idle',
      capabilities: JSON.parse(row.capabilities || '[]'),
      technicalSkills: JSON.parse(row.technical_skills || '[]'),
      personalityTraits: JSON.parse(row.personality_traits || '[]'),
      systemPrompt: row.system_prompt || '',
      model: JSON.parse(row.model_config || '{"primary":"claude-3-opus","fallbacks":[]}'),
      metrics: JSON.parse(row.metrics || '{"tasksCompleted":0,"successRate":0,"avgResponseTime":0}'),
    }));
    return NextResponse.json(agents);
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    return NextResponse.json({ error: 'Failed to fetch agents' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = generateId();
    const slug = slugify(body.name);
    
    await db.prepare(
      `INSERT INTO agents (id, name, slug, description, emoji, color, division, specialization, source, status, capabilities, technical_skills, personality_traits, system_prompt, model_config, metrics) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, body.name, slug, body.description || '', body.emoji || '🤖', body.color || 'blue',
      body.division || 'engineering', body.specialization || '', body.source || 'local', 'idle',
      JSON.stringify(body.capabilities || []), JSON.stringify(body.technicalSkills || []),
      JSON.stringify(body.personalityTraits || []), body.systemPrompt || '',
      JSON.stringify({ primary: 'claude-3-opus', fallbacks: [] }),
      JSON.stringify({ tasksCompleted: 0, successRate: 0, avgResponseTime: 0 })
    );
    
    const row = await db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
    if (!row) return NextResponse.json({ error: 'Agent not found after insert' }, { status: 500 });
    
    return NextResponse.json({
      id: row.id, name: row.name, slug: row.slug, description: row.description,
      emoji: row.emoji, color: row.color, division: row.division,
      status: row.status,
      capabilities: JSON.parse(row.capabilities || '[]'),
      systemPrompt: row.system_prompt,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create agent:', error);
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
  }
}
