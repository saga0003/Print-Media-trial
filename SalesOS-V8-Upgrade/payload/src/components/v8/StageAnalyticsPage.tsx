"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  BarChart3,
  CalendarRange,
  Download,
  ExternalLink,
  Info,
  Loader2,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Metadata = {
  lastSyncedAt: string;
  eventCount: number;
  snapshotCount: number;
  stages: string[];
  academicYears: string[];
  institutes: string[];
  grades: string[];
  products: string[];
  salespeople: string[];
};

type AnalyticsData = {
  metadata: Metadata;
  summary: {
    stageEntries: number;
    uniqueStudents: number;
    cohortStudents: number;
    admitted: number;
    clearedNotAdmitted: number;
    paymentPending: number;
    medianDaysToAdmission: number;
    averageDaysToAdmission: number;
  };
  timeline: Array<Record<string, number | string>>;
  stageStats: Array<{
    stage: string;
    entries: number;
    exits: number;
    net: number;
    uniqueLeads: number;
    currentBacklog: number;
    expectedRevenue: number;
  }>;
  conversionMatrix: Array<{
    fromStage: string;
    toStage: string;
    students: number;
    conversionRate: number;
    medianDays: number;
    averageDays: number;
  }>;
  journey: Array<{ milestone: string; students: number; shareOfCohort: number }>;
  leads: Array<{
    leadId: number;
    leadName: string;
    contactName: string;
    currentStage: string;
    assignedSalesperson: string;
    academicYear: string;
    institute: string;
    grade: string;
    product: string;
    phone: string;
    expectedRevenue: number;
    cohort: string;
    milestoneDates: Record<string, string>;
    daysSinceLastMovement: number;
  }>;
  connection?: { recordBaseUrl?: string };
};

type FilterState = {
  from: string;
  to: string;
  academicYear: string;
  institute: string;
  grade: string;
  product: string;
  salesperson: string;
  cohort: string;
  granularity: "day" | "week" | "month";
  stages: string[];
};

type SeriesConfig = {
  id: string;
  stage: string;
  type: "bar" | "line" | "area";
  axis: "left" | "right";
};

const palette = ["#079669", "#0284c7", "#7c3aed", "#ea580c", "#dc2626"];

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function initialFilters(): FilterState {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 90);
  return {
    from: isoDate(from),
    to: isoDate(to),
    academicYear: "ALL",
    institute: "ALL",
    grade: "ALL",
    product: "ALL",
    salesperson: "ALL",
    cohort: "all",
    granularity: "week",
    stages: [],
  };
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1 text-[11px] uppercase tracking-[0.08em] text-slate-500">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm normal-case tracking-normal text-slate-800 outline-none transition focus:border-emerald-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <option value="ALL">All</option>
        {options.filter((option) => option && option !== "Not set").map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function InfoLabel({ text }: { text: string }) {
  return (
    <span title={text} className="inline-flex cursor-help text-slate-400">
      <Info size={14} />
    </span>
  );
}

function MetricCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string | number;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-center justify-between text-xs uppercase tracking-[0.08em] text-slate-500">
        <span>{label}</span>
        <InfoLabel text={description} />
      </div>
      <div className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{value}</div>
    </div>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value.includes("T") ? value : value.replace(" ", "T") + "Z");
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(date);
}

function downloadCsv(rows: Array<Record<string, unknown>>, fileName: string) {
  if (!rows.length) return;
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function StageAnalyticsPage() {
  const [draft, setDraft] = useState<FilterState>(initialFilters);
  const [applied, setApplied] = useState<FilterState>(initialFilters);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"trends" | "cohorts" | "conversion" | "journey" | "studio">("trends");
  const [series, setSeries] = useState<SeriesConfig[]>([]);
  const [reportName, setReportName] = useState("");
  const [savedReports, setSavedReports] = useState<Array<{ id: string; name: string; config: Record<string, unknown> }>>([]);

  const fetchAnalytics = useCallback(async (filters: FilterState) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        from: filters.from,
        to: filters.to,
        academicYear: filters.academicYear,
        institute: filters.institute,
        grade: filters.grade,
        product: filters.product,
        salesperson: filters.salesperson,
        cohort: filters.cohort,
        granularity: filters.granularity,
        stages: filters.stages.join("|"),
      });
      const response = await fetch(`/api/v8/stage-analytics?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to load stage analytics");
      setData(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load stage analytics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics(applied);
    fetch("/api/v8/stage-reports")
      .then((response) => response.json())
      .then((payload) => setSavedReports(payload.reports || []))
      .catch(() => undefined);
  }, [applied, fetchAnalytics]);

  useEffect(() => {
    if (!data?.metadata.stages.length || series.length) return;
    const preferred = [
      "Appointment Scheduled to Visit the School",
      "Visited School",
      "Written Entrance Exam",
      "Entrance Exam Cleared",
      "Seat Allotted",
    ];
    const stages = preferred
      .map((name) => data.metadata.stages.find((stage) => stage.toLowerCase() === name.toLowerCase()))
      .filter((value): value is string => Boolean(value));
    const fallbacks = data.metadata.stages.filter((stage) => !stages.includes(stage));
    const selected = [...stages, ...fallbacks].slice(0, 5);
    setSeries(
      selected.map((stage, index) => ({
        id: `series-${index}`,
        stage,
        type: index < 2 ? "bar" : index === 4 ? "area" : "line",
        axis: index === 4 ? "right" : "left",
      })),
    );
  }, [data, series.length]);

  const syncHistory = async (force = false) => {
    setSyncing(true);
    setError("");
    try {
      const response = await fetch("/api/v8/stage-sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ force, from: force ? draft.from : undefined, to: draft.to }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Sync failed");
      await fetchAnalytics(applied);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const applyFilters = () => setApplied({ ...draft });

  const visibleSeries = series.filter((item) => item.stage);
  const stageOptions = data?.metadata.stages || [];
  const recordBaseUrl = data?.connection?.recordBaseUrl || "";

  const stageLeadCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const lead of data?.leads || []) map.set(lead.currentStage, (map.get(lead.currentStage) || 0) + 1);
    return map;
  }, [data]);

  const saveReport = async () => {
    const name = reportName.trim();
    if (!name) return;
    const response = await fetch("/api/v8/stage-reports", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, config: { filters: applied, series, activeTab } }),
    });
    const payload = await response.json();
    if (payload.ok) {
      setSavedReports(payload.reports || []);
      setReportName("");
    }
  };

  const loadReport = (config: Record<string, unknown>) => {
    const reportFilters = config.filters as FilterState | undefined;
    const reportSeries = config.series as SeriesConfig[] | undefined;
    const tab = config.activeTab as typeof activeTab | undefined;
    if (reportFilters) {
      setDraft(reportFilters);
      setApplied(reportFilters);
    }
    if (reportSeries) setSeries(reportSeries);
    if (tab) setActiveTab(tab);
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-[1720px] p-4 md:p-6">
        <header className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.12em] text-emerald-600">
              <Activity size={14} /> Live Odoo stage-event intelligence
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Stage Journey Analytics</h1>
            <p className="mt-1 text-sm text-slate-500">
              Historical appointment, visit, examination, payment and admission movement—without reloading Odoo for every filter.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="/"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              Command Center
            </a>
            <button
              onClick={() => syncHistory(false)}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 disabled:opacity-60 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
            >
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Sync Odoo history
            </button>
          </div>
        </header>

        {error && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

        <section className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <SlidersHorizontal size={16} /> Analysis filters
              <InfoLabel text="Changing these fields does nothing until Apply filters is clicked. Apply reads the local stage-event cache; it does not pull Odoo again." />
            </div>
            <span className="text-xs text-slate-500">
              Last sync: {data?.metadata.lastSyncedAt ? formatDate(data.metadata.lastSyncedAt) : "Not synced"}
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <label className="grid gap-1 text-[11px] uppercase tracking-[0.08em] text-slate-500">
              From
              <input type="date" value={draft.from} onChange={(event) => setDraft({ ...draft, from: event.target.value })} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
            </label>
            <label className="grid gap-1 text-[11px] uppercase tracking-[0.08em] text-slate-500">
              To
              <input type="date" value={draft.to} onChange={(event) => setDraft({ ...draft, to: event.target.value })} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
            </label>
            <SelectField label="Academic year" value={draft.academicYear} options={data?.metadata.academicYears || []} onChange={(value) => setDraft({ ...draft, academicYear: value })} />
            <SelectField label="Institute" value={draft.institute} options={data?.metadata.institutes || []} onChange={(value) => setDraft({ ...draft, institute: value })} />
            <SelectField label="Grade" value={draft.grade} options={data?.metadata.grades || []} onChange={(value) => setDraft({ ...draft, grade: value })} />
            <SelectField label="Programme" value={draft.product} options={data?.metadata.products || []} onChange={(value) => setDraft({ ...draft, product: value })} />
            <SelectField label="Salesperson" value={draft.salesperson} options={data?.metadata.salespeople || []} onChange={(value) => setDraft({ ...draft, salesperson: value })} />
            <label className="grid gap-1 text-[11px] uppercase tracking-[0.08em] text-slate-500">
              Cohort
              <select value={draft.cohort} onChange={(event) => setDraft({ ...draft, cohort: event.target.value })} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm normal-case tracking-normal dark:border-slate-700 dark:bg-slate-900">
                <option value="all">All students</option>
                <option value="admitted">Admitted students</option>
                <option value="cleared_not_admitted">Exam cleared, not admitted</option>
                <option value="payment_pending_not_allotted">Payment pending, not allotted</option>
                <option value="visited_not_exam">Visited, did not write exam</option>
                <option value="lost_after_visit">Lost after campus visit</option>
              </select>
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              Granularity
              <select value={draft.granularity} onChange={(event) => setDraft({ ...draft, granularity: event.target.value as FilterState["granularity"] })} className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </label>
            <button onClick={applyFilters} className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm text-white shadow-sm dark:bg-white dark:text-slate-950">
              Apply filters
            </button>
            <button onClick={() => setDraft(initialFilters())} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm dark:border-slate-700">
              Reset draft
            </button>
            <span className="text-xs text-slate-500">
              Cache: {data?.metadata.eventCount || 0} stage events · {data?.metadata.snapshotCount || 0} leads
            </span>
          </div>
        </section>

        <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <MetricCard label="Stage entries" value={data?.summary.stageEntries || 0} description="Tracked entries into selected stages during the applied From/To period." />
          <MetricCard label="Unique students" value={data?.summary.uniqueStudents || 0} description="Distinct students with at least one selected stage event in the applied period." />
          <MetricCard label="Cohort size" value={data?.summary.cohortStudents || 0} description="Students matching the selected final-outcome cohort and all classification filters." />
          <MetricCard label="Admitted" value={data?.summary.admitted || 0} description="Students who reached the exact Odoo stage Seat Allotted at any time." />
          <MetricCard label="Cleared, not joined" value={data?.summary.clearedNotAdmitted || 0} description="Reached Entrance Exam Cleared but never reached Payment Pending or Seat Allotted." />
          <MetricCard label="Median close time" value={`${(data?.summary.medianDaysToAdmission || 0).toFixed(1)} days`} description="Median elapsed days from lead creation to first entry into Seat Allotted for admitted students." />
        </section>

        <nav className="mb-4 flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-950">
          {[
            ["trends", "Stage Trends"],
            ["cohorts", "Cohort Leads"],
            ["conversion", "Conversion Matrix"],
            ["journey", "Journey"],
            ["studio", "Chart Studio Pro"],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setActiveTab(key as typeof activeTab)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm ${activeTab === key ? "bg-emerald-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-900"}`}>
              {label}
            </button>
          ))}
        </nav>

        {loading && (
          <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <Loader2 className="animate-spin text-emerald-600" />
          </div>
        )}

        {!loading && activeTab === "trends" && data && (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(360px,0.8fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Stage movement trend</h2>
                  <p className="text-sm text-slate-500">Entries into each selected stage, using the actual tracked stage-change date.</p>
                </div>
                <button onClick={() => downloadCsv(data.timeline, "salesos-stage-trend.csv")} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700">
                  <Download size={15} /> Export
                </button>
              </div>
              <div className="h-[460px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={data.timeline} margin={{ top: 15, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} />
                    <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="left" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <YAxis yAxisId="right" orientation="right" allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value, name) => [Number(value).toLocaleString("en-IN"), String(name)]} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {visibleSeries.map((item, index) => {
                      const common = { key: item.id, dataKey: item.stage, name: item.stage, yAxisId: item.axis, stroke: palette[index], fill: palette[index] };
                      if (item.type === "line") return <Line {...common} type="monotone" strokeWidth={2.2} dot={{ r: 3 }} connectNulls />;
                      if (item.type === "area") return <Area {...common} type="monotone" fillOpacity={0.14} strokeWidth={2} connectNulls />;
                      return <Bar {...common} radius={[5, 5, 0, 0]} maxBarSize={42} />;
                    })}
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <h2 className="text-lg font-semibold">Stage register</h2>
              <p className="mb-3 text-sm text-slate-500">Entries, exits and current backlog for every exact Odoo stage.</p>
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white text-left text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950">
                    <tr><th className="py-2">Stage</th><th>In</th><th>Out</th><th>Current</th></tr>
                  </thead>
                  <tbody>
                    {data.stageStats.map((row) => (
                      <tr key={row.stage} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="py-3 pr-3"><div className="font-medium">{row.stage}</div><div className="text-xs text-slate-400">{money(row.expectedRevenue)}</div></td>
                        <td>{row.entries}</td><td>{row.exits}</td><td>{row.currentBacklog}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {!loading && activeTab === "cohorts" && data && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-4 flex items-center justify-between">
              <div><h2 className="text-lg font-semibold">Students in selected cohort</h2><p className="text-sm text-slate-500">Click Open to inspect the original lead in Odoo.</p></div>
              <button onClick={() => downloadCsv(data.leads.map((lead) => ({ ...lead, milestoneDates: JSON.stringify(lead.milestoneDates) })), "salesos-stage-cohort.csv")} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"><Download size={15} /> Export</button>
            </div>
            <div className="overflow-auto">
              <table className="min-w-[1250px] w-full text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-2">Student</th><th>Current stage</th><th>Salesperson</th><th>Institute / Grade</th><th>Appointment</th><th>Visited</th><th>Exam</th><th>Cleared</th><th>Payment</th><th>Allotted</th><th>Idle</th><th></th></tr></thead>
                <tbody>
                  {data.leads.map((lead) => (
                    <tr key={lead.leadId} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-3"><div className="font-medium">{lead.leadName}</div><div className="text-xs text-slate-400">#{lead.leadId} · {lead.phone}</div></td>
                      <td>{lead.currentStage}</td><td>{lead.assignedSalesperson}</td><td>{lead.institute}<div className="text-xs text-slate-400">{lead.grade} · {lead.product}</div></td>
                      <td>{formatDate(lead.milestoneDates["Appointment scheduled"])}</td><td>{formatDate(lead.milestoneDates["Visited School"])}</td><td>{formatDate(lead.milestoneDates["Written Entrance Exam"])}</td><td>{formatDate(lead.milestoneDates["Entrance Exam Cleared"])}</td><td>{formatDate(lead.milestoneDates["Payment Pending"])}</td><td>{formatDate(lead.milestoneDates["Seat Allotted"])}</td>
                      <td>{lead.daysSinceLastMovement.toFixed(0)}d</td>
                      <td>{recordBaseUrl && <a href={`${recordBaseUrl}${lead.leadId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-emerald-600">Open <ExternalLink size={13} /></a>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!loading && activeTab === "conversion" && data && (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-lg font-semibold">Stage conversion matrix</h2>
            <p className="mb-4 text-sm text-slate-500">Actual consecutive stage movements, with median and average elapsed days.</p>
            <div className="overflow-auto"><table className="min-w-[850px] w-full text-sm"><thead className="text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="py-2">From stage</th><th>To stage</th><th>Students</th><th>Conversion</th><th>Median days</th><th>Average days</th></tr></thead><tbody>{data.conversionMatrix.map((row, index) => <tr key={`${row.fromStage}-${row.toStage}-${index}`} className="border-t border-slate-100 dark:border-slate-800"><td className="py-3">{row.fromStage}</td><td>{row.toStage}</td><td>{row.students}</td><td>{row.conversionRate.toFixed(1)}%</td><td>{row.medianDays.toFixed(1)}</td><td>{row.averageDays.toFixed(1)}</td></tr>)}</tbody></table></div>
          </section>
        )}

        {!loading && activeTab === "journey" && data && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <h2 className="text-lg font-semibold">Milestone journey</h2>
            <p className="mb-5 text-sm text-slate-500">Share of the selected cohort that reached each important admissions milestone.</p>
            <div className="grid gap-4 lg:grid-cols-3">
              {data.journey.map((row, index) => (
                <div key={row.milestone} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
                  <div className="flex items-center justify-between"><span className="text-sm font-medium">{row.milestone}</span><span className="text-lg font-semibold">{row.students}</span></div>
                  <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded-full" style={{ width: `${Math.min(100, row.shareOfCohort)}%`, backgroundColor: palette[index % palette.length] }} /></div>
                  <div className="mt-2 text-xs text-slate-500">{row.shareOfCohort.toFixed(1)}% of cohort</div>
                </div>
              ))}
            </div>
          </section>
        )}

        {!loading && activeTab === "studio" && data && (
          <div className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <div className="mb-3 flex items-center gap-2"><BarChart3 size={18} /><h2 className="text-lg font-semibold">Chart Studio Pro</h2></div>
              <p className="mb-4 text-sm text-slate-500">Combine up to five stage series as bars, lines or areas. Use the right axis when one series dominates the others.</p>
              <div className="grid gap-3">
                {series.map((item, index) => (
                  <div key={item.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">Series {index + 1}</div>
                    <select value={item.stage} onChange={(event) => setSeries(series.map((seriesItem) => seriesItem.id === item.id ? { ...seriesItem, stage: event.target.value } : seriesItem))} className="mb-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="">Disabled</option>{stageOptions.map((stage) => <option key={stage} value={stage}>{stage}</option>)}</select>
                    <div className="grid grid-cols-2 gap-2"><select value={item.type} onChange={(event) => setSeries(series.map((seriesItem) => seriesItem.id === item.id ? { ...seriesItem, type: event.target.value as SeriesConfig["type"] } : seriesItem))} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="bar">Bar</option><option value="line">Line</option><option value="area">Area</option></select><select value={item.axis} onChange={(event) => setSeries(series.map((seriesItem) => seriesItem.id === item.id ? { ...seriesItem, axis: event.target.value as SeriesConfig["axis"] } : seriesItem))} className="rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm dark:border-slate-700 dark:bg-slate-900"><option value="left">Left axis</option><option value="right">Right axis</option></select></div>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                <div className="mb-2 text-xs uppercase tracking-wide text-slate-500">Save report view</div>
                <div className="flex gap-2"><input value={reportName} onChange={(event) => setReportName(event.target.value)} placeholder="Report name" className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900" /><button onClick={saveReport} className="rounded-lg bg-emerald-600 px-3 text-white"><Save size={16} /></button></div>
                <div className="mt-3 grid gap-2">{savedReports.map((report) => <button key={report.id} onClick={() => loadReport(report.config)} className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900">{report.name}</button>)}</div>
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
              <h2 className="text-lg font-semibold">Custom combination chart</h2>
              <p className="mb-3 text-sm text-slate-500">Applied filters and granularity are shared with the main Stage Trends report.</p>
              <div className="h-[600px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data.timeline} margin={{ top: 20, right: 25, bottom: 20, left: 0 }}><CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.25} /><XAxis dataKey="bucket" tick={{ fontSize: 11 }} /><YAxis yAxisId="left" allowDecimals={false} /><YAxis yAxisId="right" orientation="right" allowDecimals={false} /><Tooltip formatter={(value, name) => [Number(value).toLocaleString("en-IN"), String(name)]} /><Legend />{visibleSeries.map((item, index) => { const common = { key: item.id, dataKey: item.stage, name: item.stage, yAxisId: item.axis, stroke: palette[index], fill: palette[index] }; if (item.type === "line") return <Line {...common} type="monotone" strokeWidth={2.4} dot={{ r: 3 }} connectNulls />; if (item.type === "area") return <Area {...common} type="monotone" fillOpacity={0.16} strokeWidth={2} connectNulls />; return <Bar {...common} radius={[5,5,0,0]} maxBarSize={48} />; })}</ComposedChart></ResponsiveContainer></div>
            </section>
          </div>
        )}

        {!loading && data?.metadata.eventCount === 0 && (
          <section className="mt-5 rounded-2xl border border-dashed border-emerald-300 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950/30">
            <CalendarRange className="mx-auto text-emerald-600" />
            <h2 className="mt-3 text-lg font-semibold">Stage history cache is empty</h2>
            <p className="mt-1 text-sm text-slate-500">Click Sync Odoo history once. Future filter changes will use the cache and load much faster.</p>
            <button onClick={() => syncHistory(true)} className="mt-4 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm text-white">Run first full sync</button>
          </section>
        )}
      </div>
    </main>
  );
}
