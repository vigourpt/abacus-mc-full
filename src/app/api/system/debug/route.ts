export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  let wrapperResult = 'unknown';
  let wrapperError = '';
  try {
    const r = db.prepare('SELECT COUNT(*) as cnt FROM agents').get() as any;
    wrapperResult = `count: ${r?.cnt ?? 'undefined'}`;
  } catch (e: any) {
    wrapperError = e.message;
    wrapperResult = `error: ${e.message}`;
  }
  
  return NextResponse.json({
    wrapper: wrapperResult,
    wrapperError,
    env: {
      hasUrl: !!process.env.TURSO_DATABASE_URL,
      hasToken: !!process.env.TURSO_AUTH_TOKEN,
      urlHasAuth: (process.env.TURSO_DATABASE_URL || '').includes('authToken='),
      nodeEnv: process.env.NODE_ENV
    }
  });
}
