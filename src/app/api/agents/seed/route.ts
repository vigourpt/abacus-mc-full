import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { generateId, slugify } from '@/lib/utils';

const DEMO_AGENTS = [
  { name: 'Jarvis', division: 'executive', emoji: '🤖', specialization: 'Operations & AI Systems', capabilities: ['system-integration', 'automation', 'coordination'] },
  { name: 'Thor', division: 'engineering', emoji: '🔧', specialization: 'Infrastructure & DevOps', capabilities: ['docker', 'networking', 'monitoring'] },
  { name: 'DataBot', division: 'engineering', emoji: '🤖', specialization: 'Data Analysis', capabilities: ['analytics', 'python', 'machine-learning'] },
  { name: 'MarketBot', division: 'marketing', emoji: '📈', specialization: 'Growth Marketing', capabilities: ['seo', 'content', 'social-media'] },
  { name: 'SalesBot', division: 'sales', emoji: '💰', specialization: 'Lead Generation', capabilities: ['outreach', 'crm', 'closing'] },
  { name: 'DesignBot', division: 'design', emoji: '🎨', specialization: 'UI/UX Design', capabilities: ['figma', 'branding', 'prototyping'] },
  { name: 'DevOps Bot', division: 'operations', emoji: '⚙️', specialization: 'CI/CD & Deployment', capabilities: ['github-actions', 'docker', 'kubernetes'] },
  { name: 'ContentBot', division: 'marketing', emoji: '✍️', specialization: 'Content Creation', capabilities: ['writing', 'seo', 'copywriting'] },
  { name: 'SupportBot', division: 'support', emoji: '💬', specialization: 'Customer Support', capabilities: ['tickets', 'chat', 'faq'] },
  { name: 'AnalystBot', division: 'product', emoji: '📊', specialization: 'Product Analytics', capabilities: ['metrics', 'user-research', 'a-b-testing'] },
  { name: 'CopyBot', division: 'marketing', emoji: '✍️', specialization: 'Copywriting & Ads', capabilities: ['google-ads', 'facebook-ads', 'copywriting'] },
  { name: 'CodeBot', division: 'engineering', emoji: '💻', specialization: 'Full-Stack Development', capabilities: ['react', 'nodejs', 'python'] },
];

export async function POST() {
  try {
    // Check if agents already exist
    const existing = db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
    if (existing.count > 0) {
      const agents = db.prepare('SELECT * FROM agents').all();
      return NextResponse.json(agents);
    }

    const inserted = [];
    for (const demo of DEMO_AGENTS) {
      const id = generateId();
      const slug = slugify(demo.name);
      
      db.prepare(`
        INSERT INTO agents (
          id, name, slug, description, emoji, color, division, specialization,
          source, source_url, status, capabilities, technical_skills, personality_traits,
          system_prompt, model_config, metrics
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id,
        demo.name,
        slug,
        `${demo.name} - ${demo.specialization}`,
        demo.emoji,
        'blue',
        demo.division,
        demo.specialization,
        'local',
        null,
        'active',
        JSON.stringify(demo.capabilities),
        JSON.stringify(demo.capabilities),
        JSON.stringify(['helpful', 'efficient', 'detail-oriented']),
        `You are ${demo.name}, a ${demo.specialization} specialist.`,
        JSON.stringify({ primary: 'claude-3-haiku', fallbacks: [] }),
        JSON.stringify({ tasksCompleted: Math.floor(Math.random() * 50), successRate: 0.85 + Math.random() * 0.15, avgResponseTime: 2000 })
      );
      
      inserted.push({ id, name: demo.name, emoji: demo.emoji, division: demo.division });
    }

    const agents = db.prepare('SELECT * FROM agents').all();
    return NextResponse.json(agents);
  } catch (error) {
    console.error('Failed to seed agents:', error);
    return NextResponse.json({ error: 'Failed to seed agents' }, { status: 500 });
  }
}