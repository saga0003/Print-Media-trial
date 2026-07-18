import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const required = [
  'src/lib/stage-analytics/types.ts',
  'src/lib/stage-analytics/odoo-client.ts',
  'src/lib/stage-analytics/store.ts',
  'src/lib/stage-analytics/sync.ts',
  'src/lib/stage-analytics/report.ts',
  'src/app/api/stage-analytics/sync/route.ts',
  'src/app/api/stage-analytics/report/route.ts',
  'src/app/api/stage-analytics/saved-reports/route.ts',
  'src/app/stage-analytics/page.tsx',
  'src/components/salesos/views/stage-analytics-v8.tsx',
];

for (const relative of required) {
  const file = path.join(root, relative);
  await stat(file).catch(() => { throw new Error(`Missing V8 file: ${relative}`); });
}

const sync = await readFile(path.join(root, 'src/lib/stage-analytics/sync.ts'), 'utf8');
const report = await readFile(path.join(root, 'src/lib/stage-analytics/report.ts'), 'utf8');
const ui = await readFile(path.join(root, 'src/components/salesos/views/stage-analytics-v8.tsx'), 'utf8');

const assertions = [
  [sync.includes("'mail.tracking.value'"), 'mail.tracking.value history'],
  [sync.includes("'Visited School'"), 'campus visit milestone'],
  [sync.includes("'Seat Confirmed: Payment Pending'"), 'payment pending milestone'],
  [report.includes("'cleared_not_admitted'"), 'cleared-not-admitted cohort'],
  [report.includes('makeConversionMatrix'), 'conversion matrix'],
  [report.includes('makeForecast'), 'historical forecast'],
  [ui.includes('Chart Studio Pro'), 'Chart Studio Pro'],
  [ui.includes('series.length >= 5'), 'five-series limit'],
  [ui.includes('Apply Filters'), 'manual filter apply'],
];

for (const [ok, label] of assertions) if (!ok) throw new Error(`V8 contract failed: ${label}`);
console.log('SalesOS V8 stage analytics contract passed.');
