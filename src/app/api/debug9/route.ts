export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  let test1 = 'ok';
  try {
    const r = db.prepare('SELECT 1 as n').get();
    test1 = `got: ${JSON.stringify(r)}`;
  } catch (e: any) {
    test1 = `error: ${e.message}`;
  }
  
  let test2 = 'ok';
  try {
    const r = db.prepare('SELECT * FROM agents LIMIT 3').all();
    test2 = `got ${r.length} rows`;
  } catch (e: any) {
    test2 = `error: ${e.message}`;
  }
  
  let test3 = 'ok';
  try {
    const r = db.prepare('SELECT COUNT(*) as cnt FROM agents').get();
    test3 = `got: ${JSON.stringify(r)}`;
  } catch (e: any) {
    test3 = `error: ${e.message}`;
  }
  
  return NextResponse.json({ test1, test2, test3 });
}
