export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  // Simpler test - just env vars and basic node info
  return NextResponse.json({
    env: {
      hasUrl: !!process.env.TURSO_DATABASE_URL,
      hasToken: !!process.env.TURSO_AUTH_TOKEN,
      nodeEnv: process.env.NODE_ENV,
      urlContainsAuth: (process.env.TURSO_DATABASE_URL || '').includes('authToken=')
    },
    node: {
      version: process.version,
      platform: process.platform
    },
    timestamp: new Date().toISOString()
  });
}
