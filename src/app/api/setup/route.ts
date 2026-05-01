export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { createClient } from '@libsql/client';

const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || undefined;

const DEMO_AGENTS = [
  { name: 'Jarvis', division: 'executive', emoji: '🤖', specialization: 'Operations & AI Systems', caps: ['system-integration', 'automation', 'coordination'] },
  { name: 'Thor', division: 'engineering', emoji: '🔧', specialization: 'Infrastructure & DevOps', caps: ['docker', 'networking', 'monitoring'] },
  { name: 'DataBot', division: 'engineering', emoji: '🤖', specialization: 'Data Analysis', caps: ['analytics', 'python', 'machine-learning'] },
  { name: 'MarketBot', division: 'marketing', emoji: '📈', specialization: 'Growth Marketing', caps: ['seo', 'content', 'social-media'] },
  { name: 'SalesBot', division: 'sales', emoji: '💰', specialization: 'Lead Generation', caps: ['outreach', 'crm', 'closing'] },
  { name: 'DesignBot', division: 'design', emoji: '🎨', specialization: 'UI/UX Design', caps: ['figma', 'branding', 'prototyping'] },
  { name: 'DevOps Bot', division: 'operations', emoji: '⚙️', specialization: 'CI/CD & Deployment', caps: ['github-actions', 'docker', 'kubernetes'] },
  { name: 'ContentBot', division: 'marketing', emoji: '✍️', specialization: 'Content Creation', caps: ['writing', 'seo', 'copywriting'] },
  { name: 'SupportBot', division: 'support', emoji: '💬', specialization: 'Customer Support', caps: ['tickets', 'chat', 'faq'] },
  { name: 'AnalystBot', division: 'product', emoji: '📊', specialization: 'Product Analytics', caps: ['metrics', 'user-research', 'a-b-testing'] },
  { name: 'CopyBot', division: 'marketing', emoji: '✍️', specialization: 'Copywriting & Ads', caps: ['google-ads', 'facebook-ads', 'copywriting'] },
  { name: 'CodeBot', division: 'engineering', emoji: '💻', specialization: 'Full-Stack Development', caps: ['react', 'nodejs', 'python'] },
];

export async function POST() {
  try {
    const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
    
    const migrations = [
      `CREATE TABLE IF NOT EXISTS agents (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT NOT NULL, emoji TEXT DEFAULT '🤖', color TEXT DEFAULT 'blue', division TEXT NOT NULL, specialization TEXT, source TEXT DEFAULT 'local', status TEXT DEFAULT 'idle', capabilities TEXT DEFAULT '[]', technical_skills TEXT DEFAULT '[]', personality_traits TEXT DEFAULT '[]', system_prompt TEXT NOT NULL, model_config TEXT DEFAULT '{"primary":"claude-3-opus","fallbacks":[]}', metrics TEXT DEFAULT '{"tasksCompleted":0,"successRate":0,"avgResponseTime":0}')`,
      `CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, status TEXT DEFAULT 'inbox', priority TEXT DEFAULT 'medium')`,
      `CREATE TABLE IF NOT EXISTS gateway_connections (id TEXT PRIMARY KEY, host TEXT NOT NULL, port INTEGER NOT NULL, status TEXT DEFAULT 'disconnected')`,
    ];
    
    for (const m of migrations) { await client.execute(m); }
    
    const existing = await client.execute('SELECT COUNT(*) as cnt FROM agents');
    const count = existing.rows[0]?.cnt as number || 0;
    
    if (count === 0) {
      for (let i = 0; i < DEMO_AGENTS.length; i++) {
        const a = DEMO_AGENTS[i];
        const id = `agent-${String(i+1).padStart(3,'0')}`;
        await client.execute({
          sql: `INSERT INTO agents (id, name, slug, description, emoji, color, division, specialization, source, status, capabilities, technical_skills, personality_traits, system_prompt, model_config, metrics) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [id, a.name, a.name.toLowerCase(), `${a.name} - ${a.specialization}`, a.emoji, 'blue', a.division, a.specialization, 'local', 'active', JSON.stringify(a.caps), JSON.stringify(a.caps), JSON.stringify(['helpful','efficient','detail-oriented']), `You are ${a.name}, a ${a.specialization} specialist.`, '{"primary":"claude-3-haiku","fallbacks":[]}', '{"tasksCompleted":0,"successRate":0.95,"avgResponseTime":2000}']
        });
      }
    }
    
    const result = await client.execute('SELECT id, name, division FROM agents');
    return NextResponse.json({
      success: true, seeded: count === 0, agentsCount: result.rows.length,
      agents: result.rows.map((r: any) => ({ id: r[0], name: r[1], division: r[2] }))
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function GET() {
  try {
    const client = createClient({ url: TURSO_URL, authToken: TURSO_TOKEN });
    const result = await client.execute('SELECT id, name, division FROM agents');
    return NextResponse.json({
      agentsCount: result.rows.length,
      agents: result.rows.map((r: any) => ({ id: r[0], name: r[1], division: r[2] }))
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}
