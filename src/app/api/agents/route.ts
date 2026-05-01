export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import { generateId, slugify } from '@/lib/utils';

export async function GET() {
  return NextResponse.json([{ id: generateId(), name: 'Test' }]);
}
