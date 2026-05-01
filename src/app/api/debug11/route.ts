export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  // Test 1: fetch GET to github
  let t1 = 'ok';
  try {
    const r = await fetch('https://api.github.com/', { signal: AbortSignal.timeout(5000) });
    t1 = `github: ${r.status}`;
  } catch (e: any) { t1 = `error: ${e.message.substring(0, 80)}`; }
  
  // Test 2: fetch POST to a different HTTPS endpoint
  let t2 = 'ok';
  try {
    const r = await fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: 123 }),
      signal: AbortSignal.timeout(5000),
    });
    t2 = `httpbin-post: ${r.status}`;
  } catch (e: any) { t2 = `error: ${e.message.substring(0, 80)}`; }
  
  // Test 3: fetch to Turso without auth
  let t3 = 'ok';
  try {
    const r = await fetch('https://abacus-mc-vigourpt.aws-eu-west-1.turso.io', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statements: ['SELECT 1'] }),
      signal: AbortSignal.timeout(5000),
    });
    t3 = `turso-noauth: ${r.status}`;
  } catch (e: any) { t3 = `error: ${e.message.substring(0, 80)}`; }
  
  return NextResponse.json({ t1, t2, t3 });
}
