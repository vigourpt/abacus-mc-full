export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const https = require('https');

export async function GET() {
  const data = JSON.stringify({ name: 'test' });
  
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'httpbin.org',
      port: 443, path: '/post', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 10000,
    }, (res: any) => {
      let body = '';
      res.on('data', (chunk: any) => body += chunk);
      res.on('end', () => {
        try { resolve(NextResponse.json({ success: true, status: res.statusCode, body: JSON.parse(body) })); }
        catch (e) { resolve(NextResponse.json({ success: true, status: res.statusCode, body: body.substring(0, 100) })); }
      });
    });
    req.on('error', (e: any) => resolve(NextResponse.json({ success: false, error: e.message }, { status: 500 })));
    req.on('timeout', () => { req.destroy(); resolve(NextResponse.json({ success: false, error: 'timeout' }, { status: 500 })); });
    req.write(data); req.end();
  });
}
