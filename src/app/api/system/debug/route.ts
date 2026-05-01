export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  const hasTursoUrl = !!process.env.TURSO_DATABASE_URL;
  const hasTursoToken = !!process.env.TURSO_AUTH_TOKEN;
  const tursoUrl = process.env.TURSO_DATABASE_URL || 'not set';
  
  // Try to create client directly
  let tursoStatus = 'not tested';
  let tableCount = -1;
  
  if (hasTursoUrl && hasTursoToken) {
    try {
      const { createClient } = await import('@libsql/client');
      const client = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
      });
      const r = await client.execute('SELECT COUNT(*) as cnt FROM agents');
      tableCount = r.rows[0].cnt as number;
      tursoStatus = 'connected';
    } catch (e: any) {
      tursoStatus = `error: ${e.message}`;
    }
  } else {
    tursoStatus = `missing creds - url:${hasTursoUrl} token:${hasTursoToken}`;
  }
  
  return NextResponse.json({
    env: {
      tursoUrlSet: hasTursoUrl,
      tursoTokenSet: hasTursoToken,
      tursoUrlPreview: tursoUrl.substring(0, 50) + '...',
      nodeEnv: process.env.NODE_ENV
    },
    tursoStatus,
    tableCount
  });
}
