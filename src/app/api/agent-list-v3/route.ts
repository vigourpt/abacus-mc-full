export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const https = require('https');

export async function GET() {
  const data = JSON.stringify({ statements: ['SELECT id, name, emoji, division, specialization FROM agents ORDER BY division, name'] });
  
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'abacus-mc-vigourpt.aws-eu-west-1.turso.io',
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzc1ODQzMDUsImlkIjoiMDE5ZGUwNDQtZTIwMS03MDIwLWE4M2MtZjc4OGVmNzdmYjc1IiwicmlkIjoiZGRmZjU0MzQtODI2Ni00YmY5LTgyYjYtMWYyNzM5MjljYmJiIn0.eOS1O1ZAt_w3LPQOs12kUU3HPC3FoOXutNWFN01gU1GhVo9eNDbu3HEUDSCTiVT1qm_mDlRc9jramm4dbT4VAA`,
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 15000,
    }, (res: any) => {
      let body = '';
      res.on('data', (chunk: any) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const rows = parsed[0]?.results?.rows || [];
          const cols = parsed[0]?.results?.columns || [];
          const agents = rows.map((row: any[]) => {
            const obj: any = {};
            cols.forEach((c: string, i: number) => { obj[c] = row[i]; });
            return { id: obj.id, name: obj.name, emoji: obj.emoji || '🤖', division: obj.division, specialization: obj.specialization || '' };
          });
          resolve(NextResponse.json(agents));
        } catch (e: any) {
          resolve(NextResponse.json({ error: e.message }, { status: 500 }));
        }
      });
    });
    req.on('error', (e: any) => resolve(NextResponse.json({ error: e.message }, { status: 500 })));
    req.on('timeout', () => { req.destroy(); resolve(NextResponse.json({ error: 'timeout' }, { status: 500 })); });
    req.write(data);
    req.end();
  });
}
