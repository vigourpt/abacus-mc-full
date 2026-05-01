export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  const http = require('https');
  const body = JSON.stringify({ statements: ['SELECT * FROM agents LIMIT 3'] });
  
  const result = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'abacus-mc-vigourpt.aws-eu-west-1.turso.io',
      port: 443,
      path: '/',
      method: 'POST',
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
        catch (e) { resolve({ parseError: data.substring(0, 100) }); }
      });
    });
    req.on('error', (e: any) => resolve({ error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.write(body);
    req.end();
  });
  
  return NextResponse.json(result);
}
