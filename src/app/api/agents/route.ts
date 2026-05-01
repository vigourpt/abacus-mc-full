export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

function tursoUrlFromLibsql(url: string) {
  return url.replace(/^libsql:\/\//, 'https://').split('?')[0];
}

export async function GET() {
  try {
    const rawUrl = process.env.TURSO_DATABASE_URL || '';
    const tokenMatch = rawUrl.match(/authToken=([^&]+)/);
    const authToken = process.env.TURSO_AUTH_TOKEN || (tokenMatch ? tokenMatch[1] : '');
    const httpsUrl = tursoUrlFromLibsql(rawUrl);

    const client = createClient({ url: httpsUrl, authToken });
    const result = await client.execute('SELECT * FROM agents ORDER BY division, name');
    
    const agents = result.rows.map(row => {
      const obj: any = {};
      result.columns.forEach((col, idx) => { obj[col] = row[idx]; });
      return {
        id: obj.id,
        name: obj.name,
        slug: obj.slug,
        description: obj.description,
        emoji: obj.emoji || '🤖',
        color: obj.color || 'blue',
        division: obj.division,
        specialization: obj.specialization,
        source: obj.source || 'local',
        status: obj.status || 'idle',
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
    const rawUrl = process.env.TURSO_DATABASE_URL || '';
    const tokenMatch = rawUrl.match(/authToken=([^&]+)/);
    const authToken = process.env.TURSO_AUTH_TOKEN || (tokenMatch ? tokenMatch[1] : '');
    const httpsUrl = tursoUrlFromLibsql(rawUrl);

    const { generateId, slugify } = await import('@/lib/utils');
    const id = generateId();
    const slug = slugify(body.name);
    
    const client = createClient({ url: httpsUrl, authToken });
    
    await client.execute({
      sql: `INSERT INTO agents (id, name, slug, description, emoji, color, division, specialization, source, status, capabilities, technical_skills, personality_traits, system_prompt, model_config, metrics) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [id, body.name, slug, body.description || '', body.emoji || '🤖', body.color || 'blue', body.division || 'engineering', body.specialization || '', body.source || 'local', 'idle', JSON.stringify(body.capabilities || []), JSON.stringify(body.technicalSkills || []), JSON.stringify(body.personalityTraits || []), body.systemPrompt || '', JSON.stringify({ primary: 'claude-3-opus', fallbacks: [] }), JSON.stringify({ tasksCompleted: 0, successRate: 0, avgResponseTime: 0 })]
    });
    
    const result = await client.execute({ sql: 'SELECT * FROM agents WHERE id = ?', args: [id] });
    const row = result.rows[0];
    if (!row) return NextResponse.json({ error: 'Agent not found after insert' }, { status: 500 });
    
    const obj: any = {};
    result.columns.forEach((col, idx) => { obj[col] = row[idx]; });
    
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
