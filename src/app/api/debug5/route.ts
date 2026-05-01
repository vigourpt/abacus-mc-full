export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  // Test fetch to a common public API
  let step1 = 'ok';
  try {
    const resp = await fetch('https://httpbin.org/get', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    step1 = `httpbin: ${resp.status}`;
  } catch (e: any) {
    step1 = `error: ${e.message.substring(0, 80)}`;
  }
  
  // Test fetch to api.github.com
  let step2 = 'ok';
  try {
    const resp = await fetch('https://api.github.com/', {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    step2 = `github: ${resp.status}`;
  } catch (e: any) {
    step2 = `error: ${e.message.substring(0, 80)}`;
  }
  
  // Test fetch to Turso
  let step3 = 'ok';
  try {
    const resp = await fetch('https://abacus-mc-vigourpt.aws-eu-west-1.turso.io', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statements: ['SELECT 1'] }),
      signal: AbortSignal.timeout(5000),
    });
    step3 = `turso: ${resp.status}`;
  } catch (e: any) {
    step3 = `error: ${e.message.substring(0, 80)}`;
  }
  
  return NextResponse.json({ step1, step2, step3 });
}
