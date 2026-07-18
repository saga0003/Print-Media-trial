import { NextRequest, NextResponse } from 'next/server';
import { loadStageEvents, loadStageLeads, loadStageSyncState } from '@/lib/stage-analytics/store';
import type { CohortKey, StageEvent, StageLeadSnapshot } from '@/lib/stage-analytics/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const LOST = new Set(['Seat Rejected', 'Entrance Exam Failed', 'Wrong Lead', 'Duplicates', 'Not Interested', 'Rejection Approved', 'Withdrawn']);
const ALLOWED_DIMENSIONS = new Set(['date', 'institute', 'grade', 'programme', 'salesperson', 'leadSource', 'fromStage', 'toStage']);

function dayBucket(value: string, granularity: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  if (granularity === 'day') return date.toISOString().slice(0, 10);
  if (granularity === 'quarter') return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
  if (granularity === 'month') return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  result.setUTCDate(result.getUTCDate() - ((result.getUTCDay() + 6) % 7));
  return result.toISOString().slice(0, 10);
}

function ever(events: StageEvent[], stage: string): boolean {
  return events.some((event) => event.toStage === stage);
}

function cohortMatch(cohort: CohortKey, lead: StageLeadSnapshot, history: StageEvent[]): boolean {
  const admitted = ever(history, 'Seat Allotted') || lead.currentStage === 'Seat Allotted';
  const cleared = ever(history, 'Entrance Exam Cleared') || lead.currentStage === 'Entrance Exam Cleared';
  const payment = ever(history, 'Seat Confirmed: Payment Pending') || lead.currentStage === 'Seat Confirmed: Payment Pending';
  const visited = ever(history, 'Visited School') || lead.currentStage === 'Visited School';
  const appointment = ever(history, 'Appointment Scheduled to Visit the School') || lead.currentStage === 'Appointment Scheduled to Visit the School';
  const exam = ever(history, 'Written Entrance Exam') || ever(history, 'Re-Test') || ['Written Entrance Exam', 'Re-Test'].includes(lead.currentStage);
  const lost = LOST.has(lead.currentStage) || history.some((event) => LOST.has(event.toStage));
  if (cohort === 'admitted') return admitted;
  if (cohort === 'cleared_not_admitted') return cleared && !payment && !admitted;
  if (cohort === 'payment_pending_not_allotted') return payment && !admitted;
  if (cohort === 'visited_no_exam') return visited && !exam && !cleared && !admitted;
  if (cohort === 'appointment_no_visit') return appointment && !visited;
  if (cohort === 'lost_after_visit') return visited && lost && !admitted;
  if (cohort === 'lost_after_clearance') return cleared && lost && !admitted;
  return true;
}

function dimensionValue(event: StageEvent, dimension: string, granularity: string): string {
  if (dimension === 'date') return dayBucket(event.changedAt, granularity);
  if (dimension === 'institute') return event.institute || 'Unknown institute';
  if (dimension === 'grade') return event.grade || 'Unknown grade';
  if (dimension === 'programme') return event.programme || 'Unknown programme';
  if (dimension === 'salesperson') return event.assignedSalesperson || 'Unassigned';
  if (dimension === 'leadSource') return event.leadSource || 'Unknown source';
  if (dimension === 'fromStage') return event.fromStage || 'Unknown stage';
  return event.toStage || 'Unknown stage';
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const from = params.get('from') || new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    const to = params.get('to') || new Date().toISOString().slice(0, 10);
    const granularity = params.get('granularity') || 'week';
    const cohort = (params.get('cohort') || 'all') as CohortKey;
    const dimensions = params.getAll('dimension').filter((item) => ALLOWED_DIMENSIONS.has(item)).slice(0, 5);
    if (!dimensions.length) dimensions.push('date');
    const stages = params.getAll('stage').filter(Boolean).slice(0, 5);
    const filters = {
      academicYear: params.get('academicYear') || '', institute: params.get('institute') || '', grade: params.get('grade') || '',
      programme: params.get('programme') || '', salesperson: params.get('salesperson') || '', leadSource: params.get('leadSource') || '',
    };

    const [events, leads, syncState] = await Promise.all([loadStageEvents(), loadStageLeads(), loadStageSyncState()]);
    const history = new Map<number, StageEvent[]>();
    for (const event of events) history.set(event.leadId, [...(history.get(event.leadId) || []), event]);
    const selectedLeadIds = new Set(leads.filter((lead) => {
      const equal = (actual: string, expected: string) => !expected || actual === expected;
      return equal(lead.academicYear, filters.academicYear) && equal(lead.institute, filters.institute) && equal(lead.grade, filters.grade)
        && equal(lead.programme, filters.programme) && equal(lead.salesperson, filters.salesperson) && equal(lead.leadSource, filters.leadSource)
        && cohortMatch(cohort, lead, history.get(lead.id) || []);
    }).map((lead) => lead.id));

    const start = new Date(`${from}T00:00:00Z`).getTime();
    const end = new Date(`${to}T23:59:59.999Z`).getTime();
    const period = events.filter((event) => selectedLeadIds.has(event.leadId) && new Date(event.changedAt).getTime() >= start && new Date(event.changedAt).getTime() <= end);
    const selectedStages = stages.length ? stages : Array.from(new Set(period.map((event) => event.toStage))).slice(0, 5);
    const buckets = new Map<string, Record<string, number>>();
    for (const event of period) {
      const bucket = dimensions.map((dimension) => dimensionValue(event, dimension, granularity)).join(' · ');
      const row = buckets.get(bucket) || {};
      if (selectedStages.includes(event.toStage)) row[`entries:${event.toStage}`] = (row[`entries:${event.toStage}`] || 0) + 1;
      if (selectedStages.includes(event.fromStage)) row[`exits:${event.fromStage}`] = (row[`exits:${event.fromStage}`] || 0) + 1;
      buckets.set(bucket, row);
    }
    const rows = Array.from(buckets.entries()).map(([bucket, values]) => {
      const row: Record<string, string | number> = { bucket };
      for (const stage of selectedStages) {
        const entries = values[`entries:${stage}`] || 0;
        const exits = values[`exits:${stage}`] || 0;
        row[`entries:${stage}`] = entries;
        row[`exits:${stage}`] = exits;
        row[`net:${stage}`] = entries - exits;
      }
      return row;
    }).sort((a, b) => String(a.bucket).localeCompare(String(b.bucket))).slice(0, 500);

    const options = {
      stages: Array.from(new Set(events.flatMap((event) => [event.fromStage, event.toStage]).filter(Boolean))).sort(),
      academicYears: Array.from(new Set(leads.map((lead) => lead.academicYear).filter(Boolean))).sort(),
      institutes: Array.from(new Set(leads.map((lead) => lead.institute).filter(Boolean))).sort(),
      grades: Array.from(new Set(leads.map((lead) => lead.grade).filter(Boolean))).sort(),
      programmes: Array.from(new Set(leads.map((lead) => lead.programme).filter(Boolean))).sort(),
      salespeople: Array.from(new Set(leads.map((lead) => lead.salesperson).filter(Boolean))).sort(),
      leadSources: Array.from(new Set(leads.map((lead) => lead.leadSource).filter(Boolean))).sort(),
    };
    return NextResponse.json({ ok: true, rows, stages: selectedStages, dimensions, options, eventCount: period.length, leadCount: selectedLeadIds.size, syncState });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : 'Chart Studio query failed.' }, { status: 500 });
  }
}
