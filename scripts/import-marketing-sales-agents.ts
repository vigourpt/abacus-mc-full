// =====================================================
// Import Marketing & Sales Division Agents
// =====================================================
// Batch 3 of Phase 2 - Import all Marketing and Sales
// agents from the agency-agents repository.

import { getAgentImporter } from '../src/lib/agent-importer';

interface ImportStats {
  division: string;
  imported: number;
  updated: number;
  agents: Array<{ 
    emoji: string; 
    name: string; 
    slug: string; 
    specialization: string | undefined;
    capabilities: string[];
  }>;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Batch 3 - Import Marketing & Sales Division Agents');
  console.log('='.repeat(60));
  console.log('');

  const importer = getAgentImporter();
  const stats: ImportStats[] = [];

  // Divisions to import in this batch
  // Note: 'marketing' and 'paid-media' are separate divisions in the repo
  // Sales may be under a different name or combined with other divisions
  const targetDivisions = ['marketing', 'paid-media'];

  try {
    // First, check available divisions
    console.log('📋 Checking available divisions in agency-agents repo...\n');
    const availableDivisions = await importer.getAvailableDivisions();
    console.log(`   Available divisions: ${availableDivisions.join(', ')}\n`);

    // Check if 'sales' division exists
    if (availableDivisions.includes('sales')) {
      targetDivisions.push('sales');
    }

    // Also check for 'strategy' which may include sales-related agents
    if (availableDivisions.includes('strategy')) {
      targetDivisions.push('strategy');
    }

    // Import each target division
    for (const division of targetDivisions) {
      if (!availableDivisions.includes(division)) {
        console.log(`⚠️  Division "${division}" not found in repository, skipping...`);
        continue;
      }

      console.log('='.repeat(40));
      console.log(`📦 Importing ${division.toUpperCase()} division...`);
      console.log('='.repeat(40));
      console.log('');

      const result = await importer.importDivision(division);

      // Get agents for this division
      const agents = importer.getAgentsByDivision(division);
      
      stats.push({
        division,
        imported: result.agentsImported,
        updated: result.agentsUpdated,
        agents: agents.map(a => ({
          emoji: a.emoji,
          name: a.name,
          slug: a.slug,
          specialization: a.specialization,
          capabilities: a.capabilities.slice(0, 5), // First 5 capabilities
        })),
      });

      console.log(`   ✅ ${division}: ${result.agentsImported} new, ${result.agentsUpdated} updated\n`);
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 IMPORT SUMMARY');
    console.log('='.repeat(60));
    console.log('');

    let totalImported = 0;
    let totalUpdated = 0;
    let totalAgents = 0;

    for (const stat of stats) {
      totalImported += stat.imported;
      totalUpdated += stat.updated;
      totalAgents += stat.agents.length;

      console.log(`\n${stat.division.toUpperCase()} Division (${stat.agents.length} agents):`);
      console.log('-'.repeat(40));
      
      for (const agent of stat.agents) {
        console.log(`  ${agent.emoji} ${agent.name}`);
        console.log(`     Slug: ${agent.slug}`);
        console.log(`     Specialization: ${agent.specialization || 'General'}`);
        if (agent.capabilities.length > 0) {
          console.log(`     Key Skills: ${agent.capabilities.join(', ')}`);
        }
        console.log('');
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ BATCH 3 COMPLETE');
    console.log('='.repeat(60));
    console.log(`   Total new agents imported: ${totalImported}`);
    console.log(`   Total existing updated: ${totalUpdated}`);
    console.log(`   Total Marketing & Sales agents: ${totalAgents}`);
    console.log('');

    // Show breakdown by division
    console.log('📈 Division Breakdown:');
    for (const stat of stats) {
      console.log(`   ${stat.division}: ${stat.agents.length} agents`);
    }
    console.log('');

    // Get total agent count from database
    const dbModule = await import('../src/lib/db');
    const totalCount = dbModule.default.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
    console.log(`🤖 Total Agents in System: ${totalCount.count}`);
    console.log('');

    // Show agent distribution by division
    console.log('📊 All Divisions Summary:');
    const divisionCounts = dbModule.default.prepare(`
      SELECT division, COUNT(*) as count 
      FROM agents 
      GROUP BY division 
      ORDER BY count DESC
    `).all() as Array<{ division: string; count: number }>;
    
    for (const row of divisionCounts) {
      console.log(`   ${row.division}: ${row.count} agents`);
    }
    console.log('');

  } catch (error) {
    console.error('Failed to import agents:', error);
    process.exit(1);
  }
}

main();
