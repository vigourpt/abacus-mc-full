export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  // Test POST with text body instead of JSON
  let t1 = 'ok';
  try {
    const r = await fetch('https://httpbin.org/post', {
      method: 'POST',
      body: 'hello',
      signal: AbortSignal.timeout(5000),
    });
    t1 = `httpbin-text: ${r.status}`;
  } catch (e: any) { t1 = `error: ${e.message.substring(0, 80)}`; }
  
  return NextResponse.json({ t1 });
}
