export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const https = require('https');

export async function GET() {
  const data = JSON.stringify({ statements: ['SELECT * FROM agents LIMIT 3'] });
  
  const result = await new Promise((resolve) => {
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
      timeout: 10000,
    }, (res: any) => {
      let body = '';
      res.on('data', (chunk: any) => body += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { resolve({ parseError: true, body: body.substring(0, 100) }); }
      });
    });
    req.on('error', (e: any) => resolve({ error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.write(data);
    req.end();
  });
  
  return NextResponse.json({ success: true, result });
}
