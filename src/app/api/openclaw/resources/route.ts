export const dynamic = 'force-dynamic';
// =====================================================
// OpenClaw Resources Sync API - MERGE skills, tools, models from OpenClaw
// POST /api/openclaw/resources/sync
// GET /api/openclaw/resources
//
// IMPORTANT: This is a MERGE operation, not a replace!
// - Adds NEW resources from OpenClaw that don't exist in Mission Control
// - PRESERVES all existing Mission Control data
// - NEVER deletes or replaces existing data
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  mergeSkillsFromOpenClaw,
  mergeToolsFromOpenClaw,
  mergeModelsFromOpenClaw,
  mergeAllResourcesFromOpenClaw,
  initializeResourceTables,
  getSyncedSkills,
  getSyncedTools,
  getSyncedModels,
  getResourceCounts,
} from '@/lib/openclaw-resource-sync';
import { getOpenClawClient } from '@/lib/openclaw-client';
import { createChildLogger } from '@/lib/logger';

const logger = createChildLogger('api-openclaw-resources');

// Initialize tables on module load
try {
  initializeResourceTables();
} catch (err) {
  logger.warn({ error: err }, 'Failed to initialize resource tables');
}

// GET /api/openclaw/resources - Get merged resources
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';

    // Ensure tables exist
    initializeResourceTables();

    let result: any = {};
    const counts = getResourceCounts();

    if (type === 'all' || type === 'skills') {
      result.skills = getSyncedSkills();
      result.skillsCount = counts.skills;
    }

    if (type === 'all' || type === 'tools') {
      result.tools = getSyncedTools();
      result.toolsCount = counts.tools;
    }

    if (type === 'all' || type === 'models') {
      result.models = getSyncedModels();
      result.modelsCount = counts.models;
    }

    return NextResponse.json({
      success: true,
      type,
      message: 'Mission Control data preserved. Showing merged resources.',
      ...result,
    });

  } catch (error) {
    logger.error({ error }, 'Failed to get resources');
    return NextResponse.json(
      { success: false, error: 'Failed to get resources' },
      { status: 500 }
    );
  }
}

// POST /api/openclaw/resources/sync - MERGE resources from OpenClaw
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { type = 'all' } = body;

    // Ensure tables exist
    initializeResourceTables();

    let result: any = {};
    let action = '';

    // Get counts before merge
    const beforeCounts = getResourceCounts();

    switch (type) {
      case 'skills':
        result = await mergeSkillsFromOpenClaw();
        action = 'Skills';
        break;
      case 'tools':
        result = await mergeToolsFromOpenClaw();
        action = 'Tools';
        break;
      case 'models':
        result = await mergeModelsFromOpenClaw();
        action = 'Models';
        break;
      case 'all':
        result = await mergeAllResourcesFromOpenClaw();
        action = 'All resources';
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unknown type: ${type}. Valid types: skills, tools, models, all` },
          { status: 400 }
        );
    }

    // Get counts after merge
    const afterCounts = getResourceCounts();

    logger.info({ type, result }, `${action} merge completed`);

    return NextResponse.json({
      success: true,
      type,
      action,
      result,
      message: 'MERGE completed. All existing Mission Control data preserved.',
      beforeMerge: beforeCounts,
      afterMerge: afterCounts,
    });

  } catch (error) {
    logger.error({ error }, 'Failed to merge resources');
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Merge failed' },
      { status: 500 }
    );
  }
}
