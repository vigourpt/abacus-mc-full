export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    // First, test if agents table even has rows
    const count = db.prepare('SELECT COUNT(*) as cnt FROM agents').get() as any;
    
    // Get raw rows using all()
    const rows = db.prepare('SELECT id, name FROM agents LIMIT 5').all();
    
    return NextResponse.json({
      countResult: count,
      countResultKeys: count ? Object.keys(count) : [],
      rowsType: typeof rows,
      rowsLength: Array.isArray(rows) ? rows.length : 'not array',
      firstRow: Array.isArray(rows) && rows.length > 0 ? rows[0] : 'none'
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, stack: e.stack?.substring(0, 500) });
  }
}
