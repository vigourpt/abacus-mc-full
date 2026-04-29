export const dynamic = 'force-dynamic';
// =====================================================
// OpenClaw Sync API - Sync agents to gateway
// POST /api/openclaw/sync
// =====================================================

import { NextRequest, NextResponse } from 'next/server';
import {
  syncAllAgentsToOpenClaw,
  syncAgentToOpenClaw,
  pullAgentsFromOpenClaw,
  bidirectionalSync,
} from '@/lib/agent-sync';
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

const logger = createChildLogger('api-openclaw-sync');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action = 'push', agentSlug } = body;

    const client = getOpenClawClient();

    // Check connection status
    if (client.getState() !== 'connected') {
      return NextResponse.json(
        {
          success: false,
          error: 'Not connected to OpenClaw gateway',
          hint: 'Call POST /api/openclaw/connect first',
        },
        { status: 400 }
      );
    }

    let result;

    switch (action) {
      case 'push':
        // Push all agents to OpenClaw
        result = await syncAllAgentsToOpenClaw();
        logger.info(result, 'Agents pushed to OpenClaw');
        return NextResponse.json({
          success: true,
          action: 'push',
          result,
        });

      case 'push_one':
        // Push single agent
        if (!agentSlug) {
          return NextResponse.json(
            { success: false, error: 'agentSlug required for push_one' },
            { status: 400 }
          );
        }
        const pushSuccess = await syncAgentToOpenClaw(agentSlug);
        return NextResponse.json({
          success: pushSuccess,
          action: 'push_one',
          agentSlug,
        });

      case 'pull':
        // Pull agents from OpenClaw
        const pulled = await pullAgentsFromOpenClaw();
        logger.info({ count: pulled }, 'Agents pulled from OpenClaw');
        return NextResponse.json({
          success: true,
          action: 'pull',
          pulled,
        });

      case 'bidirectional':
        // Full bidirectional sync
        result = await bidirectionalSync();
        logger.info(result, 'Bidirectional sync completed');
        return NextResponse.json({
          success: true,
          action: 'bidirectional',
          result,
        });

      case 'skills':
        // MERGE skills from OpenClaw (preserves existing MC data)
        initializeResourceTables();
        result = await mergeSkillsFromOpenClaw();
        return NextResponse.json({
          success: true,
          action: 'skills',
          result,
          message: 'Skills merged. Existing Mission Control data preserved.',
        });

      case 'tools':
        // MERGE tools from OpenClaw (preserves existing MC data)
        initializeResourceTables();
        result = await mergeToolsFromOpenClaw();
        return NextResponse.json({
          success: true,
          action: 'tools',
          result,
          message: 'Tools merged. Existing Mission Control data preserved.',
        });

      case 'models':
        // MERGE models from OpenClaw (preserves existing MC data)
        initializeResourceTables();
        result = await mergeModelsFromOpenClaw();
        return NextResponse.json({
          success: true,
          action: 'models',
          result,
          message: 'Models merged. Existing Mission Control data preserved.',
        });

      case 'resources':
        // MERGE all resources from OpenClaw (preserves existing MC data)
        initializeResourceTables();
        const beforeCounts = getResourceCounts();
        const mergeResult = await mergeAllResourcesFromOpenClaw();
        const afterCounts = getResourceCounts();
        return NextResponse.json({
          success: true,
          action: 'resources',
          result: mergeResult,
          message: 'All resources merged. Existing Mission Control data preserved.',
          beforeMerge: beforeCounts,
          afterMerge: afterCounts,
        });

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
            validActions: ['push', 'push_one', 'pull', 'bidirectional', 'skills', 'tools', 'models', 'resources'],
          },
          { status: 400 }
        );
    }

  } catch (error) {
    logger.error({ error }, 'Sync failed');

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}
