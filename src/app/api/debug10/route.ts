import { NextResponse } from 'next/server';

export async function GET() {
  // Test 1: httpbin GET (worked before)
  let t1 = 'ok';
  try {
    const r = await fetch('https://httpbin.org/get', { signal: AbortSignal.timeout(5000) });
    t1 = `httpbin-get: ${r.status}`;
  } catch (e: any) { t1 = `error: ${e.message}`; }
  
  // Test 2: Turso direct
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
  
  // Test 3: Different HTTPS endpoint
  let t3 = 'ok';
  try {
    const r = await fetch('https://api.github.com/', { signal: AbortSignal.timeout(5000) });
    t3 = `github: ${r.status}`;
  } catch (e: any) { t3 = `error: ${e.message}`; }
  
  // Test 4: Another HTTPS endpoint
  let t4 = 'ok';
  try {
    const r = await fetch('https://cloudflare.com/', { signal: AbortSignal.timeout(5000) });
    t4 = `cloudflare: ${r.status}`;
  } catch (e: any) { t4 = `error: ${e.message}`; }
  
  return NextResponse.json({ t1, t2, t3, t4 });
}
