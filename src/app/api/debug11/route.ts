export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  // Just test fetch to httpbin
  const r = await fetch('https://httpbin.org/get', { signal: AbortSignal.timeout(5000) });
  const d = await r.json();
  return NextResponse.json({ httpbin: d.url, status: r.status });
}
