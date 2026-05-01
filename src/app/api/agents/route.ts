export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';
import { generateId, slugify } from '@/lib/utils';

const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || undefined;

function makeClient() {
  return createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
}

export async function GET() {
  try {
    const client = makeClient();
    const result = await client.execute('SELECT * FROM agents ORDER BY division, name');
    const agents = result.rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      emoji: row.emoji,
      color: row.color,
      division: row.division,
      specialization: row.specialization,
      source: row.source || 'local',
      sourceUrl: row.source_url,
      status: row.status || 'idle',
      capabilities: JSON.parse(row.capabilities || '[]'),
      technicalSkills: JSON.parse(row.technical_skills || '[]'),
      personalityTraits: JSON.parse(row.personality_traits || '[]'),
      systemPrompt: row.system_prompt,
      workspacePath: row.workspace_path,
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
    
    const client = makeClient();
    await client.execute({
      sql: `INSERT INTO agents (id, name, slug, description, emoji, color, division, specialization, source, source_url, status, capabilities, technical_skills, personality_traits, system_prompt, model_config, metrics) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, body.name, slug, body.description || '', body.emoji || '🤖', body.color || 'blue', body.division || 'engineering', body.specialization || null, body.source || 'local', body.sourceUrl || null, 'idle', JSON.stringify(body.capabilities || []), JSON.stringify(body.technicalSkills || []), JSON.stringify(body.personalityTraits || []), body.systemPrompt || '', JSON.stringify(body.model || { primary: 'claude-3-opus', fallbacks: [] }), JSON.stringify({ tasksCompleted: 0, successRate: 0, avgResponseTime: 0 })]
    });
    
    const result = await client.execute({ sql: 'SELECT * FROM agents WHERE id = ?', args: [id] });
    const row = result.rows[0];
    
    return NextResponse.json({
      id: row.id, name: row.name, slug: row.slug, description: row.description,
      emoji: row.emoji, color: row.color, division: row.division,
      status: row.status,
      capabilities: JSON.parse(row.capabilities || '[]'),
      technicalSkills: JSON.parse(row.technical_skills || '[]'),
      systemPrompt: row.system_prompt,
      model: JSON.parse(row.model_config || '{"primary":"claude-3-opus"}'),
      metrics: JSON.parse(row.metrics || '{"tasksCompleted":0}'),
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create agent:', error);
    return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 });
  }
}
