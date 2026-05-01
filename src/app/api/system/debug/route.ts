export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  // Test 1: Using the db wrapper (like the rest of the app uses it)
  let wrapperResult = 'not tested';
  let wrapperError = '';
  try {
    const r = db.prepare('SELECT COUNT(*) as cnt FROM agents').get() as any;
    wrapperResult = `count: ${r?.cnt ?? 'undefined'}`;
  } catch (e: any) {
    wrapperError = e.message;
    wrapperResult = `error: ${e.message.substring(0, 100)}`;
  }
  
  // Test 2: Direct libsql client creation
  let directResult = 'not tested';
  try {
    const { createClient } = await import('@libsql/client');
    const url = process.env.TURSO_DATABASE_URL || 'not set';
    const token = process.env.TURSO_AUTH_TOKEN || 'not set';
    const client = createClient({ 
      url,
      authToken: token || undefined
    });
    const r = await client.execute('SELECT COUNT(*) as cnt FROM agents');
    const cnt = r.rows[0]?.cnt ?? 'no rows';
    directResult = `connected, count: ${cnt}`;
  } catch (e: any) {
    directResult = `error: ${e.message.substring(0, 150)}`;
  }
  
  // Test 3: Check env directly
  const envCheck = {
    TURSO_DATABASE_URL: !!process.env.TURSO_DATABASE_URL,
    TURSO_AUTH_TOKEN: !!process.env.TURSO_AUTH_TOKEN,
    url_has_token: (process.env.TURSO_DATABASE_URL || '').includes('authToken=')
  };
  
  return NextResponse.json({
    wrapper: { result: wrapperResult, error: wrapperError },
    direct: { result: directResult },
    env: envCheck,
    nodeEnv: process.env.NODE_ENV
  });
}
