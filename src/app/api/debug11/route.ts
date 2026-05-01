export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  // Test 1: fetch POST to httpbin without body
  let t1 = 'ok';
  try {
    const r = await fetch('https://httpbin.org/post', {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    });
    t1 = `httpbin-post-no-body: ${r.status}`;
  } catch (e: any) { t1 = `error: ${e.message.substring(0, 80)}`; }
  
  // Test 2: fetch POST to httpbin with empty body
  let t2 = 'ok';
  try {
    const r = await fetch('https://httpbin.org/post', {
      method: 'POST',
      headers: { 'Content-Length': '0' },
      signal: AbortSignal.timeout(5000),
    });
    t2 = `httpbin-post-empty: ${r.status}`;
  } catch (e: any) { t2 = `error: ${e.message.substring(0, 80)}`; }
  
  // Test 3: fetch POST to Turso with empty body
  let t3 = 'ok';
  try {
    const r = await fetch('https://abacus-mc-vigourpt.aws-eu-west-1.turso.io', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer test' },
      body: '',
      signal: AbortSignal.timeout(5000),
    });
    t3 = `turso-empty-body: ${r.status}`;
  } catch (e: any) { t3 = `error: ${e.message.substring(0, 80)}`; }
  
  return NextResponse.json({ t1, t2, t3 });
}
