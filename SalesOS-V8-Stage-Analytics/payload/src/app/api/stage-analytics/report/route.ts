import { NextRequest, NextResponse } from 'next/server';
import { buildStageAnalyticsReport } from '@/lib/stage-analytics/report';
import type { CohortKey, DateGranularity, StageReportFilters } from '@/lib/stage-analytics/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const reportCache = new Map<string, { expiresAt: number; value: unknown }>();

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function parseFilters(request: NextRequest): StageReportFilters {
  const params = request.nextUrl.searchParams;
  const granularity = (params.get('granularity') || 'week') as DateGranularity;
  const cohort = (params.get('cohort') || 'all') as CohortKey;
  return {
    from: params.get('from') || daysAgoIso(90),
    to: params.get('to') || todayIso(),
    granularity: ['day', 'week', 'month', 'quarter'].includes(granularity) ? granularity : 'week',
    academicYear: params.get('academicYear') || undefined,
    institute: params.get('institute') || undefined,
    grade: params.get('grade') || undefined,
    programme: params.get('programme') || undefined,
    salesperson: params.get('salesperson') || undefined,
    leadSource: params.get('leadSource') || undefined,
    cohort,
    stages: params.getAll('stage').filter(Boolean).slice(0, 5),
    stagnantDays: Math.max(1, Number(params.get('stagnantDays') || 5)),
  };
}

export async function GET(request: NextRequest) {
  try {
    const filters = parseFilters(request);
    const cacheSeconds = Math.max(15, Number(process.env.STAGE_REPORT_CACHE_SECONDS || 120));
    const key = JSON.stringify(filters);
    const cached = reportCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return NextResponse.json({ ok: true, cached: true, report: cached.value });
    }
    const report = await buildStageAnalyticsReport(filters);
    reportCache.set(key, { expiresAt: Date.now() + cacheSeconds * 1000, value: report });
    if (reportCache.size > 100) {
      for (const [cacheKey, entry] of reportCache.entries()) if (entry.expiresAt <= Date.now()) reportCache.delete(cacheKey);
    }
    return NextResponse.json({ ok: true, cached: false, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not build stage analytics report.';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
