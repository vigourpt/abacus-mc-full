import { NextResponse } from 'next/server';

export async function GET() {
  // Async endpoint - no network, just return a value
  const result = await Promise.resolve('async_ok');
  return NextResponse.json({ ok: result });
}
