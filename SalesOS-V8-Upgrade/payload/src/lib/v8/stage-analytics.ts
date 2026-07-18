import type {
  StageAnalyticsFilters,
  StageCohort,
  StageEvent,
  StageLeadResult,
  StageSnapshot,
  StageStore,
} from "./stage-types";

const LOST_STAGES = [
  "seat rejected",
  "entrance exam failed",
  "not interested",
  "rejection approved",
  "withdrawn",
];
const INVALID_STAGES = ["wrong lead", "duplicates"];
const APPOINTMENT = "appointment scheduled to visit the school";
const VISITED = "visited school";
const WRITTEN_EXAM = "written entrance exam";
const RETEST = "re-test";
const CLEARED = "entrance exam cleared";
const PAYMENT_PENDING = "seat confirmed: payment pending";
const ALLOTTED = "seat allotted";

function stageKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function valueKey(value: string): string {
  return value.trim().toLowerCase();
}

function includesValue(filter: string, value: string): boolean {
  return !filter || filter === "ALL" || valueKey(filter) === valueKey(value);
}

function parseDate(value: string): Date {
  const normalised = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  return new Date(normalised);
}

function dayDiff(from: string, to: string): number {
  const difference = parseDate(to).getTime() - parseDate(from).getTime();
  return Math.max(0, difference / 86_400_000);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1] + ordered[middle]) / 2
    : ordered[middle];
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function shiftedDate(value: string): Date {
  const offset = Number(process.env.SALESOS_TIME_ZONE_OFFSET_MINUTES || 330);
  return new Date(parseDate(value).getTime() + offset * 60_000);
}

function bucketLabel(value: string, granularity: StageAnalyticsFilters["granularity"]): string {
  const date = shiftedDate(value);
  if (granularity === "month") {
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  if (granularity === "week") {
    const working = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const day = working.getUTCDay() || 7;
    working.setUTCDate(working.getUTCDate() - day + 1);
    return `${working.getUTCFullYear()}-${String(working.getUTCMonth() + 1).padStart(2, "0")}-${String(
      working.getUTCDate(),
    ).padStart(2, "0")}`;
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

function eventsByLead(events: StageEvent[]): Map<number, StageEvent[]> {
  const map = new Map<number, StageEvent[]>();
  for (const event of events) {
    const group = map.get(event.leadId) || [];
    group.push(event);
    map.set(event.leadId, group);
  }
  for (const group of map.values()) group.sort((a, b) => a.changedAt.localeCompare(b.changedAt));
  return map;
}

function hasReached(events: StageEvent[], stage: string): boolean {
  const target = stageKey(stage);
  return events.some((event) => stageKey(event.newStage) === target);
}

function isLostStage(stage: string): boolean {
  const key = stageKey(stage);
  return LOST_STAGES.includes(key);
}

function determineCohort(snapshot: StageSnapshot, history: StageEvent[]): StageCohort | "other" {
  const admitted = hasReached(history, ALLOTTED);
  if (admitted) return "admitted";

  const cleared = hasReached(history, CLEARED);
  const paymentPending = hasReached(history, PAYMENT_PENDING);
  if (cleared && !paymentPending && !admitted) return "cleared_not_admitted";
  if (paymentPending && !admitted) return "payment_pending_not_allotted";

  const visited = hasReached(history, VISITED);
  const examReached =
    hasReached(history, WRITTEN_EXAM) || hasReached(history, RETEST) || hasReached(history, CLEARED);
  if (visited && !examReached) return "visited_not_exam";
  if (visited && isLostStage(snapshot.currentStage)) return "lost_after_visit";
  return "other";
}

function cohortMatches(cohort: StageCohort, actual: StageCohort | "other"): boolean {
  return cohort === "all" || cohort === actual;
}

function milestoneDates(history: StageEvent[]): Record<string, string> {
  const milestones: Record<string, string> = {};
  const aliases: Array<[string, string[]]> = [
    ["Appointment scheduled", [APPOINTMENT]],
    ["Visited School", [VISITED]],
    ["Written Entrance Exam", [WRITTEN_EXAM, RETEST]],
    ["Entrance Exam Cleared", [CLEARED]],
    ["Payment Pending", [PAYMENT_PENDING]],
    ["Seat Allotted", [ALLOTTED]],
  ];

  for (const [label, stages] of aliases) {
    const match = history.find((event) => stages.includes(stageKey(event.newStage)));
    if (match) milestones[label] = match.changedAt;
  }
  return milestones;
}

function snapshotMatches(snapshot: StageSnapshot, filters: StageAnalyticsFilters): boolean {
  return (
    includesValue(filters.academicYear, snapshot.academicYear) &&
    includesValue(filters.institute, snapshot.institute) &&
    includesValue(filters.grade, snapshot.grade) &&
    includesValue(filters.product, snapshot.product) &&
    includesValue(filters.salesperson, snapshot.assignedSalesperson)
  );
}

export function analyseStageStore(store: StageStore, filters: StageAnalyticsFilters) {
  const grouped = eventsByLead(store.events);
  const from = filters.from ? new Date(`${filters.from}T00:00:00.000Z`).getTime() : Number.MIN_SAFE_INTEGER;
  const to = filters.to ? new Date(`${filters.to}T23:59:59.999Z`).getTime() : Number.MAX_SAFE_INTEGER;
  const selectedStages = new Set(filters.stages.map(stageKey));

  const eligibleSnapshots = store.snapshots.filter((snapshot) => {
    if (!snapshotMatches(snapshot, filters)) return false;
    const history = grouped.get(snapshot.leadId) || [];
    return cohortMatches(filters.cohort, determineCohort(snapshot, history));
  });
  const eligibleLeadIds = new Set(eligibleSnapshots.map((snapshot) => snapshot.leadId));

  const events = store.events.filter((event) => {
    if (!eligibleLeadIds.has(event.leadId)) return false;
    const timestamp = parseDate(event.changedAt).getTime();
    if (timestamp < from || timestamp > to) return false;
    return selectedStages.size === 0 || selectedStages.has(stageKey(event.newStage));
  });

  const allStageNames = store.stages.map((stage) => stage.name);
  const visibleStages = filters.stages.length ? filters.stages : allStageNames;

  const timelineMap = new Map<string, Record<string, number | string>>();
  for (const event of events) {
    const bucket = bucketLabel(event.changedAt, filters.granularity);
    const row = timelineMap.get(bucket) || { bucket };
    row[event.newStage] = Number(row[event.newStage] || 0) + 1;
    row["Total stage entries"] = Number(row["Total stage entries"] || 0) + 1;
    timelineMap.set(bucket, row);
  }
  const timeline = Array.from(timelineMap.values()).sort((a, b) =>
    String(a.bucket).localeCompare(String(b.bucket)),
  );

  const stageStats = visibleStages.map((stageName) => {
    const key = stageKey(stageName);
    const entries = events.filter((event) => stageKey(event.newStage) === key);
    const exits = store.events.filter(
      (event) => eligibleLeadIds.has(event.leadId) && stageKey(event.oldStage) === key,
    );
    const current = eligibleSnapshots.filter((snapshot) => stageKey(snapshot.currentStage) === key);
    return {
      stage: stageName,
      entries: entries.length,
      exits: exits.length,
      net: entries.length - exits.length,
      uniqueLeads: new Set(entries.map((event) => event.leadId)).size,
      currentBacklog: current.length,
      expectedRevenue: current.reduce((sum, lead) => sum + lead.expectedRevenue, 0),
    };
  });

  const conversionMap = new Map<
    string,
    { fromStage: string; toStage: string; leadIds: Set<number>; durations: number[] }
  >();
  for (const snapshot of eligibleSnapshots) {
    const history = (grouped.get(snapshot.leadId) || []).filter((event) => !event.synthetic);
    for (let index = 1; index < history.length; index += 1) {
      const previous = history[index - 1];
      const current = history[index];
      const fromStage = previous.newStage || current.oldStage;
      const toStage = current.newStage;
      if (!fromStage || !toStage || stageKey(fromStage) === stageKey(toStage)) continue;
      const key = `${stageKey(fromStage)}>${stageKey(toStage)}`;
      const record = conversionMap.get(key) || {
        fromStage,
        toStage,
        leadIds: new Set<number>(),
        durations: [],
      };
      record.leadIds.add(snapshot.leadId);
      record.durations.push(dayDiff(previous.changedAt, current.changedAt));
      conversionMap.set(key, record);
    }
  }

  const fromStageTotals = new Map<string, Set<number>>();
  for (const record of conversionMap.values()) {
    const key = stageKey(record.fromStage);
    const set = fromStageTotals.get(key) || new Set<number>();
    for (const leadId of record.leadIds) set.add(leadId);
    fromStageTotals.set(key, set);
  }

  const conversionMatrix = Array.from(conversionMap.values())
    .map((record) => {
      const denominator = fromStageTotals.get(stageKey(record.fromStage))?.size || 0;
      return {
        fromStage: record.fromStage,
        toStage: record.toStage,
        students: record.leadIds.size,
        conversionRate: denominator ? (record.leadIds.size / denominator) * 100 : 0,
        medianDays: median(record.durations),
        averageDays: mean(record.durations),
      };
    })
    .sort((a, b) => b.students - a.students);

  const now = new Date().toISOString();
  const leads: StageLeadResult[] = eligibleSnapshots.map((snapshot) => {
    const history = grouped.get(snapshot.leadId) || [];
    const lastMovement = history[history.length - 1]?.changedAt || snapshot.createdAt;
    return {
      ...snapshot,
      cohort: determineCohort(snapshot, history),
      milestoneDates: milestoneDates(history),
      daysSinceLastMovement: Math.round(dayDiff(lastMovement, now) * 10) / 10,
    };
  });

  const admissionDurations: number[] = [];
  for (const lead of leads.filter((lead) => lead.cohort === "admitted")) {
    const history = grouped.get(lead.leadId) || [];
    const created = history.find((event) => event.synthetic)?.changedAt || lead.createdAt;
    const admitted = history.find((event) => stageKey(event.newStage) === ALLOTTED)?.changedAt;
    if (created && admitted) admissionDurations.push(dayDiff(created, admitted));
  }

  const journeyMilestones = [
    "Appointment scheduled",
    "Visited School",
    "Written Entrance Exam",
    "Entrance Exam Cleared",
    "Payment Pending",
    "Seat Allotted",
  ];
  const journey = journeyMilestones.map((milestone) => {
    const values = leads
      .map((lead) => lead.milestoneDates[milestone])
      .filter((value): value is string => Boolean(value));
    return {
      milestone,
      students: values.length,
      shareOfCohort: eligibleSnapshots.length ? (values.length / eligibleSnapshots.length) * 100 : 0,
    };
  });

  const distinct = (selector: (snapshot: StageSnapshot) => string) =>
    Array.from(new Set(store.snapshots.map(selector).filter(Boolean))).sort();

  return {
    generatedAt: new Date().toISOString(),
    metadata: {
      lastSyncedAt: store.lastSyncedAt,
      eventCount: store.events.length,
      snapshotCount: store.snapshots.length,
      stages: allStageNames,
      academicYears: distinct((lead) => lead.academicYear),
      institutes: distinct((lead) => lead.institute),
      grades: distinct((lead) => lead.grade),
      products: distinct((lead) => lead.product),
      salespeople: distinct((lead) => lead.assignedSalesperson),
    },
    filters,
    summary: {
      stageEntries: events.length,
      uniqueStudents: new Set(events.map((event) => event.leadId)).size,
      cohortStudents: eligibleSnapshots.length,
      admitted: leads.filter((lead) => lead.cohort === "admitted").length,
      clearedNotAdmitted: leads.filter((lead) => lead.cohort === "cleared_not_admitted").length,
      paymentPending: leads.filter((lead) => lead.cohort === "payment_pending_not_allotted").length,
      medianDaysToAdmission: median(admissionDurations),
      averageDaysToAdmission: mean(admissionDurations),
    },
    timeline,
    stageStats,
    conversionMatrix,
    journey,
    leads: leads.sort((a, b) => b.daysSinceLastMovement - a.daysSinceLastMovement).slice(0, 1000),
    invalidExcluded: eligibleSnapshots.filter((lead) =>
      INVALID_STAGES.includes(stageKey(lead.currentStage)),
    ).length,
  };
}
