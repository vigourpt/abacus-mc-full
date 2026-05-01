export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  const TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzc1ODQzMDUsImlkIjoiMDE5ZGUwNDQtZTIwMS03MDIwLWE4M2MtZjc4OGVmNzdmYjc1IiwicmlkIjoiZGRmZjU0MzQtODI2Ni00YmY5LTgyYjYtMWYyNzM5MjljYmJiIn0.eOS1O1ZAt_w3LPQOs12kUU3HPC3FoOXutNWFN01gU1GhVo9eNDbu3HEUDSCTiVT1qm_mDlRc9jramm4dbT4VAA';
  
  // Try with http (not https) - libsql uses http protocol
  let step1 = 'ok';
  try {
    // Using Node's native http module instead of fetch
    const result = await new Promise((resolve, reject) => {
      const https = require('https');
      const data = JSON.stringify({ statements: ['SELECT 1 as n'] });
      const url = new URL('https://abacus-mc-vigourpt.aws-eu-west-1.turso.io');
      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${TOKEN}`,
          'Content-Length': Buffer.byteLength(data),
        },
        signal: undefined, // no AbortSignal for http module
      };
      const req = https.request(options, (res: any) => {
        let body = '';
        res.on('data', (chunk: any) => body += chunk);
        res.on('end', () => resolve({ status: res.statusCode, body }));
        res.on('error', reject);
      });
      req.on('error', reject);
      req.setTimeout(5000, () => { req.destroy(); reject(new Error('timeout')); });
      req.write(data);
      req.end();
    });
    step1 = `https ok: ${JSON.stringify(result).substring(0, 100)}`;
  } catch (e: any) {
    step1 = `https error: ${e.message.substring(0, 80)}`;
  }
  
  return NextResponse.json({ step1 });
}
