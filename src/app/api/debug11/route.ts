export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

// Test if importing utils causes issues with require
import { generateId } from '@/lib/utils';

export async function GET() {
  const test1 = generateId ? `generateId loaded: ${typeof generateId}` : 'not loaded';
  
  let test2 = 'ok';
  try {
    const http = require('https');
    test2 = `https loaded: ${typeof http.request}`;
  } catch (e: any) { test2 = `error: ${e.message}`; }
  
  return NextResponse.json({ test1, test2 });
}
