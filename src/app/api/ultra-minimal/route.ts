export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const https = require('https');

export async function GET() {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'abacus-mc-vigourpt.aws-eu-west-1.turso.io',
      port: 443, path: '/', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzc1ODQzMDUsImlkIjoiMDE5ZGUwNDQtZTIwMS03MDIwLWE4M2MtZjc4OGVmNzdmYjc1IiwicmlkIjoiZGRmZjU0MzQtODI2Ni00YmY5LTgyYjYtMWYyNzM5MjljYmJiIn0.eOS1O1ZAt_w3LPQOs12kUU3HPC3FoOXutNWFN01gU1GhVo9eNDbu3HEUDSCTiVT1qm_mDlRc9jramm4dbT4VAA`,
        'Content-Length': 52,
      },
      timeout: 15000,
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve(NextResponse.json(JSON.parse(body))); }
        catch { resolve(NextResponse.json({ parseError: true })); }
      });
    });
    req.on('error', e => resolve(NextResponse.json({ error: e.message }, { status: 500 })));
    req.on('timeout', () => { req.destroy(); resolve(NextResponse.json({ error: 'timeout' }, { status: 500 })); });
    req.write('{"statements":["SELECT 1 as num"]}');
    req.end();
  });
}
