export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    // Test if db.prepare().get() is a Promise
    const result = db.prepare('SELECT * FROM agents LIMIT 1').get();
    
    return NextResponse.json({ 
      isPromise: result instanceof Promise,
      resultType: typeof result,
      isArray: Array.isArray(result),
      keys: result && typeof result === 'object' ? Object.keys(result).slice(0, 10) : [],
      resultString: JSON.stringify(result).substring(0, 300),
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
