import { loadStageEvents, loadStageLeads, loadStageSyncState } from './store';
import { EXACT_STAGE_ORDER } from './sync';
import type {
  CohortKey,
  ComplianceRow,
  ConversionMatrixRow,
  ForecastRow,
  HeatmapCell,
  LeadJourneyRow,
  LossRow,
  MilestoneRow,
  OwnershipRow,
  StageAnalyticsReport,
  StageEvent,
  StageLeadSnapshot,
  StageRegisterRow,
  StageReportFilters,
  StageTimePoint,
} from './types';

const MILESTONES = [
  'Appointment Scheduled to Visit the School',
  'Visited School',
  'Written Entrance Exam',
  'Entrance Exam Cleared',
  'Seat Confirmed: Payment Pending',
  'Seat Allotted',
];
const LOST_STAGES = new Set([
  'Seat Rejected',
  'Entrance Exam Failed',
  'Wrong Lead',
  'Duplicates',
  'Not Interested',
  'Rejection Approved',
  'Withdrawn',
]);

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function round(value: number, digits = 1): number {
  const power = 10 ** digits;
  return Math.round(value * power) / power;
}

function daysBetween(from: string, to: string): number {
  const start = new Date(from).getTime();
  const end = new Date(to).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, (end - start) / 86_400_000);
}

function startOfWeek(date: Date): Date {
  const result = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = (result.getUTCDay() + 6) % 7;
  result.setUTCDate(result.getUTCDate() - day);
  return result;
}

function bucketDate(value: string, granularity: StageReportFilters['granularity']): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  if (granularity === 'day') return date.toISOString().slice(0, 10);
  if (granularity === 'week') return startOfWeek(date).toISOString().slice(0, 10);
  if (granularity === 'quarter') return `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function withinDate(value: string, from: string, to: string): boolean {
  const time = new Date(value).getTime();
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T23:59:59.999Z`).getTime();
  return Number.isFinite(time) && time >= start && time <= end;
}

function historyByLead(events: StageEvent[]): Map<number, StageEvent[]> {
  const map = new Map<number, StageEvent[]>();
  for (const event of events) {
    const rows = map.get(event.leadId) ?? [];
    rows.push(event);
    map.set(event.leadId, rows);
  }
  for (const rows of map.values()) rows.sort((a, b) => a.changedAt.localeCompare(b.changedAt));
  return map;
}

function everReached(history: StageEvent[], stage: string): boolean {
  return history.some((event) => event.toStage === stage);
}

function cohortMatches(key: CohortKey, lead: StageLeadSnapshot, history: StageEvent[], stagnantDays: number): boolean {
  const admitted = everReached(history, 'Seat Allotted') || lead.currentStage === 'Seat Allotted';
  const cleared = everReached(history, 'Entrance Exam Cleared') || lead.currentStage === 'Entrance Exam Cleared';
  const payment = everReached(history, 'Seat Confirmed: Payment Pending') || lead.currentStage === 'Seat Confirmed: Payment Pending';
  const visited = everReached(history, 'Visited School') || lead.currentStage === 'Visited School';
  const appointment = everReached(history, 'Appointment Scheduled to Visit the School') || lead.currentStage === 'Appointment Scheduled to Visit the School';
  const exam = everReached(history, 'Written Entrance Exam') || everReached(history, 'Re-Test') || ['Written Entrance Exam', 'Re-Test'].includes(lead.currentStage);
  const lost = LOST_STAGES.has(lead.currentStage) || history.some((event) => LOST_STAGES.has(event.toStage));
  const lastMovement = history.at(-1)?.changedAt || lead.updatedAt || lead.createdAt;
  const stagnant = lastMovement ? daysBetween(lastMovement, new Date().toISOString()) >= stagnantDays : false;

  switch (key) {
    case 'admitted': return admitted;
    case 'cleared_not_admitted': return cleared && !payment && !admitted;
    case 'payment_pending_not_allotted': return payment && !admitted;
    case 'visited_no_exam': return visited && !exam && !cleared && !admitted;
    case 'appointment_no_visit': return appointment && !visited;
    case 'lost_after_visit': return visited && lost && !admitted;
    case 'lost_after_clearance': return cleared && lost && !admitted;
    case 'stagnant': return stagnant && !admitted && !lost;
    default: return true;
  }
}

function leadFilterMatches(lead: StageLeadSnapshot, filters: StageReportFilters): boolean {
  const matches = (actual: string, expected?: string) => !expected || actual === expected;
  return matches(lead.academicYear, filters.academicYear)
    && matches(lead.institute, filters.institute)
    && matches(lead.grade, filters.grade)
    && matches(lead.programme, filters.programme)
    && matches(lead.salesperson, filters.salesperson)
    && matches(lead.leadSource, filters.leadSource);
}

function stageDate(history: StageEvent[], stage: string): string {
  return history.find((event) => event.toStage === stage)?.changedAt ?? '';
}

function firstLostDate(history: StageEvent[]): string {
  return history.find((event) => LOST_STAGES.has(event.toStage))?.changedAt ?? '';
}

function recommendedAction(lead: StageLeadSnapshot, history: StageEvent[]): string {
  const stage = lead.currentStage;
  if (stage === 'Entrance Exam Cleared') return lead.nextFollowUpDate ? 'Complete fee and scholarship counselling' : 'Set urgent fee-counselling follow-up';
  if (stage === 'Seat Confirmed: Payment Pending') return lead.nextFollowUpDate ? 'Follow promised payment date' : 'Record payment commitment and due date';
  if (stage === 'Visited School') return 'Schedule entrance exam and record visit outcome';
  if (stage === 'Appointment Scheduled to Visit the School') return 'Confirm visit and parent attendance';
  if (LOST_STAGES.has(stage)) return 'Review drop reason and recovery possibility';
  const last = history.at(-1)?.changedAt || lead.updatedAt;
  return last && daysBetween(last, new Date().toISOString()) >= 5 ? 'Lead is stagnant — contact and schedule next action' : 'Continue next scheduled follow-up';
}

function makeLeadRows(leads: StageLeadSnapshot[], historyMap: Map<number, StageEvent[]>): LeadJourneyRow[] {
  return leads.map((lead) => {
    const history = historyMap.get(lead.id) ?? [];
    const lastMovement = history.at(-1)?.changedAt || lead.updatedAt || lead.createdAt;
    return {
      id: lead.id,
      name: lead.name,
      contactName: lead.contactName,
      phone: lead.phone,
      currentStage: lead.currentStage,
      salesperson: lead.salesperson,
      institute: lead.institute,
      grade: lead.grade,
      programme: lead.programme,
      previousNeetScore: lead.previousNeetScore,
      appointmentDate: stageDate(history, 'Appointment Scheduled to Visit the School'),
      visitedDate: stageDate(history, 'Visited School'),
      examDate: stageDate(history, 'Written Entrance Exam') || stageDate(history, 'Re-Test'),
      clearedDate: stageDate(history, 'Entrance Exam Cleared'),
      paymentPendingDate: stageDate(history, 'Seat Confirmed: Payment Pending'),
      allottedDate: stageDate(history, 'Seat Allotted'),
      lostDate: firstLostDate(history),
      daysSinceLastMovement: lastMovement ? Math.floor(daysBetween(lastMovement, new Date().toISOString())) : 0,
      nextFollowUpDate: lead.nextFollowUpDate,
      recommendedAction: recommendedAction(lead, history),
    };
  }).sort((a, b) => b.daysSinceLastMovement - a.daysSinceLastMovement);
}

function makeTimeline(events: StageEvent[], stages: string[], granularity: StageReportFilters['granularity']): StageTimePoint[] {
  const buckets = new Map<string, Record<string, number>>();
  for (const event of events) {
    const bucket = bucketDate(event.changedAt, granularity);
    const row = buckets.get(bucket) ?? {};
    if (stages.includes(event.toStage)) row[`entries:${event.toStage}`] = (row[`entries:${event.toStage}`] ?? 0) + 1;
    if (stages.includes(event.fromStage)) row[`exits:${event.fromStage}`] = (row[`exits:${event.fromStage}`] ?? 0) + 1;
    buckets.set(bucket, row);
  }
  return Array.from(buckets.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([bucket, values]) => {
    const point: StageTimePoint = { bucket };
    for (const stage of stages) {
      const entries = values[`entries:${stage}`] ?? 0;
      const exits = values[`exits:${stage}`] ?? 0;
      point[`entries:${stage}`] = entries;
      point[`exits:${stage}`] = exits;
      point[`net:${stage}`] = entries - exits;
    }
    return point;
  });
}

function makeConversionMatrix(events: StageEvent[], historyMap: Map<number, StageEvent[]>): ConversionMatrixRow[] {
  const transitions = new Map<string, { from: string; to: string; leads: Set<number>; days: number[] }>();
  const fromPopulation = new Map<string, Set<number>>();
  for (const [leadId, history] of historyMap.entries()) {
    for (let index = 0; index < history.length; index += 1) {
      const current = history[index];
      const population = fromPopulation.get(current.toStage) ?? new Set<number>();
      population.add(leadId);
      fromPopulation.set(current.toStage, population);
      const next = history[index + 1];
      if (!next) continue;
      const key = `${current.toStage}→${next.toStage}`;
      const item = transitions.get(key) ?? { from: current.toStage, to: next.toStage, leads: new Set<number>(), days: [] };
      item.leads.add(leadId);
      item.days.push(daysBetween(current.changedAt, next.changedAt));
      transitions.set(key, item);
    }
  }
  return Array.from(transitions.values()).map((item) => {
    const denominator = fromPopulation.get(item.from)?.size ?? item.leads.size;
    return {
      fromStage: item.from,
      toStage: item.to,
      students: item.leads.size,
      conversionRate: denominator ? round(item.leads.size / denominator * 100) : 0,
      averageDays: item.days.length ? round(item.days.reduce((sum, value) => sum + value, 0) / item.days.length) : 0,
      medianDays: round(median(item.days)),
    };
  }).sort((a, b) => b.students - a.students);
}

function makeStageRegister(events: StageEvent[], leads: StageLeadSnapshot[], historyMap: Map<number, StageEvent[]>, stages: string[]): StageRegisterRow[] {
  const matrix = makeConversionMatrix(events, historyMap);
  return stages.map((stage) => {
    const entries = events.filter((event) => event.toStage === stage);
    const exits = events.filter((event) => event.fromStage === stage);
    const durations: number[] = [];
    let movedForward = 0;
    for (const history of historyMap.values()) {
      const index = history.findIndex((event) => event.toStage === stage);
      if (index >= 0 && history[index + 1]) {
        durations.push(daysBetween(history[index].changedAt, history[index + 1].changedAt));
        movedForward += 1;
      }
    }
    const uniqueStudents = new Set(entries.map((event) => event.leadId)).size;
    const currentBacklog = leads.filter((lead) => lead.currentStage === stage).length;
    const conversionRows = matrix.filter((row) => row.fromStage === stage);
    const conversionRate = conversionRows.length ? Math.max(...conversionRows.map((row) => row.conversionRate)) : 0;
    return {
      stage,
      entries: entries.length,
      exits: exits.length,
      net: entries.length - exits.length,
      uniqueStudents,
      currentBacklog,
      movedForward,
      conversionRate,
      averageDays: durations.length ? round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
      medianDays: round(median(durations)),
    };
  });
}

function makeMilestones(leads: StageLeadSnapshot[], historyMap: Map<number, StageEvent[]>): MilestoneRow[] {
  return MILESTONES.map((stage, index) => {
    const reachedLeads = leads.filter((lead) => everReached(historyMap.get(lead.id) ?? [], stage) || lead.currentStage === stage);
    const durations: number[] = [];
    if (index > 0) {
      const previous = MILESTONES[index - 1];
      for (const lead of reachedLeads) {
        const history = historyMap.get(lead.id) ?? [];
        const from = stageDate(history, previous);
        const to = stageDate(history, stage);
        if (from && to) durations.push(daysBetween(from, to));
      }
    }
    return {
      stage,
      reached: reachedLeads.length,
      cohortSize: leads.length,
      reachedRate: leads.length ? round(reachedLeads.length / leads.length * 100) : 0,
      averageDaysFromPrevious: durations.length ? round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0,
      medianDaysFromPrevious: round(median(durations)),
    };
  });
}

function makeCompliance(leads: StageLeadSnapshot[], historyMap: Map<number, StageEvent[]>): ComplianceRow[] {
  const configs = [
    { stage: 'Appointment Scheduled to Visit the School', needsScore: false, needsAmount: false },
    { stage: 'Visited School', needsScore: false, needsAmount: false },
    { stage: 'Entrance Exam Cleared', needsScore: true, needsAmount: false },
    { stage: 'Seat Confirmed: Payment Pending', needsScore: false, needsAmount: true },
  ];
  return configs.map((config) => {
    const relevant = leads.filter((lead) => everReached(historyMap.get(lead.id) ?? [], config.stage) || lead.currentStage === config.stage);
    const missingFollowUp = relevant.filter((lead) => !lead.nextFollowUpDate).length;
    const missingComment = relevant.filter((lead) => !lead.description.trim()).length;
    const missingScoreOrAmount = relevant.filter((lead) => config.needsScore ? !lead.entranceExamMarks : config.needsAmount ? lead.expectedRevenue <= 0 : false).length;
    return {
      milestone: config.stage,
      students: relevant.length,
      compliant: Math.max(0, relevant.length - new Set([
        ...relevant.filter((lead) => !lead.nextFollowUpDate).map((lead) => lead.id),
        ...relevant.filter((lead) => !lead.description.trim()).map((lead) => lead.id),
        ...relevant.filter((lead) => config.needsScore ? !lead.entranceExamMarks : config.needsAmount ? lead.expectedRevenue <= 0 : false).map((lead) => lead.id),
      ]).size),
      missingFollowUp,
      missingComment,
      missingScoreOrAmount,
    };
  });
}

function furthestMilestone(history: StageEvent[]): string {
  let furthest = 'Before appointment';
  if (everReached(history, 'Appointment Scheduled to Visit the School')) furthest = 'After appointment';
  if (everReached(history, 'Visited School')) furthest = 'After campus visit';
  if (everReached(history, 'Written Entrance Exam') || everReached(history, 'Re-Test')) furthest = 'After entrance exam';
  if (everReached(history, 'Entrance Exam Cleared')) furthest = 'After clearing exam';
  if (everReached(history, 'Seat Confirmed: Payment Pending')) furthest = 'After payment commitment';
  return furthest;
}

function makeLosses(leads: StageLeadSnapshot[], historyMap: Map<number, StageEvent[]>): LossRow[] {
  const lost = leads.filter((lead) => LOST_STAGES.has(lead.currentStage));
  const counts = new Map<string, number>();
  for (const lead of lost) {
    const point = furthestMilestone(historyMap.get(lead.id) ?? []);
    counts.set(point, (counts.get(point) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([dropPoint, students]) => ({
    dropPoint,
    students,
    share: lost.length ? round(students / lost.length * 100) : 0,
  })).sort((a, b) => b.students - a.students);
}

function makeForecast(allLeads: StageLeadSnapshot[], filteredLeads: StageLeadSnapshot[], allHistory: Map<number, StageEvent[]>): StageAnalyticsReport['forecast'] {
  const rows: ForecastRow[] = [];
  for (const stage of MILESTONES.slice(0, -1)) {
    const historicalReached = allLeads.filter((lead) => everReached(allHistory.get(lead.id) ?? [], stage) || lead.currentStage === stage);
    const historicalAdmitted = historicalReached.filter((lead) => everReached(allHistory.get(lead.id) ?? [], 'Seat Allotted') || lead.currentStage === 'Seat Allotted');
    const rate = historicalReached.length ? historicalAdmitted.length / historicalReached.length : 0;
    const current = filteredLeads.filter((lead) => lead.currentStage === stage).length;
    rows.push({
      stage,
      currentStudents: current,
      historicalAdmissionRate: round(rate * 100),
      expectedAdmissions: round(current * rate),
    });
  }
  const likely = round(rows.reduce((sum, row) => sum + row.expectedAdmissions, 0));
  return {
    likely,
    conservative: round(likely * 0.75),
    optimistic: round(likely * 1.25),
    rows,
  };
}

function makeOwnership(events: StageEvent[]): OwnershipRow[] {
  const counts = new Map<string, OwnershipRow>();
  for (const event of events) {
    const key = `${event.assignedSalesperson}→${event.changedBy}`;
    const row = counts.get(key) ?? {
      assignedSalesperson: event.assignedSalesperson || 'Unassigned',
      changedBy: event.changedBy || 'Unknown user',
      movements: 0,
      mismatch: Boolean(event.assignedSalesperson && event.changedBy && event.assignedSalesperson !== event.changedBy),
    };
    row.movements += 1;
    counts.set(key, row);
  }
  return Array.from(counts.values()).sort((a, b) => b.movements - a.movements);
}

function makeHeatmap(events: StageEvent[]): HeatmapCell[] {
  const counts = new Map<string, number>();
  for (const event of events) {
    const date = new Date(event.changedAt);
    if (Number.isNaN(date.getTime())) continue;
    const weekday = date.getUTCDay();
    const hour = (date.getUTCHours() + 5 + (date.getUTCMinutes() >= 30 ? 1 : 0)) % 24;
    const key = `${weekday}:${hour}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries()).map(([key, count]) => {
    const [weekday, hour] = key.split(':').map(Number);
    return { weekday, hour, count };
  });
}

export async function buildStageAnalyticsReport(filters: StageReportFilters): Promise<StageAnalyticsReport> {
  const [allEvents, allLeads, syncState] = await Promise.all([loadStageEvents(), loadStageLeads(), loadStageSyncState()]);
  const allHistory = historyByLead(allEvents);
  const stagnantDays = Math.max(1, filters.stagnantDays ?? 5);
  const leads = allLeads.filter((lead) => leadFilterMatches(lead, filters) && cohortMatches(filters.cohort, lead, allHistory.get(lead.id) ?? [], stagnantDays));
  const leadIds = new Set(leads.map((lead) => lead.id));
  const cohortEvents = allEvents.filter((event) => leadIds.has(event.leadId));
  const periodEvents = cohortEvents.filter((event) => withinDate(event.changedAt, filters.from, filters.to));
  const history = historyByLead(cohortEvents);
  const stages = filters.stages.length ? filters.stages : MILESTONES;
  const admitted = leads.filter((lead) => everReached(history.get(lead.id) ?? [], 'Seat Allotted') || lead.currentStage === 'Seat Allotted').length;
  const clearedNotAdmitted = leads.filter((lead) => cohortMatches('cleared_not_admitted', lead, history.get(lead.id) ?? [], stagnantDays)).length;
  const paymentPending = leads.filter((lead) => cohortMatches('payment_pending_not_allotted', lead, history.get(lead.id) ?? [], stagnantDays)).length;
  const visits = periodEvents.filter((event) => event.toStage === 'Visited School').length;
  const allStages = uniqueSorted([...EXACT_STAGE_ORDER, ...allEvents.flatMap((event) => [event.fromStage, event.toStage]), ...allLeads.map((lead) => lead.currentStage)]);

  return {
    generatedAt: new Date().toISOString(),
    syncState,
    filters,
    options: {
      stages: allStages,
      academicYears: uniqueSorted(allLeads.map((lead) => lead.academicYear)),
      institutes: uniqueSorted(allLeads.map((lead) => lead.institute)),
      grades: uniqueSorted(allLeads.map((lead) => lead.grade)),
      programmes: uniqueSorted(allLeads.map((lead) => lead.programme)),
      salespeople: uniqueSorted(allLeads.map((lead) => lead.salesperson)),
      leadSources: uniqueSorted(allLeads.map((lead) => lead.leadSource)),
    },
    summary: {
      cohortStudents: leads.length,
      stageEvents: periodEvents.length,
      admissions: admitted,
      clearedNotAdmitted,
      paymentPending,
      visits,
    },
    timeline: makeTimeline(periodEvents, stages, filters.granularity),
    stageRegister: makeStageRegister(periodEvents, leads, history, allStages),
    conversionMatrix: makeConversionMatrix(periodEvents, history),
    milestones: makeMilestones(leads, history),
    leads: makeLeadRows(leads, history),
    compliance: makeCompliance(leads, history),
    losses: makeLosses(leads, history),
    forecast: makeForecast(allLeads, leads, allHistory),
    ownership: makeOwnership(periodEvents),
    heatmap: makeHeatmap(periodEvents),
  };
}
