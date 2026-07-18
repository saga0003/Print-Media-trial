# SalesOS V8 Changelog

## Stage history and performance

- Added a dedicated stage-event history engine using Odoo `mail.tracking.value` and `mail.message`.
- Added first full sync and later incremental sync with a three-day overlap window.
- Added local event, lead, sync-state, and saved-report stores.
- Ordinary filter changes now read cached analytics instead of re-downloading complete Odoo chatter.
- Added memory-cached report responses.

## Stage analytics

- Replaced the single Admissions Trend idea with Stage Trends for every exact Odoo stage.
- Added entries, exits, net movement, unique students, current backlog, conversion, average duration, and median duration.
- Added From and To dates with day, week, month, and quarter grouping.
- Added Academic Year, Institute, Grade, Programme, Salesperson, Lead Source, and Cohort filters.

## Milestones and cohorts

- Added appointment-scheduled, campus-visit, entrance-exam, exam-cleared, payment-pending, allotted, and lost dates.
- Added admitted, cleared-not-admitted, payment-pending, visited-no-exam, appointment-no-visit, lost-after-visit, lost-after-clearance, and stagnant cohorts.
- Added student-level milestone table, recommended next action, and Odoo record link.

## Decision analytics

- Added stage-conversion matrix.
- Added time-between-stage analysis with average and median days.
- Added milestone compliance analysis.
- Added stage-change ownership analysis.
- Added outcome-stage loss analysis.
- Added historical conversion-based conservative, likely, and optimistic forecast.
- Added weekday/hour movement heatmap.

## Chart Studio Pro

- Added up to five independent stage measures.
- Added bar, line, and area series.
- Added primary and secondary axes.
- Added grouped and stacked bars.
- Added up to three simultaneous dimensions: date, institute, grade, programme, salesperson, lead source, from stage, and to stage.
- Added a dedicated advanced Chart Studio route at `/stage-analytics/chart-studio`.

## Installation

- Added safe PowerShell installer.
- Existing files are backed up before replacement.
- Existing Odoo secrets remain untouched.
- Adds a V8 launcher to the application layout when safe.
- Adds the `test:v8-stage` contract test and Recharts dependency when missing.
