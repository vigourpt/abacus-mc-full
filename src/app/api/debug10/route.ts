import { NextResponse } from 'next/server';

export async function GET() {
  // Test 1: httpbin POST (worked before as GET)
  let t1 = 'ok';
  try {
    const r = await fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 'data' }),
      signal: AbortSignal.timeout(5000),
    });
    t1 = `httpbin-post: ${r.status}`;
  } catch (e: any) { t1 = `error: ${e.message}`; }
  
  // Test 2: Turso POST (fails)
  let t2 = 'ok';
  try {
    const r = await fetch('https://abacus-mc-vigourpt.aws-eu-west-1.turso.io', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statements: ['SELECT 1'] }),
      signal: AbortSignal.timeout(5000),
    });
    t2 = `turso: ${r.status}`;
  } catch (e: any) { t2 = `error: ${e.message}`; }
  
  // Test 3: Turso with Authorization header
  let t3 = 'ok';
  try {
    const r = await fetch('https://abacus-mc-vigourpt.aws-eu-west-1.turso.io', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer eyJhbGciOiJFZERTQSJ9.eyJhIjoicnciLCJpYXQiOjE3Nzc1ODQzMDUsImlkIjoiMDE5ZGUwNDQtZTIwMS03MDIwLWE4M2MtZjc4OGVmNzdmYjc1In0.signature'
      },
      body: JSON.stringify({ statements: ['SELECT 1'] }),
      signal: AbortSignal.timeout(5000),
    });
    t3 = `turso+auth: ${r.status}`;
  } catch (e: any) { t3 = `error: ${e.message}`; }
  
  return NextResponse.json({ t1, t2, t3 });
}
