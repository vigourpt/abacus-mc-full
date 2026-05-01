export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    // Test if agents table exists
    try {
      const result = db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
      return NextResponse.json({
        success: true,
        debug: {
          agentsTableExists: true,
          agentsCount: result.count,
          dbUrl: process.env.TURSO_DATABASE_URL ? 'set' : 'not set'
        }
      });
    } catch (e) {
      return NextResponse.json({
        success: false,
        debug: {
          agentsTableExists: false,
          error: (e as Error).message
        }
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
