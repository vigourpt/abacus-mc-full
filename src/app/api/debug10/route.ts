export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import * as https from 'https';

export async function GET() {
  // Test POST to httpbin
  const postData = JSON.stringify({ statements: ['SELECT 1'] });
  
  const result = await new Promise((resolve) => {
    const req = https.request({
      hostname: 'httpbin.org',
      port: 443,
      path: '/post',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
      timeout: 8000,
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: body.substring(0, 200) }));
    });
    req.on('error', (e) => resolve({ error: e.message.substring(0, 100) }));
    req.on('timeout', () => { req.destroy(); resolve({ error: 'timeout' }); });
    req.write(postData);
    req.end();
  });
  
  return NextResponse.json({ result });
}
