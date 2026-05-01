export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

export async function GET() {
  // Just create the client, don't execute
  const rawUrl = process.env.TURSO_DATABASE_URL || '';
  const httpsUrl = rawUrl.replace(/^libsql:\/\//, 'https://').split('?')[0];
  const tokenMatch = rawUrl.match(/authToken=([^&]+)/);
  const authToken = process.env.TURSO_AUTH_TOKEN || (tokenMatch ? tokenMatch[1] : '');
  
  const client = createClient({ url: httpsUrl, authToken });
  
  return NextResponse.json({ ok: true, clientCreated: true });
}
