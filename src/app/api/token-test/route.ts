export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const https = require('https');

export async function GET() {
  // First, test with httpbin to see if the token header is sent correctly
  const data = JSON.stringify({ token: 'test' });
  const token = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzc1ODQzMDUsImlkIjoiMDE5ZGUwNDQtZTIwMS03MDIwLWE4M2MtZjc4OGVmNzdmYjc1IiwicmlkIjoiZGRmZjU0MzQtODI2Ni00YmY5LTgyYjYtMWYyNzM5MjljYmJiIn0.eOS1O1ZAt_w3LPQOs12kUU3HPC3FoOXutNWFN01gU1GhVo9eNDbu3HEUDSCTiVT1qm_mDlRc9jramm4dbT4VAA';
  
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'httpbin.org',
      port: 443, path: '/post', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 10000,
    }, (res: any) => {
      let body = '';
      res.on('data', (chunk: any) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(NextResponse.json({ 
            success: true, 
            status: res.statusCode, 
            receivedToken: parsed.headers.Authorization || 'missing',
            tokenMatches: parsed.headers.Authorization === `Bearer ${token}`
          }));
        } catch (e) {
          resolve(NextResponse.json({ success: false, parseError: true }));
        }
      });
    });
    req.on('error', (e: any) => resolve(NextResponse.json({ success: false, error: e.message }, { status: 500 })));
    req.on('timeout', () => { req.destroy(); resolve(NextResponse.json({ success: false, error: 'timeout' }, { status: 500 })); });
    req.write(data); req.end();
  });
}
