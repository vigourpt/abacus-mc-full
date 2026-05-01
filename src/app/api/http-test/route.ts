export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const https = require('https');

export async function GET() {
  const data = JSON.stringify({ statements: ['SELECT 1 as num'] });
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'abacus-mc-vigourpt.aws-eu-west-1.turso.io',
      port: 443, path: '/', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzc1ODQzMDUsImlkIjoiMDE5ZGUwNDQtZTIwMS03MDIwLWE4M2MtZjc4OGVmNzdmYjc1IiwicmlkIjoiZGRmZjU0MzQtODI2Ni00YmY5LTgyYjYtMWYyNzM5MjljYmJiIn0.eOS1O1ZAt_w3LPQOs12kUU3HPC3FoOXutNWFN01gU1GhVo9eNDbu3HEUDSCTiVT1qm_mDlRc9jramm4dbT4VAA`,
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 10000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(NextResponse.json({ success: true, data: parsed }));
        } catch (e) {
          resolve(NextResponse.json({ success: false, parseError: true, body: body.substring(0, 100) }, { status: 500 }));
        }
      });
    });
    req.on('error', (e) => resolve(NextResponse.json({ success: false, error: e.message }, { status: 500 })));
    req.on('timeout', () => { req.destroy(); resolve(NextResponse.json({ success: false, error: 'timeout' }, { status: 500 })); });
    req.write(data); req.end();
  });
}
