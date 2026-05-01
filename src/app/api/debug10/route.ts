import { NextResponse } from 'next/server';

export async function GET() {
  // Test simplest possible fetch
  const resp = await fetch('https://httpbin.org/get', {
    signal: AbortSignal.timeout(5000),
  });
  const data = await resp.json();
  return NextResponse.json({ got: data.url });
}
