// Seed initial activity log entries
import db from '../src/lib/db';
import { generateId } from '../src/lib/utils';

const activities = [
  { type: 'system', message: '🚀 Mission Control initialized successfully', metadata: {} },
  { type: 'agent_sync', message: '🔄 Synced 112 agents from workspace', metadata: { count: 112 } },
  { type: 'system', message: '💾 Database migrations completed', metadata: {} },
  { type: 'system', message: '🔒 Security scan completed - no issues found', metadata: {} },
  { type: 'agent_created', message: '🤖 CEO Agent initialized and ready', metadata: { division: 'executive' } },
  { type: 'agent_created', message: '🤖 Developer Agent initialized and ready', metadata: { division: 'engineering' } },
  { type: 'agent_created', message: '🤖 Marketing Agent initialized and ready', metadata: { division: 'marketing' } },
  { type: 'system', message: '📊 Analytics engine started', metadata: {} },
  { type: 'system', message: '🌐 Gateway service initialized', metadata: {} },
  { type: 'system', message: '✅ All systems operational', metadata: {} },
];

const stmt = db.prepare(`
  INSERT OR IGNORE INTO activity_log (id, type, message, metadata, created_at)
  VALUES (?, ?, ?, ?, datetime('now', ?))
`);

let seeded = 0;
for (let i = 0; i < activities.length; i++) {
  const act = activities[i];
  try {
    stmt.run(
      generateId(),
      act.type,
      act.message,
      JSON.stringify(act.metadata),
      `-${(activities.length - i) * 5} minutes`
    );
    seeded++;
  } catch (e) {
    // Ignore duplicates
  }
}

console.log(`Seeded ${seeded} activity entries`);
