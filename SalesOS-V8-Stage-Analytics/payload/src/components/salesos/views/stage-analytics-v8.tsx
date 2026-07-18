'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
} from 'recharts';
import type {
  CohortKey,
  DateGranularity,
  SavedStageReport,
  StageAnalyticsReport,
  StageChartType,
  StageSeriesConfig,
} from '@/lib/stage-analytics/types';

const MILESTONE_STAGES = [
  'Appointment Scheduled to Visit the School',
  'Visited School',
  'Written Entrance Exam',
  'Entrance Exam Cleared',
  'Seat Confirmed: Payment Pending',
  'Seat Allotted',
];

const COHORTS: Array<{ value: CohortKey; label: string }> = [
  { value: 'all', label: 'All students' },
  { value: 'admitted', label: 'Admitted students' },
  { value: 'cleared_not_admitted', label: 'Exam cleared, not admitted' },
  { value: 'payment_pending_not_allotted', label: 'Payment pending, not allotted' },
  { value: 'visited_no_exam', label: 'Visited, did not write exam' },
  { value: 'appointment_no_visit', label: 'Appointment, did not visit' },
  { value: 'lost_after_visit', label: 'Lost after campus visit' },
  { value: 'lost_after_clearance', label: 'Lost after exam clearance' },
  { value: 'stagnant', label: 'Stagnant active students' },
];

const TABS = ['Stage Trends', 'Journey', 'Conversion', 'Students', 'Compliance', 'Loss & Forecast', 'Ownership', 'Chart Studio'] as const;
type Tab = typeof TABS[number];

function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 }).format(value);
}

function optionList(values: string[]) {
  return values.map((value) => <option key={value} value={value}>{value}</option>);
}

function MetricCard({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-bold text-slate-900">{value}</div>
      {note ? <div className="mt-1 text-xs text-slate-500">{note}</div> : null}
    </div>
  );
}

function ChartSeries({ series }: { series: StageSeriesConfig }) {
  const dataKey = `${series.metric}:${series.stage}`;
  const common = { dataKey, name: `${series.stage} · ${series.metric}`, yAxisId: series.axis, isAnimationActive: false } as const;
  if (series.chartType === 'line') return <Line {...common} type="monotone" strokeWidth={2.2} dot={false} />;
  if (series.chartType === 'area') return <Area {...common} type="monotone" fillOpacity={0.18} strokeWidth={2} />;
  return <Bar {...common} stackId={series.stackId || undefined} radius={[4, 4, 0, 0]} />;
}

export default function StageAnalyticsV8() {
  const [tab, setTab] = useState<Tab>('Stage Trends');
  const [from, setFrom] = useState(daysAgo(90));
  const [to, setTo] = useState(today());
  const [granularity, setGranularity] = useState<DateGranularity>('week');
  const [cohort, setCohort] = useState<CohortKey>('all');
  const [academicYear, setAcademicYear] = useState('');
  const [institute, setInstitute] = useState('');
  const [grade, setGrade] = useState('');
  const [programme, setProgramme] = useState('');
  const [salesperson, setSalesperson] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [stages, setStages] = useState<string[]>(MILESTONE_STAGES.slice(0, 5));
  const [series, setSeries] = useState<StageSeriesConfig[]>([
    { id: 's1', stage: MILESTONE_STAGES[0], metric: 'entries', chartType: 'bar', axis: 'left' },
    { id: 's2', stage: MILESTONE_STAGES[1], metric: 'entries', chartType: 'bar', axis: 'left' },
    { id: 's3', stage: MILESTONE_STAGES[2], metric: 'entries', chartType: 'line', axis: 'right' },
    { id: 's4', stage: MILESTONE_STAGES[5], metric: 'entries', chartType: 'line', axis: 'right' },
  ]);
  const [report, setReport] = useState<StageAnalyticsReport | null>(null);
  const [savedReports, setSavedReports] = useState<SavedStageReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [lastCached, setLastCached] = useState(false);
  const [search, setSearch] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams({ from, to, granularity, cohort });
    if (academicYear) params.set('academicYear', academicYear);
    if (institute) params.set('institute', institute);
    if (grade) params.set('grade', grade);
    if (programme) params.set('programme', programme);
    if (salesperson) params.set('salesperson', salesperson);
    if (leadSource) params.set('leadSource', leadSource);
    for (const stage of stages.slice(0, 5)) params.append('stage', stage);
    return params.toString();
  }, [from, to, granularity, cohort, academicYear, institute, grade, programme, salesperson, leadSource, stages]);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/stage-analytics/report?${query}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Could not load stage analytics.');
      setReport(payload.report);
      setLastCached(Boolean(payload.cached));
      if (!stages.length && payload.report.options.stages.length) setStages(payload.report.options.stages.slice(0, 5));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load stage analytics.');
    } finally {
      setLoading(false);
    }
  }, [query, stages.length]);

  const loadSaved = useCallback(async () => {
    const response = await fetch('/api/stage-analytics/saved-reports', { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (payload.ok) setSavedReports(payload.reports || []);
  }, []);

  useEffect(() => { void loadReport(); void loadSaved(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function syncHistory(mode: 'full' | 'incremental') {
    setSyncing(true);
    setError('');
    try {
      const response = await fetch('/api/stage-analytics/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Odoo history sync failed.');
      await loadReport();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Odoo history sync failed.');
    } finally {
      setSyncing(false);
    }
  }

  async function saveCurrentReport() {
    const name = window.prompt('Saved report name');
    if (!name?.trim()) return;
    const filters = report?.filters || { from, to, granularity, cohort, stages };
    const response = await fetch('/api/stage-analytics/saved-reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, filters, series }),
    });
    const payload = await response.json();
    if (!payload.ok) return setError(payload.error || 'Could not save report.');
    setSavedReports(payload.reports || []);
  }

  function applySaved(saved: SavedStageReport) {
    const filters = saved.filters;
    setFrom(filters.from); setTo(filters.to); setGranularity(filters.granularity); setCohort(filters.cohort);
    setAcademicYear(filters.academicYear || ''); setInstitute(filters.institute || ''); setGrade(filters.grade || '');
    setProgramme(filters.programme || ''); setSalesperson(filters.salesperson || ''); setLeadSource(filters.leadSource || '');
    setStages(filters.stages || []); setSeries(saved.series || []);
  }

  function toggleStage(stage: string) {
    setStages((current) => current.includes(stage) ? current.filter((item) => item !== stage) : current.length < 5 ? [...current, stage] : current);
  }

  function updateSeries(id: string, patch: Partial<StageSeriesConfig>) {
    setSeries((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function addSeries() {
    if (series.length >= 5) return;
    const stage = report?.options.stages.find((item) => !series.some((entry) => entry.stage === item)) || report?.options.stages[0] || MILESTONE_STAGES[0];
    setSeries((current) => [...current, { id: crypto.randomUUID(), stage, metric: 'entries', chartType: 'line', axis: 'right' }]);
  }

  const filteredLeads = useMemo(() => {
    if (!report) return [];
    const needle = search.trim().toLowerCase();
    if (!needle) return report.leads;
    return report.leads.filter((lead) => [lead.name, lead.contactName, lead.phone, lead.currentStage, lead.salesperson, lead.institute, lead.programme].some((value) => value.toLowerCase().includes(needle)));
  }, [report, search]);

  const chartSeries = tab === 'Chart Studio' ? series : stages.map((stage, index) => ({
    id: `default-${index}`,
    stage,
    metric: 'entries' as const,
    chartType: index < 2 ? 'bar' as const : index === stages.length - 1 ? 'line' as const : 'area' as const,
    axis: index < 2 ? 'left' as const : 'right' as const,
  }));

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-[1680px] p-4 md:p-6">
        <div className="flex flex-col gap-4 rounded-3xl bg-[#131E35] p-5 text-white shadow-xl md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">SalesOS V8</div>
            <h1 className="mt-1 text-2xl font-bold md:text-3xl">Stage Journey Analytics</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">Historical stage movements, milestone dates, admitted-student journeys, conversion leakage and multi-series Chart Studio.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => void syncHistory(report?.syncState.lastFullSyncAt ? 'incremental' : 'full')} disabled={syncing} className="rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">
              {syncing ? 'Syncing Odoo…' : report?.syncState.lastFullSyncAt ? 'Sync Odoo History' : 'Run First Full Sync'}
            </button>
            <button onClick={() => void syncHistory('full')} disabled={syncing} className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold">Rebuild History</button>
            <button onClick={() => void saveCurrentReport()} className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold">Save View</button>
          </div>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</div> : null}

        <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <label className="text-xs font-semibold text-slate-600">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-xs font-semibold text-slate-600">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" /></label>
            <label className="text-xs font-semibold text-slate-600">Granularity<select value={granularity} onChange={(event) => setGranularity(event.target.value as DateGranularity)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option><option value="quarter">Quarter</option></select></label>
            <label className="text-xs font-semibold text-slate-600">Cohort<select value={cohort} onChange={(event) => setCohort(event.target.value as CohortKey)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm">{COHORTS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
            <label className="text-xs font-semibold text-slate-600">Academic Year<select value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All</option>{optionList(report?.options.academicYears || [])}</select></label>
            <label className="text-xs font-semibold text-slate-600">Institute<select value={institute} onChange={(event) => setInstitute(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All</option>{optionList(report?.options.institutes || [])}</select></label>
            <label className="text-xs font-semibold text-slate-600">Grade<select value={grade} onChange={(event) => setGrade(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All</option>{optionList(report?.options.grades || [])}</select></label>
            <label className="text-xs font-semibold text-slate-600">Programme<select value={programme} onChange={(event) => setProgramme(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All</option>{optionList(report?.options.programmes || [])}</select></label>
            <label className="text-xs font-semibold text-slate-600">Salesperson<select value={salesperson} onChange={(event) => setSalesperson(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All</option>{optionList(report?.options.salespeople || [])}</select></label>
            <label className="text-xs font-semibold text-slate-600">Lead Source<select value={leadSource} onChange={(event) => setLeadSource(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="">All</option>{optionList(report?.options.leadSources || [])}</select></label>
            <div className="flex items-end xl:col-span-2"><button onClick={() => void loadReport()} disabled={loading} className="w-full rounded-xl bg-[#131E35] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{loading ? 'Applying…' : 'Apply Filters'}</button></div>
            <div className="flex items-end text-xs text-slate-500 xl:col-span-2">{report ? `Last sync: ${formatDate(report.syncState.lastIncrementalSyncAt || '')} · ${report.syncState.eventCount} events · ${lastCached ? 'cached response' : 'fresh calculation'}` : 'Run the first sync to populate history.'}</div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {(report?.options.stages || MILESTONE_STAGES).map((stage) => <button key={stage} onClick={() => toggleStage(stage)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${stages.includes(stage) ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-600'}`}>{stage}</button>)}
          </div>
          <div className="mt-2 text-xs text-slate-500">Select up to five stages. Filters are applied only after you click Apply Filters, preventing repeated Odoo downloads.</div>
        </section>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <MetricCard label="Cohort Students" value={report?.summary.cohortStudents ?? 0} />
          <MetricCard label="Stage Events" value={report?.summary.stageEvents ?? 0} />
          <MetricCard label="Campus Visits" value={report?.summary.visits ?? 0} />
          <MetricCard label="Admissions" value={report?.summary.admissions ?? 0} />
          <MetricCard label="Cleared, Not Admitted" value={report?.summary.clearedNotAdmitted ?? 0} />
          <MetricCard label="Payment Pending" value={report?.summary.paymentPending ?? 0} />
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">{TABS.map((item) => <button key={item} onClick={() => setTab(item)} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${tab === item ? 'bg-[#131E35] text-white' : 'border border-slate-200 bg-white text-slate-600'}`}>{item}</button>)}</div>

        {(tab === 'Stage Trends' || tab === 'Chart Studio') && report ? (
          <section className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-bold">{tab === 'Chart Studio' ? 'Chart Studio Pro' : 'Stage Movement Trends'}</h2><p className="text-sm text-slate-500">Entries, exits and net movement by selected date interval.</p></div>{tab === 'Chart Studio' ? <button onClick={addSeries} disabled={series.length >= 5} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold disabled:opacity-40">Add measure</button> : null}</div>
            {tab === 'Chart Studio' ? <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-5">{series.map((item) => <div key={item.id} className="rounded-2xl border border-slate-200 p-3"><select value={item.stage} onChange={(event) => updateSeries(item.id, { stage: event.target.value })} className="w-full rounded-lg border px-2 py-2 text-xs">{optionList(report.options.stages)}</select><div className="mt-2 grid grid-cols-3 gap-1"><select value={item.metric} onChange={(event) => updateSeries(item.id, { metric: event.target.value as StageSeriesConfig['metric'] })} className="rounded-lg border px-1 py-2 text-xs"><option value="entries">Entries</option><option value="exits">Exits</option><option value="net">Net</option></select><select value={item.chartType} onChange={(event) => updateSeries(item.id, { chartType: event.target.value as StageChartType })} className="rounded-lg border px-1 py-2 text-xs"><option value="bar">Bar</option><option value="line">Line</option><option value="area">Area</option></select><select value={item.axis} onChange={(event) => updateSeries(item.id, { axis: event.target.value as 'left' | 'right' })} className="rounded-lg border px-1 py-2 text-xs"><option value="left">Left axis</option><option value="right">Right axis</option></select></div><button onClick={() => setSeries((current) => current.filter((entry) => entry.id !== item.id))} className="mt-2 text-xs font-semibold text-red-600">Remove</button></div>)}</div> : null}
            <div className="mt-4 h-[430px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={report.timeline} margin={{ top: 15, right: 25, left: 0, bottom: 60 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="bucket" angle={-35} textAnchor="end" height={70} fontSize={11} /><YAxis yAxisId="left" fontSize={11} /><YAxis yAxisId="right" orientation="right" fontSize={11} /><Tooltip /><Legend />{chartSeries.map((item) => <ChartSeries key={item.id} series={item} />)}</ComposedChart></ResponsiveContainer></div>
            {tab === 'Stage Trends' ? <div className="mt-4 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="p-3">Stage</th><th className="p-3">Entries</th><th className="p-3">Exits</th><th className="p-3">Net</th><th className="p-3">Unique</th><th className="p-3">Backlog</th><th className="p-3">Conversion</th><th className="p-3">Median days</th></tr></thead><tbody>{report.stageRegister.filter((row) => stages.includes(row.stage)).map((row) => <tr key={row.stage} className="border-b"><td className="p-3 font-semibold">{row.stage}</td><td className="p-3">{row.entries}</td><td className="p-3">{row.exits}</td><td className="p-3">{row.net}</td><td className="p-3">{row.uniqueStudents}</td><td className="p-3">{row.currentBacklog}</td><td className="p-3">{row.conversionRate}%</td><td className="p-3">{row.medianDays}</td></tr>)}</tbody></table></div> : null}
          </section>
        ) : null}

        {tab === 'Journey' && report ? <section className="mt-4 space-y-4"><div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">{report.milestones.map((row) => <div key={row.stage} className="rounded-2xl border bg-white p-4 shadow-sm"><div className="text-xs font-bold text-slate-500">{row.stage}</div><div className="mt-2 text-2xl font-bold">{row.reached}</div><div className="text-xs text-slate-500">{row.reachedRate}% reached · median {row.medianDaysFromPrevious} days</div></div>)}</div><div className="rounded-3xl border bg-white p-4 shadow-sm"><h2 className="text-lg font-bold">Milestone dates by student</h2><div className="mt-3 overflow-x-auto"><table className="min-w-[1250px] text-sm"><thead><tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="p-3">Student</th><th className="p-3">Appointment</th><th className="p-3">Visited</th><th className="p-3">Exam</th><th className="p-3">Cleared</th><th className="p-3">Payment pending</th><th className="p-3">Seat allotted</th><th className="p-3">Current stage</th></tr></thead><tbody>{report.leads.slice(0, 250).map((lead) => <tr key={lead.id} className="border-b"><td className="p-3 font-semibold">{lead.name}<div className="text-xs font-normal text-slate-500">{lead.phone}</div></td><td className="p-3">{formatDate(lead.appointmentDate)}</td><td className="p-3">{formatDate(lead.visitedDate)}</td><td className="p-3">{formatDate(lead.examDate)}</td><td className="p-3">{formatDate(lead.clearedDate)}</td><td className="p-3">{formatDate(lead.paymentPendingDate)}</td><td className="p-3">{formatDate(lead.allottedDate)}</td><td className="p-3">{lead.currentStage}</td></tr>)}</tbody></table></div></div></section> : null}

        {tab === 'Conversion' && report ? <section className="mt-4 rounded-3xl border bg-white p-4 shadow-sm"><h2 className="text-lg font-bold">Stage Conversion Matrix</h2><p className="text-sm text-slate-500">Where students move next and how long each transition takes.</p><div className="mt-3 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="p-3">From</th><th className="p-3">To</th><th className="p-3">Students</th><th className="p-3">Conversion</th><th className="p-3">Average days</th><th className="p-3">Median days</th></tr></thead><tbody>{report.conversionMatrix.map((row) => <tr key={`${row.fromStage}-${row.toStage}`} className="border-b"><td className="p-3 font-semibold">{row.fromStage}</td><td className="p-3">{row.toStage}</td><td className="p-3">{row.students}</td><td className="p-3">{row.conversionRate}%</td><td className="p-3">{row.averageDays}</td><td className="p-3">{row.medianDays}</td></tr>)}</tbody></table></div></section> : null}

        {tab === 'Students' && report ? <section className="mt-4 rounded-3xl border bg-white p-4 shadow-sm"><div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between"><div><h2 className="text-lg font-bold">Cohort Students</h2><p className="text-sm text-slate-500">Click Open to inspect the underlying Odoo record.</p></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search student, phone, stage…" className="rounded-xl border px-3 py-2 text-sm" /></div><div className="mt-3 overflow-x-auto"><table className="min-w-[1350px] text-sm"><thead><tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="p-3">Student</th><th className="p-3">Stage</th><th className="p-3">Salesperson</th><th className="p-3">Institute</th><th className="p-3">Programme</th><th className="p-3">Days stagnant</th><th className="p-3">Next follow-up</th><th className="p-3">Recommended action</th><th className="p-3"></th></tr></thead><tbody>{filteredLeads.slice(0, 500).map((lead) => <tr key={lead.id} className="border-b"><td className="p-3 font-semibold">{lead.name}<div className="text-xs font-normal text-slate-500">{lead.phone}</div></td><td className="p-3">{lead.currentStage}</td><td className="p-3">{lead.salesperson}</td><td className="p-3">{lead.institute}</td><td className="p-3">{lead.programme}</td><td className="p-3">{lead.daysSinceLastMovement}</td><td className="p-3">{lead.nextFollowUpDate || 'Missing'}</td><td className="p-3">{lead.recommendedAction}</td><td className="p-3"><a href={`${process.env.NEXT_PUBLIC_ODOO_URL || ''}/web#id=${lead.id}&model=crm.lead&view_type=form`} target="_blank" className="font-semibold text-blue-700">Open</a></td></tr>)}</tbody></table></div></section> : null}

        {tab === 'Compliance' && report ? <section className="mt-4 grid gap-4 lg:grid-cols-2"><div className="rounded-3xl border bg-white p-4 shadow-sm"><h2 className="text-lg font-bold">Milestone Compliance</h2><div className="mt-3 space-y-3">{report.compliance.map((row) => <div key={row.milestone} className="rounded-2xl border p-4"><div className="font-semibold">{row.milestone}</div><div className="mt-2 grid grid-cols-4 gap-2 text-center text-xs"><div><b className="block text-xl">{row.students}</b>Students</div><div><b className="block text-xl text-emerald-700">{row.compliant}</b>Compliant</div><div><b className="block text-xl text-amber-700">{row.missingFollowUp}</b>No follow-up</div><div><b className="block text-xl text-red-700">{row.missingComment + row.missingScoreOrAmount}</b>Missing data</div></div></div>)}</div></div><div className="rounded-3xl border bg-white p-4 shadow-sm"><h2 className="text-lg font-bold">Day and Hour Heatmap</h2><p className="text-sm text-slate-500">Stage movements in India time.</p><div className="mt-3 grid grid-cols-8 gap-1 text-xs"><div></div>{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day) => <div key={day} className="text-center font-semibold">{day}</div>)}{Array.from({ length: 24 }, (_, hour) => <div key={hour} className="contents"><div className="pr-1 text-right text-slate-500">{hour}:00</div>{Array.from({ length: 7 }, (_, weekday) => { const count = report.heatmap.find((cell) => cell.hour === hour && cell.weekday === weekday)?.count || 0; return <div key={`${weekday}-${hour}`} title={`${count} movements`} className="h-5 rounded border" style={{ background: `rgba(19,30,53,${Math.min(.9, .06 + count / 20)})` }} />; })}</div>)}</div></div></section> : null}

        {tab === 'Loss & Forecast' && report ? <section className="mt-4 grid gap-4 lg:grid-cols-2"><div className="rounded-3xl border bg-white p-4 shadow-sm"><h2 className="text-lg font-bold">Where Students Were Lost</h2><div className="mt-3 space-y-3">{report.losses.map((row) => <div key={row.dropPoint}><div className="flex justify-between text-sm"><span>{row.dropPoint}</span><b>{row.students} · {row.share}%</b></div><div className="mt-1 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-red-500" style={{ width: `${Math.min(100, row.share)}%` }} /></div></div>)}</div></div><div className="rounded-3xl border bg-white p-4 shadow-sm"><h2 className="text-lg font-bold">Milestone Forecast</h2><div className="mt-3 grid grid-cols-3 gap-2"><MetricCard label="Conservative" value={report.forecast.conservative} /><MetricCard label="Likely" value={report.forecast.likely} /><MetricCard label="Optimistic" value={report.forecast.optimistic} /></div><div className="mt-4 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500"><th className="p-2">Stage</th><th className="p-2">Current</th><th className="p-2">Historical rate</th><th className="p-2">Expected</th></tr></thead><tbody>{report.forecast.rows.map((row) => <tr key={row.stage} className="border-b"><td className="p-2 font-semibold">{row.stage}</td><td className="p-2">{row.currentStudents}</td><td className="p-2">{row.historicalAdmissionRate}%</td><td className="p-2">{row.expectedAdmissions}</td></tr>)}</tbody></table></div></div></section> : null}

        {tab === 'Ownership' && report ? <section className="mt-4 rounded-3xl border bg-white p-4 shadow-sm"><h2 className="text-lg font-bold">Stage-change Ownership</h2><p className="text-sm text-slate-500">Assigned salesperson compared with the person who actually changed the stage.</p><div className="mt-3 overflow-x-auto"><table className="min-w-full text-sm"><thead><tr className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500"><th className="p-3">Assigned salesperson</th><th className="p-3">Changed by</th><th className="p-3">Movements</th><th className="p-3">Status</th></tr></thead><tbody>{report.ownership.map((row) => <tr key={`${row.assignedSalesperson}-${row.changedBy}`} className="border-b"><td className="p-3 font-semibold">{row.assignedSalesperson}</td><td className="p-3">{row.changedBy}</td><td className="p-3">{row.movements}</td><td className="p-3"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${row.mismatch ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>{row.mismatch ? 'Different user' : 'Owner updated'}</span></td></tr>)}</tbody></table></div></section> : null}

        <section className="mt-4 rounded-3xl border bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Saved Views</h2><p className="text-sm text-slate-500">Filters, date range, stages and Chart Studio series are remembered.</p></div></div><div className="mt-3 flex flex-wrap gap-2">{savedReports.length ? savedReports.map((saved) => <button key={saved.id} onClick={() => applySaved(saved)} className="rounded-xl border px-3 py-2 text-sm font-semibold">{saved.name}</button>) : <span className="text-sm text-slate-500">No saved reports yet.</span>}</div></section>
      </div>
    </main>
  );
}
