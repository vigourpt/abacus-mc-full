export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  // No createClient, just test if NextResponse.json with array works
  return NextResponse.json({ items: [{a:1},{b:2}] });
}
