export type StageChartType = 'bar' | 'line' | 'area';
export type StageAxis = 'left' | 'right';
export type DateGranularity = 'day' | 'week' | 'month' | 'quarter';

export type CohortKey =
  | 'all'
  | 'admitted'
  | 'cleared_not_admitted'
  | 'payment_pending_not_allotted'
  | 'visited_no_exam'
  | 'appointment_no_visit'
  | 'lost_after_visit'
  | 'lost_after_clearance'
  | 'stagnant';

export interface StageEvent {
  id: string;
  trackingId?: number;
  leadId: number;
  leadName: string;
  fromStage: string;
  toStage: string;
  changedAt: string;
  changedById?: number;
  changedBy: string;
  assignedSalespersonId?: number;
  assignedSalesperson: string;
  academicYear: string;
  institute: string;
  grade: string;
  programme: string;
  leadSource: string;
  team: string;
  expectedRevenue: number;
}

export interface StageLeadSnapshot {
  id: number;
  name: string;
  contactName: string;
  phone: string;
  email: string;
  currentStage: string;
  salespersonId?: number;
  salesperson: string;
  team: string;
  academicYear: string;
  institute: string;
  grade: string;
  programme: string;
  leadSource: string;
  previousNeetScore: string;
  entranceExamMarks: string;
  expectedRevenue: number;
  createdAt: string;
  updatedAt: string;
  nextFollowUpDate: string;
  description: string;
  properties: Record<string, unknown>;
}

export interface StageSyncState {
  schemaVersion: 1;
  lastFullSyncAt: string | null;
  lastIncrementalSyncAt: string | null;
  lastTrackingDate: string | null;
  lastLeadWriteDate: string | null;
  eventCount: number;
  leadCount: number;
  warning?: string;
}

export interface StageReportFilters {
  from: string;
  to: string;
  granularity: DateGranularity;
  academicYear?: string;
  institute?: string;
  grade?: string;
  programme?: string;
  salesperson?: string;
  leadSource?: string;
  cohort: CohortKey;
  stages: string[];
  stagnantDays?: number;
}

export interface StageSeriesConfig {
  id: string;
  stage: string;
  metric: 'entries' | 'exits' | 'net' | 'unique' | 'conversion';
  chartType: StageChartType;
  axis: StageAxis;
  stackId?: string;
}

export interface StageTimePoint {
  bucket: string;
  [seriesKey: string]: string | number;
}

export interface StageRegisterRow {
  stage: string;
  entries: number;
  exits: number;
  net: number;
  uniqueStudents: number;
  currentBacklog: number;
  movedForward: number;
  conversionRate: number;
  averageDays: number;
  medianDays: number;
}

export interface ConversionMatrixRow {
  fromStage: string;
  toStage: string;
  students: number;
  conversionRate: number;
  averageDays: number;
  medianDays: number;
}

export interface MilestoneRow {
  stage: string;
  reached: number;
  cohortSize: number;
  reachedRate: number;
  averageDaysFromPrevious: number;
  medianDaysFromPrevious: number;
}

export interface LeadJourneyRow {
  id: number;
  name: string;
  contactName: string;
  phone: string;
  currentStage: string;
  salesperson: string;
  institute: string;
  grade: string;
  programme: string;
  previousNeetScore: string;
  appointmentDate: string;
  visitedDate: string;
  examDate: string;
  clearedDate: string;
  paymentPendingDate: string;
  allottedDate: string;
  lostDate: string;
  daysSinceLastMovement: number;
  nextFollowUpDate: string;
  recommendedAction: string;
}

export interface ComplianceRow {
  milestone: string;
  students: number;
  compliant: number;
  missingFollowUp: number;
  missingComment: number;
  missingScoreOrAmount: number;
}

export interface LossRow {
  dropPoint: string;
  students: number;
  share: number;
}

export interface ForecastRow {
  stage: string;
  currentStudents: number;
  historicalAdmissionRate: number;
  expectedAdmissions: number;
}

export interface OwnershipRow {
  assignedSalesperson: string;
  changedBy: string;
  movements: number;
  mismatch: boolean;
}

export interface HeatmapCell {
  weekday: number;
  hour: number;
  count: number;
}

export interface SavedStageReport {
  id: string;
  name: string;
  createdAt: string;
  filters: StageReportFilters;
  series: StageSeriesConfig[];
}

export interface StageAnalyticsReport {
  generatedAt: string;
  syncState: StageSyncState;
  filters: StageReportFilters;
  options: {
    stages: string[];
    academicYears: string[];
    institutes: string[];
    grades: string[];
    programmes: string[];
    salespeople: string[];
    leadSources: string[];
  };
  summary: {
    cohortStudents: number;
    stageEvents: number;
    admissions: number;
    clearedNotAdmitted: number;
    paymentPending: number;
    visits: number;
  };
  timeline: StageTimePoint[];
  stageRegister: StageRegisterRow[];
  conversionMatrix: ConversionMatrixRow[];
  milestones: MilestoneRow[];
  leads: LeadJourneyRow[];
  compliance: ComplianceRow[];
  losses: LossRow[];
  forecast: {
    likely: number;
    conservative: number;
    optimistic: number;
    rows: ForecastRow[];
  };
  ownership: OwnershipRow[];
  heatmap: HeatmapCell[];
}
