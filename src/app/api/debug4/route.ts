export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  const TOKEN = 'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzc1ODQzMDUsImlkIjoiMDE5ZGUwNDQtZTIwMS03MDIwLWE4M2MtZjc4OGVmNzdmYjc1IiwicmlkIjoiZGRmZjU0MzQtODI2Ni00YmY5LTgyYjYtMWYyNzM5MjljYmJiIn0.eOS1O1ZAt_w3LPQOs12kUU3HPC3FoOXutNWFN01gU1GhVo9eNDbu3HEUDSCTiVT1qm_mDlRc9jramm4dbT4VAA';
  
  let step1 = 'ok';
  let step2 = 'ok';
  
  try {
    const resp = await fetch('https://abacus-mc-vigourpt.aws-eu-west-1.turso.io', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
      body: JSON.stringify({ statements: ['SELECT 1'] }),
      signal: AbortSignal.timeout(5000),
    });
    step1 = `status: ${resp.status}`;
    const data = await resp.json();
    step2 = `got: ${JSON.stringify(data).substring(0, 100)}`;
  } catch (e: any) {
    step1 = `error: ${e.message.substring(0, 80)}`;
  }
  
  return NextResponse.json({ step1, step2 });
}
