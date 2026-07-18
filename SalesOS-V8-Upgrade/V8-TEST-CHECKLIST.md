# SalesOS V8 test checklist

## Upgrade safety

- [ ] Apply the upgrade to a copy of the working V7.3 folder.
- [ ] Confirm `.v8-backup-<timestamp>` was created.
- [ ] Existing Command Center, All Leads, Call Analytics and Import Data still open.
- [ ] V7.3 imported opportunities remain visible in Odoo.

## Installation

- [ ] `npm install --registry=https://registry.npmjs.org/` completes.
- [ ] `npm run test:v8-stage` passes.
- [ ] `npm run typecheck` passes.
- [ ] `npm run build` passes before Hostinger deployment.
- [ ] `/stage-analytics` opens without overlaying another tab.

## First history sync

- [ ] Click **Run first full sync**.
- [ ] The response shows stage events and lead snapshots greater than zero.
- [ ] Exact Odoo stages appear in the Stage Register.
- [ ] Academic Year, Institute, Grade, Programme and Salesperson options appear.
- [ ] `data/stage-events.runtime.json` is created and has content.

## Speed behaviour

- [ ] Change draft filters and confirm the charts do not change before Apply.
- [ ] Click **Apply filters** and confirm no full Odoo sync starts.
- [ ] Repeat the same filters and confirm the response is fast.
- [ ] Click **Sync Odoo history** only when fresh Odoo history is required.
- [ ] Existing live alerts remain separate from Stage Analytics.

## Stage trend accuracy

- [ ] Appointment Scheduled uses its actual tracked stage-change date.
- [ ] Visited School uses the date the lead entered Visited School.
- [ ] Written Entrance Exam and Re-Test appear as examination milestones.
- [ ] Entrance Exam Cleared uses the tracked stage-entry date.
- [ ] Payment Pending uses `Seat Confirmed: Payment Pending`.
- [ ] Admission uses only `Seat Allotted`.
- [ ] From/To dates limit stage entries correctly.
- [ ] Day, week and month granularity work.
- [ ] Hover shows exact values.

## Cohorts

- [ ] Admitted cohort contains leads that reached Seat Allotted.
- [ ] Cleared-not-admitted contains leads that reached Entrance Exam Cleared but not Payment Pending/Seat Allotted.
- [ ] Payment-pending-not-allotted contains the expected students.
- [ ] Visited-not-exam contains visits without exam stages.
- [ ] Lost-after-visit contains genuine lost/rejected stages after a visit.
- [ ] Wrong Lead and Duplicates are not mistaken for genuine lost admissions.

## Conversion and journey

- [ ] Conversion Matrix includes the first New-to-next-stage movement.
- [ ] Median days are not distorted by a single very old lead.
- [ ] Journey milestones show the correct number of students.
- [ ] Median time to admission uses lead creation to first Seat Allotted entry.
- [ ] Open in Odoo opens the exact selected lead.

## Chart Studio Pro

- [ ] Five stage series can be selected.
- [ ] Bar, line and area types can coexist.
- [ ] Left and right axes work.
- [ ] Hover values identify each stage.
- [ ] Saved report views persist after restart.
- [ ] CSV exports contain the applied data.

## Incremental sync

- [ ] Change one test lead stage in Odoo.
- [ ] Add a meaningful comment and follow-up as usual.
- [ ] Click Sync Odoo history.
- [ ] The new stage event appears without re-reading the entire historic period.
- [ ] The same event is not duplicated after another sync.
