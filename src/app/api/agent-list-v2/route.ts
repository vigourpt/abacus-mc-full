export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const https = require('https');

async function tursoQuery(sql: string): Promise<any> {
  const data = JSON.stringify({ statements: [sql] });
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'abacus-mc-vigourpt.aws-eu-west-1.turso.io',
      port: 443, path: '/', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzc1ODQzMDUsImlkIjoiMDE5ZGUwNDQtZTIwMS03MDIwLWE4M2MtZjc4OGVmNzdmYjc1IiwicmlkIjoiZGRmZjU0MzQtODI2Ni00YmY5LTgyYjYtMWYyNzM5MjljYmJiIn0.eOS1O1ZAt_w3LPQOs12kUU3HPC3FoOXutNWFN01gU1GhVo9eNDbu3HEUDSCTiVT1qm_mDlRc9jramm4dbT4VAA`, 'Content-Length': Buffer.byteLength(data) },
      timeout: 15000,
    }, (res) => { let b = ''; res.on('data', c => b += c); res.on('end', () => { try { resolve(JSON.parse(b)); } catch { resolve(null); } }); });
    req.on('error', reject); req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(data); req.end();
  });
}

export async function GET() {
  try {
    const result = await tursoQuery('SELECT * FROM agents ORDER BY division, name');
    const rows = result?.[0]?.results?.rows || [];
    const cols = result?.[0]?.results?.columns || [];
    const agents = rows.map((row: any[]) => {
      const obj: any = {}; cols.forEach((c: string, i: number) => { obj[c] = row[i]; });
      return { id: obj.id, name: obj.name, slug: obj.slug, description: obj.description, emoji: obj.emoji || '🤖', color: obj.color || 'blue', division: obj.division, specialization: obj.specialization || '', source: obj.source || 'local', status: obj.status || 'idle', capabilities: JSON.parse(obj.capabilities || '[]'), technicalSkills: JSON.parse(obj.technical_skills || '[]'), personalityTraits: JSON.parse(obj.personality_traits || '[]'), systemPrompt: obj.system_prompt || '', model: JSON.parse(obj.model_config || '{"primary":"claude-3-opus","fallbacks":[]}'), metrics: JSON.parse(obj.metrics || '{"tasksCompleted":0,"successRate":0,"avgResponseTime":0}') };
    });
    return NextResponse.json(agents);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
