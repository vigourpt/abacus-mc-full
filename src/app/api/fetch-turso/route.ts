export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  const data = JSON.stringify({ statements: ['SELECT 1 as num'] });
  
  try {
    const response = await fetch('https://abacus-mc-vigourpt.aws-eu-west-1.turso.io', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzc1ODQzMDUsImlkIjoiMDE5ZGUwNDQtZTIwMS03MDIwLWE4M2MtZjc4OGVmNzdmYjc1IiwicmlkIjoiZGRmZjU0MzQtODI2Ni00YmY5LTgyYjYtMWYyNzM5MjljYmJiIn0.eOS1O1ZAt_w3LPQOs12kUU3HPC3FoOXutNWFN01gU1GhVo9eNDbu3HEUDSCTiVT1qm_mDlRc9jramm4dbT4VAA`,
        'Content-Length': Buffer.byteLength(data),
      },
      body: data,
    });
    
    const text = await response.text();
    return NextResponse.json({ success: true, status: response.status, body: text.substring(0, 200) });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 });
  }
}
