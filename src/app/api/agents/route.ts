export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { generateId, slugify } from '@/lib/utils';

const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';

async function tursoQuery(sql: string, args?: any[]) {
  const body: any = { statements: args ? [sql, ...args] : [sql] };
  const resp = await fetch(TURSO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TURSO_TOKEN}` },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`Turso error: ${resp.status}`);
  const data = await resp.json();
  if (Array.isArray(data) && data[0]?.error) throw new Error(data[0].error);
  return data;
}

export async function GET() {
  try {
    const data = await tursoQuery('SELECT * FROM agents ORDER BY division, name');
    const rows = data[0]?.results?.rows || [];
    const cols = data[0]?.results?.columns || [];
    
    const agents = rows.map((row: any[]) => {
      const obj: any = {};
      cols.forEach((c: string, i: number) => { obj[c] = row[i]; });
      return {
        id: obj.id, name: obj.name, slug: obj.slug, description: obj.description,
        emoji: obj.emoji || '🤖', color: obj.color || 'blue', division: obj.division,
        specialization: obj.specialization,
        source: obj.source || 'local', status: obj.status || 'idle',
        capabilities: JSON.parse(obj.capabilities || '[]'),
        technicalSkills: JSON.parse(obj.technical_skills || '[]'),
        personalityTraits: JSON.parse(obj.personality_traits || '[]'),
        systemPrompt: obj.system_prompt || '',
        model: JSON.parse(obj.model_config || '{"primary":"claude-3-opus","fallbacks":[]}'),
        metrics: JSON.parse(obj.metrics || '{"tasksCompleted":0,"successRate":0,"avgResponseTime":0}'),
      };
    });
    return NextResponse.json(agents);
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const id = generateId();
    const slug = slugify(body.name);
    
    const insertData = await tursoQuery(
      `INSERT INTO agents (id, name, slug, description, emoji, color, division, specialization, source, status, capabilities, technical_skills, personality_traits, system_prompt, model_config, metrics) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, body.name, slug, body.description || '', body.emoji || '🤖', body.color || 'blue', body.division || 'engineering', body.specialization || '', body.source || 'local', 'idle', JSON.stringify(body.capabilities || []), JSON.stringify(body.technicalSkills || []), JSON.stringify(body.personalityTraits || []), body.systemPrompt || '', JSON.stringify({ primary: 'claude-3-opus', fallbacks: [] }), JSON.stringify({ tasksCompleted: 0, successRate: 0, avgResponseTime: 0 })]
    );
    
    const getData = await tursoQuery('SELECT * FROM agents WHERE id = ?', [id]);
    const row = getData[0]?.results?.rows?.[0];
    const cols = getData[0]?.results?.columns || [];
    
    if (!row) return NextResponse.json({ error: 'Agent not found after insert' }, { status: 500 });
    
    const obj: any = {};
    cols.forEach((c: string, i: number) => { obj[c] = row[i]; });
    
    return NextResponse.json({
      id: obj.id, name: obj.name, slug: obj.slug, description: obj.description,
      emoji: obj.emoji, color: obj.color, division: obj.division,
      status: obj.status,
      capabilities: JSON.parse(obj.capabilities || '[]'),
      systemPrompt: obj.system_prompt,
    }, { status: 201 });
  } catch (error) {
    console.error('Failed to create agent:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
