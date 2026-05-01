export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

export async function GET() {
  const url = process.env.TURSO_DATABASE_URL || 'not set';
  
  let createResult = 'not tested';
  let authResult = 'not tested';
  
  if (url !== 'not set') {
    try {
      // Test 1: Create client with URL-embedded token
      const client = createClient({ url, authToken: undefined });
      createResult = 'client created';
      
      // Test 2: Execute a simple query
      const r = await client.execute('SELECT 1 as test');
      authResult = `query ok: ${JSON.stringify(r.rows)}`;
    } catch (e: any) {
      createResult = `error: ${e.message.substring(0, 100)}`;
      authResult = `error: ${e.message.substring(0, 100)}`;
    }
  } else {
    createResult = 'url not set';
  }
  
  return NextResponse.json({
    createResult,
    authResult,
    urlPreview: url.substring(0, 60)
  });
}
