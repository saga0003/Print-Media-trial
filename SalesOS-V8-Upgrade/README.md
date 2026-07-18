# SalesOS V8 — Stage Journey Analytics Upgrade

This upgrade is designed for the working **SalesOS V7.3 Odoo Visibility Fix** project. It preserves the V6 UI, live Odoo connection, import reliability, Call Analytics, targets, acknowledgements, team scoring and rule-based intelligence.

## V8 additions

- Stage-event history reconstructed from Odoo chatter (`mail.message` + `mail.tracking.value`).
- Date-controlled trends for every exact Odoo stage.
- Manual **Apply filters**; filtering reads the local analytics cache instead of pulling Odoo again.
- Separate **Sync Odoo history** button with incremental stage-history sync.
- Cohorts: admitted, entrance-cleared-not-admitted, payment-pending-not-allotted, visited-not-exam, lost-after-visit and all students.
- Appointment, campus visit, entrance exam, exam-cleared, payment-pending and seat-allotted milestone dates.
- Stage conversion matrix and median/average time between stages.
- Student journey analysis for admitted students and comparison cohorts.
- Chart Studio Pro with up to five stage series, bar/line/area combinations and two Y axes.
- Exact hover values, date granularity (day/week/month), saved report configurations and lead drill-down.
- Fast cached filtering; Odoo is contacted only when Sync is clicked or an external scheduler calls the sync endpoint.

## Install on Windows

1. Extract the working V7.3 project into its own folder.
2. Download this branch as ZIP and extract it.
3. Open PowerShell inside `SalesOS-V8-Upgrade`.
4. Run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\apply-v8-upgrade.ps1 -TargetPath "D:\path\to\SalesOS-V7.3-Odoo-Visibility-Fix"
```

5. Open PowerShell in the upgraded SalesOS project and run:

```powershell
npm install --registry=https://registry.npmjs.org/
npm run test:v8-stage
npm run typecheck
npm run dev
```

6. Open:

```text
http://localhost:3000/stage-analytics
```

## Environment additions

Add these to `.env.local`:

```env
STAGE_EVENTS_FILE=data/stage-events.runtime.json
STAGE_REPORTS_FILE=data/stage-reports.runtime.json
ODOO_STAGE_HISTORY_DAYS=730
ODOO_STAGE_MESSAGE_LIMIT=50000
SALESOS_TIME_ZONE=Asia/Kolkata
SALESOS_TIME_ZONE_OFFSET_MINUTES=330
```

## First use

1. Open Stage Analytics.
2. Click **Sync Odoo history**.
3. Wait for the sync summary.
4. Set From/To dates, cohort, academic year, institute, grade, product and salesperson.
5. Click **Apply filters**.

Normal filter changes do not call Odoo. The cached event store is used, which is the primary V8 speed improvement.

## Important measurement rule

A milestone date is counted only when Odoo chatter contains a tracked stage change into that exact stage. The initial New stage is inferred from the lead creation date. This avoids pretending that the current stage date equals the historical stage-entry date.

## Hostinger note

The JSON cache works for desktop and first Hostinger testing. For long-term production resilience across redeployments, move stage events and saved reports to Supabase/PostgreSQL later. The Odoo source data itself remains in Odoo.
