# SalesOS V8 — Stage Journey Analytics

This package upgrades the working SalesOS V7.3 project without replacing its Odoo import, Lead 360, Call Analytics, targets, acknowledgements, or V6 interface.

## V8 features

- Stage Trends for every exact Odoo CRM stage.
- From and To date filters with day, week, month, and quarter grouping.
- Historical stage-entry dates reconstructed from `mail.tracking.value` and `mail.message`.
- Exact milestone dates for appointment, campus visit, entrance exam, exam clearance, payment pending, seat allotment, and loss.
- Cohorts: admitted; cleared but not admitted; payment pending; visited but no exam; appointment but no visit; lost after visit; lost after clearance.
- Stage conversion matrix with student count, conversion rate, average days, and median days.
- Student journey analysis and time-between-stage analysis.
- Stage-change ownership: assigned salesperson versus user who moved the stage.
- Milestone compliance checks.
- Outcome-stage loss analysis.
- Historical conversion-based admission forecast.
- Weekday and hour heatmaps.
- Chart Studio Pro with up to five stage measures, bar/line/area series, grouped or stacked bars, and secondary axis.
- Saved reports.
- Clickable lead drill-down.
- Incremental Odoo history sync and cached reports so ordinary filters do not re-download all chatter.

## Install

1. Make a copy of the working V7.3 folder and name it `SalesOS V8`.
2. Download this GitHub branch as ZIP and extract it.
3. Open PowerShell inside `SalesOS-V8-Stage-Analytics`.
4. Run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\apply-v8-upgrade.ps1 -TargetPath "D:\Your Path\SalesOS V8"
```

5. Open PowerShell inside the upgraded project and run:

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

A fixed **V8 Stage Analytics** launcher is inserted into the application layout when the installer can safely identify `src/app/layout.tsx`.

## First sync

Click **Sync Odoo History**. The first sync reconstructs the configured history window. Later syncs are incremental and use an overlap window so changed records are not missed.

Recommended `.env.local` values:

```env
STAGE_EVENTS_FILE=data/stage-events.runtime.json
STAGE_LEADS_FILE=data/stage-leads.runtime.json
STAGE_SYNC_FILE=data/stage-sync.runtime.json
STAGE_REPORTS_FILE=data/stage-reports.runtime.json
ODOO_STAGE_HISTORY_DAYS=730
ODOO_STAGE_TRACKING_LIMIT=50000
ODOO_STAGE_LEAD_LIMIT=10000
STAGE_REPORT_CACHE_SECONDS=120
SALESOS_TIME_ZONE=Asia/Kolkata
SALESOS_TIME_ZONE_OFFSET_MINUTES=330
```

Keep the existing Odoo URL, database, username, and API key unchanged.

## Performance design

Ordinary filter changes query the local event store. They do not call Odoo again. Odoo is contacted only during history sync. Report responses are cached in memory, and long date ranges use pre-aggregated event buckets.

## Important

The JSON cache is suitable for local testing and a single managed Node.js process. Before relying on it across multiple production instances, migrate the four runtime files to PostgreSQL/Supabase.
