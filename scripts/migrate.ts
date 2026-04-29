// =====================================================
// Migration Script - Run database migrations
// =====================================================

import { runMigrations } from '../src/lib/db';

console.log('🗄️ Running database migrations...');

try {
  runMigrations();
  console.log('✅ Migrations completed successfully!');
  process.exit(0);
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}
