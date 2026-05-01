import { NextRequest, NextResponse } from 'next/server';
import * as https from 'https';
import { generateId, slugify } from '@/lib/utils';

function tursoQuery(sql: string, args?: any[]): Promise<any> {
  return new Promise((resolve, reject) => {
    const rawUrl = process.env.TURSO_DATABASE_URL || '';
    const tokenMatch = rawUrl.match(/authToken=([^&]+)/);
    const authToken = process.env.TURSO_AUTH_TOKEN || (tokenMatch ? tokenMatch[1] : '');
    
    const body = JSON.stringify({ statements: args ? [sql, args] : [sql] });
    const url = new URL('https://abacus-mc-vigourpt.aws-eu-west-1.turso.io');
    
    const options: https.RequestOptions = {
      hostname: url.hostname,
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 10000,
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && parsed[0]?.error) {
            reject(new Error(parsed[0].error));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error(`Invalid JSON: ${data.substring(0, 100)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
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
    
    await tursoQuery(
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
