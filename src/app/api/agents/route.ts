export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import * as https from 'https';
import { generateId, slugify } from '@/lib/utils';

function tursoFetch(sql: string, args?: any[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const rawUrl = process.env.TURSO_DATABASE_URL || '';
    const tokenMatch = rawUrl.match(/authToken=([^&]+)/);
    const authToken = process.env.TURSO_AUTH_TOKEN || (tokenMatch ? tokenMatch[1] : '');
    const body = JSON.stringify({ statements: args ? [sql, args] : [sql] });
    
    const req = https.request({
      hostname: 'abacus-mc-vigourpt.aws-eu-west-1.turso.io',
      port: 443,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (Array.isArray(parsed) && parsed[0]?.error) reject(new Error(parsed[0].error));
          else resolve(parsed[0]?.results?.rows || []);
        } catch (e) { reject(new Error(`Parse error: ${data.substring(0, 100)}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    req.write(body);
    req.end();
  });
}

export async function GET() {
  try {
    const rows: any[] = await tursoFetch('SELECT * FROM agents ORDER BY division, name');
    const cols = rows.length > 0 ? Object.keys(rows[0]) : ['id', 'name', 'slug', 'description', 'emoji', 'color', 'division', 'specialization', 'source', 'status', 'capabilities', 'technical_skills', 'personality_traits', 'system_prompt', 'model_config', 'metrics'];
    
    // Actually rows is already parsed, but tursoFetch returns parsed[0].results.rows
    // Let me check the actual response format
    return NextResponse.json({ debug: true, rowsCount: rows.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
