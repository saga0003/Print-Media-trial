# SalesOS V8 Validation Report

## Completed checks

- Upgrade package contains the required installer, routes, event engine, report engine, UI components, runtime stores, and contract test.
- Odoo domain handling always normalizes search domains into nested terms, preventing the earlier `Domain() invalid item in domain: True` failure pattern.
- Stage history reads the CRM stage tracking field from `ir.model.fields` and reconstructs changes from `mail.tracking.value` and `mail.message`.
- A fallback path reads message tracking IDs when direct tracking-date queries are unavailable.
- First full sync and incremental sync paths are implemented.
- Incremental sync uses an overlap period to avoid missing late updates.
- Stage-event and lead-snapshot records are deduplicated before saving.
- Report filters do not call Odoo; they read the local stage-event store.
- Stage Trends, cohorts, milestone dates, conversion matrix, stage durations, compliance, loss analysis, forecasting, ownership, heatmap, and saved reports are implemented.
- Basic Chart Studio supports five series, bar/line/area, and two axes.
- Advanced Chart Studio supports three simultaneous dimensions and five measures.
- A package-level Node validation script checks required files and feature markers.
- A project-level `npm run test:v8-stage` contract test is included.

## Checks that must run on the user's complete V7.3 project

The upgrade package was authored against the documented V7.3 file structure. A dependency-backed Next.js build cannot be completed inside the upgrade-only repository because it does not contain the user's full V7.3 application and private `.env.local`.

After installation, run:

```powershell
npm install --registry=https://registry.npmjs.org/
npm run test:v8-stage
npm run typecheck
npm run build
```

## Live Odoo checks

The following require the user's private Odoo API key and must be verified locally:

1. Run the first full history sync.
2. Confirm stage-event count is non-zero.
3. Compare several students' Appointment, Visited School, Entrance Exam Cleared, Payment Pending, and Seat Allotted dates against Odoo chatter.
4. Test admitted and cleared-not-admitted cohorts.
5. Test a short date range and a two-year date range.
6. Confirm ordinary filter changes are fast and do not trigger a new Odoo sync.

## Deployment note

The file-backed cache is appropriate for local testing and one persistent Node.js process. Before multi-instance production hosting, move stage events, lead snapshots, sync state, and saved reports to PostgreSQL/Supabase.
