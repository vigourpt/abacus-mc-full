// =====================================================
// Import Engineering Division Agents
// =====================================================
// Batch 1 of Phase 2 - Import all engineering agents
// from the agency-agents repository.

import { getAgentImporter } from '../src/lib/agent-importer';

async function main() {
  console.log('='.repeat(60));
  console.log('Importing Engineering Division Agents');
  console.log('='.repeat(60));
  console.log('');

  const importer = getAgentImporter();

  try {
    // Import engineering division
    console.log('📦 Fetching Engineering division agents...\n');
    
    const result = await importer.importDivision('engineering');
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ Import Complete!');
    console.log('='.repeat(60));
    console.log(`   New agents imported: ${result.agentsImported}`);
    console.log(`   Existing agents updated: ${result.agentsUpdated}`);
    console.log(`   Division: ${result.division}`);
    console.log(`   Source: ${result.source}`);
    console.log('');

    // List imported agents
    const agents = importer.getAgentsByDivision('engineering');
    console.log('Imported Engineering Agents:');
    console.log('-'.repeat(40));
    
    for (const agent of agents) {
      console.log(`  ${agent.emoji} ${agent.name}`);
      console.log(`     Slug: ${agent.slug}`);
      console.log(`     Specialization: ${agent.specialization || 'General'}`);
      console.log(`     Capabilities: ${agent.capabilities.slice(0, 5).join(', ')}${agent.capabilities.length > 5 ? '...' : ''}`);
      console.log('');
    }

    console.log(`Total Engineering Agents: ${agents.length}`);
    console.log('');
  } catch (error) {
    console.error('Failed to import agents:', error);
    process.exit(1);
  }
}

main();
