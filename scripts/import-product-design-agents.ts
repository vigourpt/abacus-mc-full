// =====================================================
// Import Product & Design Division Agents
// =====================================================
// Batch 2 of Phase 2 - Import all Product Management and
// Design/UX agents from the agency-agents repository.

import { getAgentImporter } from '../src/lib/agent-importer';

interface ImportStats {
  division: string;
  imported: number;
  updated: number;
  agents: Array<{ emoji: string; name: string; slug: string; specialization: string | undefined }>;
}

async function main() {
  console.log('='.repeat(60));
  console.log('Batch 2 - Import Product & Design Division Agents');
  console.log('='.repeat(60));
  console.log('');

  const importer = getAgentImporter();
  const stats: ImportStats[] = [];

  // Divisions to import in this batch
  const divisions = ['product', 'design'];

  try {
    // First, check available divisions
    console.log('📋 Checking available divisions in agency-agents repo...\n');
    const availableDivisions = await importer.getAvailableDivisions();
    console.log(`   Available divisions: ${availableDivisions.join(', ')}\n`);

    for (const division of divisions) {
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
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('✅ BATCH 2 COMPLETE');
    console.log('='.repeat(60));
    console.log(`   Total new agents imported: ${totalImported}`);
    console.log(`   Total existing updated: ${totalUpdated}`);
    console.log(`   Total Product & Design agents: ${totalAgents}`);
    console.log('');

    // Show total agent count
    const allProductAgents = importer.getAgentsByDivision('product');
    const allDesignAgents = importer.getAgentsByDivision('design');
    
    console.log('📈 Division Breakdown:');
    console.log(`   Product Management: ${allProductAgents.length} agents`);
    console.log(`   Design/UX: ${allDesignAgents.length} agents`);
    console.log('');

    // Get total agent count from database
    const dbModule = await import('../src/lib/db');
    const totalCount = dbModule.default.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
    console.log(`🤖 Total Agents in System: ${totalCount.count}`);
    console.log('');

  } catch (error) {
    console.error('Failed to import agents:', error);
    process.exit(1);
  }
}

main();
