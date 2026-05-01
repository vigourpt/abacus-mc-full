export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

const https = require('https');

export async function GET() {
  const data = JSON.stringify({ statements: ['SELECT id, name FROM agents LIMIT 3'] });
  let errorDetail = '';
  let errorMessage = '';
  let statusCode = 200;
  
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'abacus-mc-vigourpt.aws-eu-west-1.turso.io',
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzc1ODQzMDUsImlkIjoiMDE5ZGUwNDQtZTIwMS03MDIwLWE4M2MtZjc4OGVmNzdmYjc1IiwicmlkIjoiZGRmZjU0MzQtODI2Ni00YmY5LTgyYjYtMWYyNzM5MjljYmJiIn0.eOS1O1ZAt_w3LPQOs12kUU3HPC3FoOXutNWFN01gU1GhVo9eNDbu3HEUDSCTiVT1qm_mDlRc9jramm4dbT4VAA`,
        'Content-Length': Buffer.byteLength(data),
      },
      timeout: 15000,
    }, (res: any) => {
      let body = '';
      res.on('data', (chunk: any) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed[0]?.error) {
            errorMessage = parsed[0].error;
            statusCode = 500;
          } else {
            resolve(NextResponse.json({ success: true, data: parsed }));
          }
        } catch (e: any) {
          errorDetail = body.substring(0, 200);
          errorMessage = e.message;
          statusCode = 500;
        }
        if (statusCode === 500) {
          resolve(NextResponse.json({ error: errorMessage, detail: errorDetail, statusCode }, { status: statusCode }));
        }
      });
    });
    req.on('error', (e: any) => {
      errorMessage = e.message;
      resolve(NextResponse.json({ error: errorMessage, type: 'network_error' }, { status: 500 }));
    });
    req.on('timeout', () => { req.destroy(); resolve(NextResponse.json({ error: 'timeout', type: 'timeout' }, { status: 500 })); });
    req.write(data);
    req.end();
  });
}
