export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const https = require('https');

// Just try to make a GET request to Turso (no POST, no SQL)
export async function GET() {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'abacus-mc-vigourpt.aws-eu-west-1.turso.io',
      port: 443, path: '/', method: 'GET',
      timeout: 10000,
    }, (res: any) => {
      let body = '';
      res.on('data', (chunk: any) => body += chunk);
      res.on('end', () => {
        resolve(NextResponse.json({ success: true, status: res.statusCode, body: body.substring(0, 200) }));
      });
    });
    req.on('error', (e: any) => resolve(NextResponse.json({ success: false, error: e.message }, { status: 500 })));
    req.on('timeout', () => { req.destroy(); resolve(NextResponse.json({ success: false, error: 'timeout' }, { status: 500 })); });
    req.end();
  });
}
