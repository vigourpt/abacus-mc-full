export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

export async function GET() {
  try {
    const rawUrl = process.env.TURSO_DATABASE_URL || '';
    const tokenMatch = rawUrl.match(/authToken=([^&]+)/);
    const authToken = process.env.TURSO_AUTH_TOKEN || (tokenMatch ? tokenMatch[1] : '');
    const httpsUrl = rawUrl.replace(/^libsql:\/\//, 'https://').split('?')[0];

    const client = createClient({ url: httpsUrl, authToken });
    const result = await client.execute('SELECT id, name FROM agents LIMIT 3');
    
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Failed:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
