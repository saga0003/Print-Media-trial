'use client';

import { useEffect, useMemo, useState } from 'react';
import { Area, Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type ChartType = 'bar' | 'line' | 'area';
type Metric = 'entries' | 'exits' | 'net';
type Axis = 'left' | 'right';

type Series = { id: string; stage: string; metric: Metric; type: ChartType; axis: Axis; stack: boolean };

type StudioPayload = {
  ok: boolean;
  error?: string;
  rows: Array<Record<string, string | number>>;
  stages: string[];
  dimensions: string[];
  eventCount: number;
  leadCount: number;
  options: {
    stages: string[];
    academicYears: string[];
    institutes: string[];
    grades: string[];
    programmes: string[];
    salespeople: string[];
    leadSources: string[];
  };
};

const DIMENSIONS = [
  ['date', 'Date'],
  ['institute', 'Institute'],
  ['grade', 'Grade'],
  ['programme', 'Programme'],
  ['salesperson', 'Salesperson'],
  ['leadSource', 'Lead Source'],
  ['fromStage', 'From Stage'],
  ['toStage', 'To Stage'],
] as const;

const COHORTS = [
  ['all', 'All students'],
  ['admitted', 'Admitted'],
  ['cleared_not_admitted', 'Cleared, not admitted'],
  ['payment_pending_not_allotted', 'Payment pending'],
  ['visited_no_exam', 'Visited, no exam'],
  ['appointment_no_visit', 'Appointment, no visit'],
  ['lost_after_visit', 'Lost after visit'],
  ['lost_after_clearance', 'Lost after clearance'],
] as const;

const defaultStages = [
  'Appointment Scheduled to Visit the School',
  'Visited School',
  'Written Entrance Exam',
  'Entrance Exam Cleared',
  'Seat Allotted',
];

function ago(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

export default function ChartStudioProV8() {
  const [from, setFrom] = useState(ago(90));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [granularity, setGranularity] = useState('week');
  const [cohort, setCohort] = useState('all');
  const [dimensions, setDimensions] = useState<string[]>(['date']);
  const [academicYear, setAcademicYear] = useState('');
  const [institute, setInstitute] = useState('');
  const [grade, setGrade] = useState('');
  const [programme, setProgramme] = useState('');
  const [salesperson, setSalesperson] = useState('');
  const [leadSource, setLeadSource] = useState('');
  const [series, setSeries] = useState<Series[]>(defaultStages.slice(0, 4).map((stage, index) => ({
    id: `series-${index}`,
    stage,
    metric: 'entries',
    type: index < 2 ? 'bar' : index === 2 ? 'line' : 'area',
    axis: index < 2 ? 'left' : 'right',
    stack: false,
  })));
  const [data, setData] = useState<StudioPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const query = useMemo(() => {
    const params = new URLSearchParams({ from, to, granularity, cohort });
    dimensions.slice(0, 5).forEach((dimension) => params.append('dimension', dimension));
    series.slice(0, 5).forEach((item) => params.append('stage', item.stage));
    if (academicYear) params.set('academicYear', academicYear);
    if (institute) params.set('institute', institute);
    if (grade) params.set('grade', grade);
    if (programme) params.set('programme', programme);
    if (salesperson) params.set('salesperson', salesperson);
    if (leadSource) params.set('leadSource', leadSource);
    return params.toString();
  }, [from, to, granularity, cohort, dimensions, series, academicYear, institute, grade, programme, salesperson, leadSource]);

  async function apply() {
    setLoading(true); setError('');
    try {
      const response = await fetch(`/api/stage-analytics/studio?${query}`, { cache: 'no-store' });
      const payload = await response.json() as StudioPayload;
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'Chart Studio failed.');
      setData(payload);
      if (!series.length && payload.stages.length) setSeries([{ id: crypto.randomUUID(), stage: payload.stages[0], metric: 'entries', type: 'bar', axis: 'left', stack: false }]);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Chart Studio failed.');
    } finally { setLoading(false); }
  }

  useEffect(() => { void apply(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleDimension(value: string) {
    setDimensions((current) => current.includes(value) ? current.filter((item) => item !== value) : current.length < 5 ? [...current, value] : current);
  }

  function updateSeries(id: string, patch: Partial<Series>) {
    setSeries((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  }

  function addSeries() {
    if (series.length >= 5) return;
    const stage = data?.options.stages.find((candidate) => !series.some((item) => item.stage === candidate)) || data?.options.stages[0] || defaultStages[0];
    setSeries((current) => [...current, { id: crypto.randomUUID(), stage, metric: 'entries', type: 'line', axis: 'right', stack: false }]);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 md:p-6">
      <div className="mx-auto max-w-[1700px]">
        <div className="rounded-3xl bg-[#131E35] p-5 text-white shadow-xl">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">SalesOS V8</div>
          <div className="mt-1 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div><h1 className="text-3xl font-bold">Chart Studio Pro</h1><p className="mt-1 text-sm text-slate-300">Combine up to five dimensions and five stage measures with bar, line and area charts.</p></div>
            <a href="/stage-analytics" className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold">Back to Stage Analytics</a>
          </div>
        </div>

        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</div> : null}

        <section className="mt-4 rounded-3xl border bg-white p-4 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
            <label className="text-xs font-semibold">From<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" /></label>
            <label className="text-xs font-semibold">To<input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm" /></label>
            <label className="text-xs font-semibold">Granularity<select value={granularity} onChange={(event) => setGranularity(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option><option value="quarter">Quarter</option></select></label>
            <label className="text-xs font-semibold">Cohort<select value={cohort} onChange={(event) => setCohort(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm">{COHORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="text-xs font-semibold">Academic Year<select value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"><option value="">All</option>{data?.options.academicYears.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="text-xs font-semibold">Institute<select value={institute} onChange={(event) => setInstitute(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"><option value="">All</option>{data?.options.institutes.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="text-xs font-semibold">Grade<select value={grade} onChange={(event) => setGrade(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"><option value="">All</option>{data?.options.grades.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="text-xs font-semibold">Programme<select value={programme} onChange={(event) => setProgramme(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"><option value="">All</option>{data?.options.programmes.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="text-xs font-semibold">Salesperson<select value={salesperson} onChange={(event) => setSalesperson(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"><option value="">All</option>{data?.options.salespeople.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="text-xs font-semibold">Lead Source<select value={leadSource} onChange={(event) => setLeadSource(event.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"><option value="">All</option>{data?.options.leadSources.map((value) => <option key={value}>{value}</option>)}</select></label>
            <div className="flex items-end xl:col-span-2"><button onClick={() => void apply()} disabled={loading} className="w-full rounded-xl bg-[#131E35] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{loading ? 'Building chart…' : 'Apply Chart'}</button></div>
          </div>

          <div className="mt-4"><div className="text-xs font-bold uppercase text-slate-500">Dimensions — choose up to five</div><div className="mt-2 flex flex-wrap gap-2">{DIMENSIONS.map(([value, label]) => <button key={value} onClick={() => toggleDimension(value)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${dimensions.includes(value) ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-600'}`}>{label}</button>)}</div></div>
        </section>

        <section className="mt-4 rounded-3xl border bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">Measures</h2><p className="text-sm text-slate-500">Each measure can use its own stage, metric, chart type and Y-axis.</p></div><button onClick={addSeries} disabled={series.length >= 5} className="rounded-xl border px-3 py-2 text-sm font-semibold disabled:opacity-40">Add measure</button></div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">{series.map((item) => <div key={item.id} className="rounded-2xl border p-3"><select value={item.stage} onChange={(event) => updateSeries(item.id, { stage: event.target.value })} className="w-full rounded-lg border px-2 py-2 text-xs">{(data?.options.stages || defaultStages).map((stage) => <option key={stage}>{stage}</option>)}</select><div className="mt-2 grid grid-cols-3 gap-1"><select value={item.metric} onChange={(event) => updateSeries(item.id, { metric: event.target.value as Metric })} className="rounded-lg border px-1 py-2 text-xs"><option value="entries">Entries</option><option value="exits">Exits</option><option value="net">Net</option></select><select value={item.type} onChange={(event) => updateSeries(item.id, { type: event.target.value as ChartType })} className="rounded-lg border px-1 py-2 text-xs"><option value="bar">Bar</option><option value="line">Line</option><option value="area">Area</option></select><select value={item.axis} onChange={(event) => updateSeries(item.id, { axis: event.target.value as Axis })} className="rounded-lg border px-1 py-2 text-xs"><option value="left">Left</option><option value="right">Right</option></select></div><label className="mt-2 flex items-center gap-2 text-xs"><input type="checkbox" checked={item.stack} onChange={(event) => updateSeries(item.id, { stack: event.target.checked })} />Stack bars</label><button onClick={() => setSeries((current) => current.filter((entry) => entry.id !== item.id))} className="mt-2 text-xs font-semibold text-red-600">Remove</button></div>)}</div>
          <div className="mt-4 flex gap-3 text-sm text-slate-500"><span>{data?.eventCount || 0} stage events</span><span>{data?.leadCount || 0} students</span><span>{dimensions.join(' × ')}</span></div>
          <div className="mt-3 h-[520px]"><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data?.rows || []} margin={{ top: 15, right: 30, bottom: 90, left: 0 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="bucket" angle={-42} textAnchor="end" interval={0} height={110} fontSize={10} /><YAxis yAxisId="left" /><YAxis yAxisId="right" orientation="right" /><Tooltip /><Legend />{series.map((item) => { const key = `${item.metric}:${item.stage}`; const common = { key: item.id, dataKey: key, name: `${item.stage} · ${item.metric}`, yAxisId: item.axis, isAnimationActive: false } as const; if (item.type === 'line') return <Line {...common} type="monotone" strokeWidth={2.2} dot={false} />; if (item.type === 'area') return <Area {...common} type="monotone" fillOpacity={0.18} strokeWidth={2} />; return <Bar {...common} stackId={item.stack ? item.axis : undefined} radius={[4,4,0,0]} />; })}</ComposedChart></ResponsiveContainer></div>
        </section>
      </div>
    </main>
  );
}
