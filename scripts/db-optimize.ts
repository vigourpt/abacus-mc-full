#!/usr/bin/env npx tsx
// =====================================================
// Database Optimization Script
// =====================================================

import { dbMaintenance, ensureIndexes } from '../src/lib/db-optimizer';
import '../src/lib/db'; // Ensure migrations run first

async function main() {
  console.log('\n🗄️  Database Optimization Tool\n');
  console.log('='.repeat(50));

  const args = process.argv.slice(2);
  const command = args[0] || 'status';

  try {
    switch (command) {
      case 'status':
        console.log('\n📊 Database Status:\n');
        const stats = dbMaintenance.getStats();
        console.log(`  Size: ${stats.sizeMB} MB (${stats.sizeBytes.toLocaleString()} bytes)`);
        console.log(`  Pages: ${stats.pageCount} x ${stats.pageSize} bytes`);
        console.log(`  Free pages: ${stats.freelistCount}`);
        console.log('\n📝 Table Counts:\n');
        for (const [table, count] of Object.entries(stats.tables)) {
          console.log(`  ${table}: ${count.toLocaleString()} rows`);
        }
        break;

      case 'checkpoint':
        console.log('\n🔄 Running WAL checkpoint...');
        const checkpoint = dbMaintenance.checkpoint();
        console.log('  Checkpoint completed:', checkpoint);
        break;

      case 'vacuum':
        console.log('\n🧹 Running VACUUM...');
        dbMaintenance.vacuum();
        console.log('  Vacuum completed');
        break;

      case 'analyze':
        console.log('\n🔍 Running ANALYZE...');
        dbMaintenance.analyze();
        console.log('  Analysis completed');
        break;

      case 'integrity':
        console.log('\n✅ Running integrity check...');
        const integrity = dbMaintenance.integrityCheck();
        console.log(`  Status: ${integrity.isOk ? '✅ OK' : '❌ FAILED'}`);
        console.log('  Result:', integrity.result);
        break;

      case 'indexes':
        console.log('\n🗂️  Ensuring indexes...');
        ensureIndexes();
        console.log('  Indexes ensured');
        break;

      case 'optimize':
        console.log('\n⚡ Running full optimization...');
        const results = dbMaintenance.optimize();
        console.log('\n  Results:');
        console.log('  - Checkpoint:', results.checkpoint ? '✅' : '❌');
        console.log('  - Analyze:', results.analyze ? '✅' : '❌');
        console.log('  - Vacuum:', results.vacuum ? '✅' : '❌');
        console.log('  - Integrity:', results.integrity?.isOk ? '✅' : '❌');
        break;

      case 'help':
      default:
        console.log(`
Usage: npx tsx scripts/db-optimize.ts <command>

Commands:
  status      Show database statistics (default)
  checkpoint  Run WAL checkpoint
  vacuum      Reclaim disk space
  analyze     Analyze tables for query optimization
  integrity   Run integrity check
  indexes     Ensure all indexes exist
  optimize    Run full optimization (checkpoint + analyze + vacuum + integrity)
  help        Show this help
`);
        break;
    }
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }

  console.log('\n' + '='.repeat(50));
  console.log('Done!\n');
}

main();
