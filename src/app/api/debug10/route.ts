// Simplest possible endpoint - no imports, no async, just sync response
import { NextResponse } from 'next/server';

export function GET() {
  return new NextResponse('hello', { status: 200 });
}
