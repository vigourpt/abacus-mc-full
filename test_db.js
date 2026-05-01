const { createClient } = require('@libsql/client');

async function test() {
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN
  });
  
  try {
    // Test basic insert
    const r = await client.execute({
      sql: 'INSERT INTO agents (id, name, slug, description, emoji, color, division, specialization, source, status, capabilities, technical_skills, personality_traits, system_prompt, model_config, metrics) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      args: [
        'agent-001', 'Jarvis', 'jarvis', 'Jarvis - Operations & AI Systems', '🤖', 'blue', 
        'executive', 'Operations & AI Systems', 'local', 'active',
        '["system-integration"]', '["system-integration"]', '["helpful"]',
        'You are Jarvis.', '{"primary":"claude-3-haiku","fallbacks":[]}',
        '{"tasksCompleted":0,"successRate":0.95,"avgResponseTime":2000}'
      ]
    });
    console.log('Insert result:', JSON.stringify(r));
  } catch (e) {
    console.error('Error:', e.message);
  }
}

test();
