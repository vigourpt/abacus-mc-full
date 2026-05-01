export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    // Test simple query
    const count = db.prepare('SELECT COUNT(*) as count FROM agents').get() as any;
    
    // Test full query
    const agents = db.prepare('SELECT * FROM agents LIMIT 3').all() as any[];
    
    return NextResponse.json({ 
      count: count?.count ?? 'unknown',
      agentsCount: Array.isArray(agents) ? agents.length : `not array: ${typeof agents}`,
      firstAgent: agents[0] || 'none',
      agentType: Array.isArray(agents) ? 'array' : typeof agents,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
