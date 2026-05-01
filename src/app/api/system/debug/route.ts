export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.TURSO_DATABASE_URL || '';
  const token = process.env.TURSO_AUTH_TOKEN || '';
  const tokenInUrl = url.includes('authToken=');
  
  // Test 1: libsql:// URL with fetch (expected to fail)
  let test1 = 'not tested';
  if (url) {
    try {
      const resp = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(3000) });
      test1 = `libsql fetch ok: ${resp.status}`;
    } catch (e: any) {
      test1 = `libsql fetch error: ${e.message.substring(0, 80)}`;
    }
  }
  
  // Test 2: HTTPS conversion
  let test2 = 'not tested';
  const httpsUrl = url.replace(/^libsql:\/\//, 'https://').split('?')[0];
  if (httpsUrl) {
    try {
      const resp = await fetch(httpsUrl, { method: 'GET', signal: AbortSignal.timeout(3000) });
      test2 = `https fetch ok: ${resp.status}`;
    } catch (e: any) {
      test2 = `https fetch error: ${e.message.substring(0, 80)}`;
    }
  }
  
  return NextResponse.json({
    urlPrefix: url.substring(0, 50),
    hasToken: !!token,
    tokenInUrl,
    libsqlFetch: test1,
    httpsFetch: test2,
    nodeEnv: process.env.NODE_ENV,
  });
}
