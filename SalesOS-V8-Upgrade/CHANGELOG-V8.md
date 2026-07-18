# SalesOS V8 changelog

## Historical stage intelligence

- Added a persistent stage-event store reconstructed from `mail.message` and `mail.tracking.value`.
- Preserves the exact Odoo stage names and tracked timestamps.
- Stores both the person who changed the stage and the currently assigned salesperson.
- Adds a synthetic New-stage entry from the lead creation date only when a full history sync runs.
- Supports incremental sync with a one-day overlap to avoid missing late updates.

## Fast reporting

- Ordinary filter application no longer fetches all Odoo chatter.
- Stage Analytics reads a local JSON event cache and caches repeated filtered responses for 60 seconds.
- Odoo is contacted only through **Sync Odoo history** or the sync API.
- Lead lists are returned separately from chart aggregation and capped for browser safety.

## Stage Trends

- From and To dates.
- Day, week and month granularity.
- Every exact Odoo stage can be charted.
- Entries, exits, net movement, unique students and current backlog.
- Exact hover values and CSV export.

## Cohorts and milestones

- Admitted students: reached `Seat Allotted`.
- Entrance-cleared but not admitted.
- Payment pending but not allotted.
- Visited School but did not write the entrance exam.
- Lost after campus visit.
- Milestone dates for appointment, visit, written exam, cleared exam, payment pending and seat allotted.

## Journey and conversion

- Stage-to-stage conversion matrix.
- Median and average time between consecutive stage movements.
- Milestone journey showing how much of the selected cohort reached each step.
- Median and average time from lead creation to Seat Allotted.

## Chart Studio Pro

- Up to five exact-stage series.
- Bar, line and area series in the same chart.
- Primary and secondary Y axes.
- Saved report configurations.
- Shared From/To, cohort and classification filters.

## Preserved from V7.3

The upgrade does not remove the V6 UI, live Odoo connection, Call Analytics, imports, targets, acknowledgements, team scoring, Lead 360 or the V7.3 visibility fix.
