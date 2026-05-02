export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

// Use dynamic import to avoid module-level require issues
const mod = await import('node:https');
const https = mod.default;

export async function GET() {
  const sql = 'SELECT id, name, slug, division, specialization, status FROM agents ORDER BY name';
  const body = JSON.stringify({ statements: [sql] });
  
  const result = await new Promise((resolve: any) => {
    const req = https.request({
      hostname: 'abacus-mc-vigourpt.aws-eu-west-1.turso.io',
      port: 443, path: '/', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzc1ODQzMDUsImlkIjoiMDE5ZGUwNDQtZTIwMS03MDIwLWE4M2MtZjc4OGVmNzdmYjc1IiwicmlkIjoiZGRmZjU0MzQtODI2Ni00YmY5LTgyYjYtMWYyNzM5MjljYmJiIn0.eOS1O1ZAt_w3LPQOs12kUU3HPC3FoOXutNWFN01gU1GhVo9eNDbu3HEUDSCTiVT1qm_mDlRc9jramm4dbT4VAA`,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 10000,
    }, (res: any) => {
      let data = '';
      res.on('data', (chunk: any) => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ parseError: true }); }
      });
    });
    req.on('error', (e: any) => resolve({ error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.write(body); req.end();
  });
  
  if ((result as any).error || (result as any).parseError) {
    return NextResponse.json(result, { status: 500 });
  }
  
  const rows = (result as any)?.[0]?.results?.rows || [];
  const cols = (result as any)?.[0]?.results?.columns || [];
  
  const agents = rows.map((row: any[]) => {
    const obj: any = {};
    cols.forEach((c: string, i: number) => { obj[c] = row[i]; });
    return {
      id: obj.id,
      name: obj.name,
      slug: obj.slug,
      division: obj.division || '',
      specialization: obj.specialization || '',
      status: obj.status || 'idle',
    };
  });
  
  return NextResponse.json(agents);
}
