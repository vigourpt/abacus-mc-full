// =====================================================
// Import Operations & Support Division Agents
// =====================================================
// Batch 4 of Phase 2 - Import all operations and support agents
// from the agency-agents repository.
//
// This script imports from multiple repository directories:
// - support: Customer support, analytics, compliance, and infrastructure agents
// - project-management: Operations, workflow, and project management agents
// - specialized: Relevant operations-related agents (compliance, data ops)

import { getAgentImporter } from '../src/lib/agent-importer';

// Define operations-related specialized agents to import
const SPECIALIZED_OPS_AGENTS = [
  'accounts-payable-agent.md',
  'compliance-auditor.md',
  'data-analytics-reporter.md',
  'data-consolidation-agent.md',
  'report-distribution-agent.md',
  'agents-orchestrator.md',
];

interface ImportResult {
  division: string;
  agentsImported: number;
  agentsUpdated: number;
  source: string;
}

async function importSpecializedOpsAgents(importer: ReturnType<typeof getAgentImporter>): Promise<ImportResult> {
  console.log('📦 Importing specialized operations agents...\n');
  
  let imported = 0;
  let updated = 0;
  
  for (const filename of SPECIALIZED_OPS_AGENTS) {
    try {
      // Fetch the agent markdown
      const url = `https://raw.githubusercontent.com/msitarzewski/agency-agents/main/specialized/${filename}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.log(`   ⚠️ Skipped: ${filename} (not found)`);
        continue;
      }
      
      const content = await response.text();
      
      // Parse the agent - using 'operations' as the target division for these agents
      const parsed = importer.parseAgentMarkdown(content, filename, 'specialized');
      
      // Override division to 'operations' for these agents
      parsed.division = 'operations';
      
      // Save to workspace
      importer.saveAgentToWorkspace(parsed);
      
      // Import to database
      const result = importer.importAgentToDb(parsed);
      
      if (result.isNew) {
        imported++;
        console.log(`   ✅ ${parsed.emoji} ${parsed.name} (NEW)`);
      } else {
        updated++;
        console.log(`   🔄 ${parsed.emoji} ${parsed.name} (updated)`);
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error(`   ❌ Failed: ${filename}`, error);
    }
  }
  
  return {
    division: 'operations',
    agentsImported: imported,
    agentsUpdated: updated,
    source: 'specialized',
  };
}

async function main() {
  console.log('='.repeat(60));
  console.log('Importing Operations & Support Division Agents');
  console.log('='.repeat(60));
  console.log('');
  console.log('This batch imports agents from:');
  console.log('  - support/ directory (customer support & infrastructure)');
  console.log('  - project-management/ directory (operations & workflow)');
  console.log('  - specialized/ directory (selected ops-related agents)');
  console.log('');

  const importer = getAgentImporter();

  const results: ImportResult[] = [];

  try {
    // =========================================
    // 1. Import Support Division
    // =========================================
    console.log('📦 [1/3] Fetching Support division agents...\n');
    
    const supportResult = await importer.importDivision('support');
    results.push({
      division: 'support',
      agentsImported: supportResult.agentsImported,
      agentsUpdated: supportResult.agentsUpdated,
      source: 'support',
    });
    
    // List support agents
    const supportAgents = importer.getAgentsByDivision('support');
    console.log('\nSupport Agents Imported:');
    console.log('-'.repeat(40));
    for (const agent of supportAgents) {
      console.log(`  ${agent.emoji} ${agent.name}`);
      console.log(`     Slug: ${agent.slug}`);
      console.log(`     Specialization: ${agent.specialization || 'General'}`);
      console.log('');
    }

    // =========================================
    // 2. Import Project Management Division
    // =========================================
    console.log('\n' + '='.repeat(60));
    console.log('📦 [2/3] Fetching Project Management division agents...\n');
    
    const pmResult = await importer.importDivision('project-management');
    results.push({
      division: 'project-management',
      agentsImported: pmResult.agentsImported,
      agentsUpdated: pmResult.agentsUpdated,
      source: 'project-management',
    });
    
    // List project management agents
    const pmAgents = importer.getAgentsByDivision('project-management');
    console.log('\nProject Management Agents Imported:');
    console.log('-'.repeat(40));
    for (const agent of pmAgents) {
      console.log(`  ${agent.emoji} ${agent.name}`);
      console.log(`     Slug: ${agent.slug}`);
      console.log(`     Specialization: ${agent.specialization || 'General'}`);
      console.log('');
    }

    // =========================================
    // 3. Import Specialized Operations Agents
    // =========================================
    console.log('\n' + '='.repeat(60));
    console.log('📦 [3/3] Fetching Specialized operations agents...\n');
    
    const specializedOpsResult = await importSpecializedOpsAgents(importer);
    results.push(specializedOpsResult);

    // =========================================
    // Summary
    // =========================================
    console.log('\n' + '='.repeat(60));
    console.log('✅ Operations & Support Import Complete!');
    console.log('='.repeat(60));
    console.log('');
    
    let totalImported = 0;
    let totalUpdated = 0;
    
    for (const result of results) {
      console.log(`${result.division}:`);
      console.log(`   New agents imported: ${result.agentsImported}`);
      console.log(`   Existing agents updated: ${result.agentsUpdated}`);
      console.log('');
      totalImported += result.agentsImported;
      totalUpdated += result.agentsUpdated;
    }
    
    console.log('-'.repeat(40));
    console.log(`Total New Agents: ${totalImported}`);
    console.log(`Total Updated Agents: ${totalUpdated}`);
    console.log(`Grand Total Processed: ${totalImported + totalUpdated}`);
    console.log('');

    // =========================================
    // Final Agent Count Summary
    // =========================================
    console.log('='.repeat(60));
    console.log('Final Agent Roster by Division:');
    console.log('='.repeat(60));
    
    const allDivisions = [
      'support', 'project-management', 'operations',
      'engineering', 'marketing', 'design', 
      'paid-media', 'product', 'strategy', 
      'executive', 'sales'
    ];
    
    let grandTotal = 0;
    
    for (const div of allDivisions) {
      const agents = importer.getAgentsByDivision(div);
      if (agents.length > 0) {
        console.log(`  ${div}: ${agents.length} agents`);
        grandTotal += agents.length;
      }
    }
    
    console.log('-'.repeat(40));
    console.log(`Total Agents in System: ${grandTotal}`);
    console.log('');
    
  } catch (error) {
    console.error('Failed to import agents:', error);
    process.exit(1);
  }
}

main();
