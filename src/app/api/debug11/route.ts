export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

function tursoUrlFromLibsql(url: string) {
  return url.replace(/^libsql:\/\//, 'https://').split('?')[0];
}

export async function GET() {
  const rawUrl = process.env.TURSO_DATABASE_URL || '';
  const httpsUrl = tursoUrlFromLibsql(rawUrl);
  const tokenMatch = rawUrl.match(/authToken=([^&]+)/);
  const authToken = process.env.TURSO_AUTH_TOKEN || (tokenMatch ? tokenMatch[1] : '');
  
  let createResult = 'not tested';
  let queryResult = 'not tested';
  
  if (httpsUrl) {
    try {
      const client = createClient({ url: httpsUrl, authToken });
      createResult = 'created';
      const r = await client.execute('SELECT id, name, emoji FROM agents LIMIT 3');
      queryResult = `ok: ${r.rows.length} rows, cols: ${r.columns.join(',')}`;
    } catch (e: any) {
      createResult = `error: ${e.message.substring(0, 100)}`;
    }
  } else {
    createResult = 'no url';
  }
  
  return NextResponse.json({
    rawUrlPrefix: rawUrl.substring(0, 50),
    httpsUrl: httpsUrl.substring(0, 50),
    hasEnvToken: !!process.env.TURSO_AUTH_TOKEN,
    tokenFromUrl: !!tokenMatch,
    createResult,
    queryResult,
  });
}
