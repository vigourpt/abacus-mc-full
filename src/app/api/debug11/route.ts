export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.TURSO_DATABASE_URL || 'NOT SET';
  return NextResponse.json({
    url: url.substring(0, 80),
    hasUrl: !!process.env.TURSO_DATABASE_URL,
    nodeEnv: process.env.NODE_ENV,
  });
}
