export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    env: {
      url: (process.env.TURSO_DATABASE_URL || 'not set').substring(0, 50),
      token: process.env.TURSO_AUTH_TOKEN ? 'set' : 'not set',
      nodeEnv: process.env.NODE_ENV
    }
  });
}
