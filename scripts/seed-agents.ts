// =====================================================
// Seed Script - Initialize core agents in database
// =====================================================

import '../src/lib/db';
import { syncFromWorkspace } from '../src/lib/agent-sync';

async function seed() {
  console.log('🌱 Seeding database with core agents...');

  try {
    const count = await syncFromWorkspace();
    console.log(`✅ Synced ${count} agents from workspace`);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }

  console.log('✅ Database seeded successfully!');
  process.exit(0);
}

seed();
