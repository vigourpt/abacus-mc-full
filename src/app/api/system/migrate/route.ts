export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { runMigrations } from '@/lib/db';

export async function POST() {
  try {
    await runMigrations();
    return NextResponse.json({ success: true, message: 'Migrations completed' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function GET() {
  try {
    await runMigrations();
    return NextResponse.json({ success: true, message: 'Migrations completed' });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
