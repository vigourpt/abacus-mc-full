export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import db from '@/lib/db';

export async function GET() {
  try {
    const agents = db.prepare('SELECT * FROM agents ORDER BY division, name').all() as any[];
    
    return NextResponse.json(agents.map(a => ({
      id: a.id, name: a.name, slug: a.slug, description: a.description,
      emoji: a.emoji || '🤖', color: a.color || 'blue', division: a.division,
      specialization: a.specialization || '',
      source: a.source || 'local', status: a.status || 'idle',
      capabilities: JSON.parse(a.capabilities || '[]'),
      technicalSkills: JSON.parse(a.technical_skills || '[]'),
      personalityTraits: JSON.parse(a.personality_traits || '[]'),
      systemPrompt: a.system_prompt || '',
      model: JSON.parse(a.model_config || '{"primary":"claude-3-opus","fallbacks":[]}'),
      metrics: JSON.parse(a.metrics || '{"tasksCompleted":0,"successRate":0,"avgResponseTime":0}'),
    })));
  } catch (error) {
    console.error('Failed to fetch agents:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
