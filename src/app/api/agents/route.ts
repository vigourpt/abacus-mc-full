export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

function tursoUrlFromLibsql(url: string) {
  return url.replace(/^libsql:\/\//, 'https://').split('?')[0];
}

export async function GET() {
  try {
    const rawUrl = process.env.TURSO_DATABASE_URL || '';
    const tokenMatch = rawUrl.match(/authToken=([^&]+)/);
    const authToken = process.env.TURSO_AUTH_TOKEN || (tokenMatch ? tokenMatch[1] : '');
    const httpsUrl = tursoUrlFromLibsql(rawUrl);

    const client = createClient({ url: httpsUrl, authToken });
    const result = await client.execute('SELECT id, name, emoji, division FROM agents LIMIT 5');
    
    const agents = result.rows.map(row => {
      const obj: any = {};
      result.columns.forEach((col, idx) => { obj[col] = row[idx]; });
      return obj;
    });

    return NextResponse.json(agents);
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
