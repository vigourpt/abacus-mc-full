export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

function tursoUrlFromLibsql(libsqlUrl: string): string {
  if (!libsqlUrl) return '';
  return libsqlUrl.replace(/^libsql:\/\//, 'https://').split('?')[0];
}

export async function GET() {
  const rawUrl = process.env.TURSO_DATABASE_URL || '';
  const token = process.env.TURSO_AUTH_TOKEN || '';
  
  // Extract token from URL if embedded
  const tokenMatch = rawUrl.match(/authToken=([^&]+)/);
  const authToken = token || (tokenMatch ? tokenMatch[1] : '');
  const httpsUrl = tursoUrlFromLibsql(rawUrl);
  
  let queryResult = 'not tested';
  if (httpsUrl) {
    try {
      const resp = await fetch(httpsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ statements: ['SELECT COUNT(*) as cnt FROM agents'] }),
        signal: AbortSignal.timeout(8000),
      });
      const data = await resp.json();
      const rows = data[0]?.results?.rows || [];
      queryResult = `ok: ${JSON.stringify(rows)}`;
    } catch (e: any) {
      queryResult = `error: ${e.message}`;
    }
  }
  
  return NextResponse.json({
    rawUrlPrefix: rawUrl.substring(0, 50),
    httpsUrl,
    hasToken: !!token,
    authTokenPrefix: authToken.substring(0, 20),
    queryResult,
    nodeEnv: process.env.NODE_ENV,
  });
}
