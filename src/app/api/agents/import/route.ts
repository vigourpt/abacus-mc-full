export const dynamic = 'force-dynamic';
// =====================================================
// Agent Import API - Phase 2
// =====================================================

import { NextResponse } from 'next/server';
import { getAgentImporter } from '@/lib/agent-importer';
import { createChildLogger } from '@/lib/logger';

const logger = createChildLogger('api-agents-import');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { division } = body;

    if (!division) {
      return NextResponse.json(
        { error: 'Division is required' },
        { status: 400 }
      );
    }

    const importer = getAgentImporter();
    
    logger.info({ division }, 'Starting agent import');
    
    const result = await importer.importDivision(division);

    return NextResponse.json({
      success: true,
      imported: result.agentsImported,
      updated: result.agentsUpdated,
      division: result.division,
      source: result.source,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to import agents');
    return NextResponse.json(
      { error: 'Failed to import agents', details: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const importer = getAgentImporter();
    
    // Get available divisions
    const divisions = await importer.getAvailableDivisions();
    
    // Get import history
    const history = importer.getImportHistory(10);

    return NextResponse.json({
      availableDivisions: divisions,
      importHistory: history,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get import info');
    return NextResponse.json(
      { error: 'Failed to get import info', details: (error as Error).message },
      { status: 500 }
    );
  }
}
