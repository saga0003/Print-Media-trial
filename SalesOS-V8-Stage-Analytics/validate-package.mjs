import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('SalesOS-V8-Stage-Analytics');
const required = [
  'README.md',
  'apply-v8-upgrade.ps1',
  'payload/src/lib/stage-analytics/types.ts',
  'payload/src/lib/stage-analytics/odoo-client.ts',
  'payload/src/lib/stage-analytics/store.ts',
  'payload/src/lib/stage-analytics/sync.ts',
  'payload/src/lib/stage-analytics/report.ts',
  'payload/src/app/api/stage-analytics/sync/route.ts',
  'payload/src/app/api/stage-analytics/report/route.ts',
  'payload/src/app/api/stage-analytics/studio/route.ts',
  'payload/src/app/api/stage-analytics/saved-reports/route.ts',
  'payload/src/app/stage-analytics/page.tsx',
  'payload/src/app/stage-analytics/chart-studio/page.tsx',
  'payload/src/components/salesos/views/stage-analytics-v8.tsx',
  'payload/src/components/salesos/views/chart-studio-pro-v8.tsx',
  'payload/scripts/test-v8-stage.mjs',
];
for (const file of required) await access(path.join(root, file));

const contents = await Promise.all(required.map((file) => readFile(path.join(root, file), 'utf8')));
const joined = contents.join('\n');
const markers = [
  'mail.tracking.value',
  'Appointment Scheduled to Visit the School',
  'Visited School',
  'Written Entrance Exam',
  'Entrance Exam Cleared',
  'Seat Confirmed: Payment Pending',
  'Seat Allotted',
  'cleared_not_admitted',
  'Chart Studio Pro',
  'makeConversionMatrix',
  'makeForecast',
  'STAGE_REPORT_CACHE_SECONDS',
  'ALLOWED_DIMENSIONS',
  'Combine up to five dimensions and five stage measures',
];
for (const marker of markers) if (!joined.includes(marker)) throw new Error(`Missing V8 marker: ${marker}`);
console.log(`SalesOS V8 package validation passed: ${required.length} required files and ${markers.length} feature markers.`);
