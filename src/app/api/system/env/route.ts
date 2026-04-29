export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { validateEnvironment, getEnvironmentSummary } from '@/lib/env-validation';

/**
 * Environment configuration status (no secrets exposed)
 * Useful for debugging deployment issues
 */
export async function GET() {
  const result = validateEnvironment();
  const summary = getEnvironmentSummary();

  return NextResponse.json({
    ...summary,
    validation: {
      valid: result.valid,
      errors: result.errors,
      warnings: result.warnings,
    },
  });
}
