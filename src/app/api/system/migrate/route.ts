export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { runMigrations } from '@/lib/db';

export async function POST() {
  try {
    runMigrations();
    return NextResponse.json({
      success: true,
      message: 'Migrations completed successfully'
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    runMigrations();
    return NextResponse.json({
      success: true,
      message: 'Migrations completed successfully'
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Migration failed' },
      { status: 500 }
    );
  }
}