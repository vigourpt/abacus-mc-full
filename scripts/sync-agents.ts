// =====================================================
// Sync Agents Script - Sync from OpenClaw and workspace
// =====================================================

import '../src/lib/db';
import { syncAll } from '../src/lib/agent-sync';

async function main() {
  console.log('🔄 Syncing agents from all sources...');

  try {
    const result = await syncAll();
    console.log(`✅ Synced ${result.openclaw} from OpenClaw`);
    console.log(`✅ Synced ${result.workspace} from workspace`);
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }

  console.log('✅ Agent sync completed!');
  process.exit(0);
}

main();
