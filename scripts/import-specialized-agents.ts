/**
 * Import Remaining Specialized Agents Script
 * Imports agents from agency-agents repo to reach 100+ total
 * Focus: Game Dev, Spatial Computing, Testing
 */

import fs from 'fs';
import path from 'path';
import '../src/lib/db';
import { getAgentImporter } from '../src/lib/agent-importer';

const AGENCY_AGENTS_PATH = '/home/ubuntu/github_repos/agency-agents';

// Agent categories to import
const CATEGORIES_TO_IMPORT = [
  { folder: 'game-development', division: 'game-development' },
  { folder: 'spatial-computing', division: 'spatial-computing' },
  { folder: 'testing', division: 'testing' },
];

async function findAgentFiles(basePath: string): Promise<{path: string, relativePath: string}[]> {
  const files: {path: string, relativePath: string}[] = [];
  
  const processDir = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        processDir(fullPath);
      } else if (entry.name.endsWith('.md') && 
                 !entry.name.includes('README') && 
                 !entry.name.includes('CONTRIBUTING')) {
        files.push({
          path: fullPath,
          relativePath: path.relative(basePath, fullPath)
        });
      }
    }
  };
  
  processDir(basePath);
  return files;
}

async function importAgents() {
  console.log('🚀 Starting Specialized Agent Import (Batch 5)...\n');
  
  const importer = getAgentImporter();
  let totalImported = 0;
  let totalUpdated = 0;
  let errors = 0;
  
  for (const category of CATEGORIES_TO_IMPORT) {
    const categoryPath = path.join(AGENCY_AGENTS_PATH, category.folder);
    
    if (!fs.existsSync(categoryPath)) {
      console.log(`⚠️  Category not found: ${category.folder}`);
      continue;
    }
    
    console.log(`\n📁 Processing: ${category.folder}`);
    
    const agentFiles = await findAgentFiles(categoryPath);
    console.log(`   Found ${agentFiles.length} agent files`);
    
    for (const file of agentFiles) {
      try {
        const content = fs.readFileSync(file.path, 'utf-8');
        const fileName = path.basename(file.path);
        
        // Parse the markdown content
        const parsed = importer.parseAgentMarkdown(content, fileName, category.division);
        
        // Save to workspace
        importer.saveAgentToWorkspace(parsed);
        
        // Import to database
        const result = importer.importAgentToDb(parsed);
        
        if (result.isNew) {
          console.log(`   ✅ Imported: ${parsed.name}`);
          totalImported++;
        } else {
          console.log(`   🔄 Updated: ${parsed.name}`);
          totalUpdated++;
        }
      } catch (err: any) {
        console.error(`   ❌ Error importing ${file.relativePath}:`, err.message);
        errors++;
      }
    }
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`📊 Import Summary:`);
  console.log(`   ✅ New agents imported: ${totalImported}`);
  console.log(`   🔄 Agents updated: ${totalUpdated}`);
  console.log(`   ❌ Errors: ${errors}`);
  console.log(`${'='.repeat(50)}\n`);
  
  // Show final count
  const db = require('better-sqlite3')('.data/startup.db');
  const totalAgents = db.prepare('SELECT COUNT(*) as count FROM agents').get();
  const byDivision = db.prepare('SELECT division, COUNT(*) as count FROM agents GROUP BY division ORDER BY count DESC').all();
  
  console.log(`🎯 Total agents in database: ${totalAgents.count}`);
  console.log(`\n📊 Agents by Division:`);
  for (const d of byDivision) {
    console.log(`   ${d.division}: ${d.count}`);
  }
}

importAgents().catch(console.error);
