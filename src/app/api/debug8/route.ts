export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.TURSO_DATABASE_URL || '';
  return NextResponse.json({
    urlPrefix: url.substring(0, 60),
    hasUrl: !!url,
    urlScheme: url.split('://')[0],
    NODE_ENV: process.env.NODE_ENV,
    NEXT_PUBLIC_COUNT: Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC')).length,
  });
}
