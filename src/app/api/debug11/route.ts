export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import * as https from 'https';

export async function GET() {
  const result = await new Promise((resolve) => {
    const req = https.request({
      hostname: 'httpbin.org',
      port: 443,
      path: '/get',
      method: 'GET',
      timeout: 8000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: body.substring(0, 100) }));
    });
    req.on('error', (e) => resolve({ error: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.end();
  });
  
  return NextResponse.json(result);
}
