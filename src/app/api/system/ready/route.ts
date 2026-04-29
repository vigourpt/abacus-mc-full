export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * Readiness probe - lightweight check for container orchestration
 * Returns 200 if the app can serve requests, 503 otherwise
 */
export async function GET() {
  try {
    // Quick database connectivity check
    db.prepare('SELECT 1').get();

    return NextResponse.json({ ready: true }, { status: 200 });
  } catch {
    return NextResponse.json({ ready: false }, { status: 503 });
  }
}
