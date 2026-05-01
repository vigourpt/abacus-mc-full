export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Use dynamic import instead of require
    const https = await import('node:https');
    
    const data = JSON.stringify({ statements: ['SELECT 1 as num'] });
    return new Promise((resolve) => {
      const req = https.default.request({
        hostname: 'abacus-mc-vigourpt.aws-eu-west-1.turso.io',
        port: 443, path: '/', method: 'POST',
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
          try {
            const parsed = JSON.parse(body);
            resolve(NextResponse.json({ success: true, data: parsed }));
          } catch (e) {
            resolve(NextResponse.json({ success: false, parseError: true }, { status: 500 }));
          }
        });
      });
      req.on('error', (e: any) => resolve(NextResponse.json({ success: false, error: e.message }, { status: 500 })));
      req.on('timeout', () => { req.destroy(); resolve(NextResponse.json({ success: false, error: 'timeout' }, { status: 500 })); });
      req.write(data); req.end();
    });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
