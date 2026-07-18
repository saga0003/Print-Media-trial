import { NextRequest, NextResponse } from 'next/server';
import { syncStageHistory } from '@/lib/stage-analytics/sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { mode?: 'full' | 'incremental' };
    const state = await syncStageHistory(body.mode === 'full' ? 'full' : 'incremental');
    return NextResponse.json({ ok: true, state });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stage-history sync failed.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
