export type StageEvent = {
  id: string;
  trackingId: number | null;
  messageId: number | null;
  leadId: number;
  leadName: string;
  contactName: string;
  changedAt: string;
  changedById: number | null;
  changedBy: string;
  assignedSalespersonId: number | null;
  assignedSalesperson: string;
  oldStageId: number | null;
  oldStage: string;
  newStageId: number | null;
  newStage: string;
  currentStageId: number | null;
  currentStage: string;
  academicYear: string;
  institute: string;
  grade: string;
  product: string;
  source: string;
  expectedRevenue: number;
  phone: string;
  email: string;
  synthetic?: boolean;
};

export type StageSnapshot = {
  leadId: number;
  leadName: string;
  contactName: string;
  createdAt: string;
  updatedAt: string;
  currentStageId: number | null;
  currentStage: string;
  assignedSalespersonId: number | null;
  assignedSalesperson: string;
  academicYear: string;
  institute: string;
  grade: string;
  product: string;
  source: string;
  expectedRevenue: number;
  phone: string;
  email: string;
};

export type StageStore = {
  version: 1;
  generatedAt: string;
  lastSyncedAt: string;
  stages: Array<{ id: number; name: string; sequence: number }>;
  events: StageEvent[];
  snapshots: StageSnapshot[];
  sync: {
    fullFrom: string;
    fullTo: string;
    latestMessageId: number;
    latestMessageDate: string;
  };
};

export type StageCohort =
  | "all"
  | "admitted"
  | "cleared_not_admitted"
  | "payment_pending_not_allotted"
  | "visited_not_exam"
  | "lost_after_visit";

export type StageAnalyticsFilters = {
  from: string;
  to: string;
  academicYear: string;
  institute: string;
  grade: string;
  product: string;
  salesperson: string;
  cohort: StageCohort;
  stages: string[];
  granularity: "day" | "week" | "month";
};

export type StageLeadResult = StageSnapshot & {
  cohort: StageCohort | "other";
  milestoneDates: Record<string, string>;
  daysSinceLastMovement: number;
};
