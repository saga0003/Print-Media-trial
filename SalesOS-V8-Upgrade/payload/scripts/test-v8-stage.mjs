import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "src/app/stage-analytics/page.tsx",
  "src/components/v8/StageAnalyticsPage.tsx",
  "src/app/api/v8/stage-sync/route.ts",
  "src/app/api/v8/stage-analytics/route.ts",
  "src/app/api/v8/stage-reports/route.ts",
  "src/lib/v8/stage-sync.ts",
  "src/lib/v8/stage-analytics.ts",
  "src/lib/v8/stage-store.ts",
  "src/lib/v8/stage-types.ts",
  "src/lib/v8/odoo-rpc.ts",
];

for (const relative of required) {
  const absolute = path.join(root, relative);
  if (!fs.existsSync(absolute)) throw new Error(`Missing V8 file: ${relative}`);
}

const sync = fs.readFileSync(path.join(root, "src/lib/v8/stage-sync.ts"), "utf8");
const analytics = fs.readFileSync(path.join(root, "src/lib/v8/stage-analytics.ts"), "utf8");
const page = fs.readFileSync(path.join(root, "src/components/v8/StageAnalyticsPage.tsx"), "utf8");
const rpc = fs.readFileSync(path.join(root, "src/lib/v8/odoo-rpc.ts"), "utf8");

const contracts = [
  [sync.includes('"mail.message"'), "mail.message stage-history source"],
  [sync.includes('"mail.tracking.value"'), "mail.tracking.value source"],
  [sync.includes('"crm.lead"'), "crm.lead snapshot source"],
  [sync.includes("lead_properties"), "Odoo property extraction"],
  [analytics.includes("cleared_not_admitted"), "cleared-not-admitted cohort"],
  [analytics.includes("payment_pending_not_allotted"), "payment-pending cohort"],
  [analytics.includes("conversionMatrix"), "conversion matrix"],
  [page.includes("Apply filters"), "manual Apply Filters"],
  [page.includes("Sync Odoo history"), "separate Odoo history sync"],
  [page.includes("Chart Studio Pro"), "multi-series chart studio"],
  [page.includes("yAxisId"), "dual-axis chart support"],
  [rpc.includes('item === "|"'), "logical Odoo domain preservation"],
];

for (const [passed, label] of contracts) {
  if (!passed) throw new Error(`V8 contract failed: ${label}`);
}

console.log("SalesOS V8 stage analytics contract passed.");
