export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test if agents table exists - check what happens with different queries
    const results: any = {};
    
    // Test 1: Try a raw query to see Turso connection
    try {
      const { createClient } = await import('@libsql/client');
      const client = createClient({
        url: process.env.TURSO_DATABASE_URL || '',
        authToken: process.env.TURSO_AUTH_TOKEN || undefined
      });
      const r = await client.execute('SELECT 1 as test');
      results.tursoConnection = 'ok';
      results.tursoRows = r.rows;
    } catch (e: any) {
      results.tursoConnection = 'failed';
      results.tursoError = e.message;
    }
    
    // Test 2: Check tables in sqlite_master
    try {
      const { createClient } = await import('@libsql/client');
      const client = createClient({
        url: process.env.TURSO_DATABASE_URL || '',
        authToken: process.env.TURSO_AUTH_TOKEN || undefined
      });
      const r = await client.execute("SELECT name FROM sqlite_master WHERE type='table'");
      results.tables = r.rows;
    } catch (e: any) {
      results.tablesError = e.message;
    }
    
    return NextResponse.json({
      success: true,
      results,
      env: {
        tursoUrlSet: !!process.env.TURSO_DATABASE_URL,
        tursoTokenSet: !!process.env.TURSO_AUTH_TOKEN
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
