export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ test: 'robot-list works', ts: new Date().toISOString() });
}
