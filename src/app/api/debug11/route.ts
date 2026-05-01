export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { generateId } from '@/lib/utils';

export async function GET() {
  // Test 1: require + https request
  let test1 = 'ok';
  try {
    const http = require('https');
    const data = JSON.stringify({ statements: ['SELECT * FROM agents LIMIT 3'] });
    const result = await new Promise((resolve) => {
      const req = http.request({
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
          catch (e) { resolve({ parseError: true, body: body.substring(0, 50) }); }
        });
      });
      req.on('error', (e: any) => resolve({ error: e.message }));
      req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
      req.write(data);
      req.end();
    });
    test1 = `https ok: ${JSON.stringify(result).substring(0, 100)}`;
  } catch (e: any) { test1 = `error: ${e.message}`; }
  
  // Test 2: Also use generateId to make sure utils works
  const test2 = generateId();
  
  return NextResponse.json({ test1, test2, utilsWorked: !!test2 });
}
