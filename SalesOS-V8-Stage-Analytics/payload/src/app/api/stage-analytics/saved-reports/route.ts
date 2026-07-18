import { NextRequest, NextResponse } from 'next/server';
import { loadSavedStageReports, saveSavedStageReports } from '@/lib/stage-analytics/store';
import type { SavedStageReport } from '@/lib/stage-analytics/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const reports = await loadSavedStageReports();
  return NextResponse.json({ ok: true, reports });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Partial<SavedStageReport>;
    if (!body.name?.trim() || !body.filters || !Array.isArray(body.series)) {
      return NextResponse.json({ ok: false, error: 'Report name, filters and series are required.' }, { status: 400 });
    }
    const reports = await loadSavedStageReports(true);
    const report: SavedStageReport = {
      id: body.id || crypto.randomUUID(),
      name: body.name.trim(),
      createdAt: body.createdAt || new Date().toISOString(),
      filters: body.filters,
      series: body.series.slice(0, 5),
    };
    const next = [...reports.filter((item) => item.id !== report.id), report].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    await saveSavedStageReports(next);
    return NextResponse.json({ ok: true, report, reports: next });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save report.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id is required.' }, { status: 400 });
  const reports = await loadSavedStageReports(true);
  const next = reports.filter((report) => report.id !== id);
  await saveSavedStageReports(next);
  return NextResponse.json({ ok: true, reports: next });
}
