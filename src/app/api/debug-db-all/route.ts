export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    // Test raw query via db.exec
    const result = db.prepare('SELECT * FROM agents LIMIT 3').all() as any;
    
    return NextResponse.json({ 
      type: Array.isArray(result) ? 'array' : typeof result,
      keys: result ? Object.keys(result).slice(0, 10) : [],
      hasRows: result?.rows ? true : false,
      rowsType: result?.rows ? typeof result.rows : 'none',
      rowsLength: Array.isArray(result?.rows) ? result.rows.length : 'not array',
      resultString: JSON.stringify(result).substring(0, 200),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
