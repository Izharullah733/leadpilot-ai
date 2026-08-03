# Phase 2A Stage 4A — Leads

Stage 4A makes Supabase/PostgreSQL the only runtime authority for leads and
lead-derived dashboard, report, and team figures. The interface and the
deferred browser-local appointment/follow-up workflows remain intact.

## Baseline recorded before implementation

- Local Supabase services were healthy.
- Database tests passed 58/58.
- Lint and production build passed.
- `npm audit` reported 0 vulnerabilities.
- Browser QA passed 26/27. The one failure was the existing logout navigation
  race (`page.goto` interrupted by the logout redirect); it was recorded rather
  than reported as a pass.
- Prime Build seed parity was 20 leads, 8/8/4 hot/warm/cold, 4 converted,
  20% conversion, Rs 660,000,000 active pipeline, and 5 leads per member.

## Data architecture

UI components do not issue raw lead queries. Reads flow through:

```text
server page
  -> lead-service / lead-report-service
  -> leads / lead-activities repository
  -> authenticated Supabase server client
  -> RLS-scoped PostgreSQL
```

Mutations flow through validated server actions and controlled PostgreSQL
functions. The selected company and active membership are resolved on the
server. Forms never supply an authoritative company ID or role.

The repositories select explicit columns and return typed lead DTOs. Member
UUIDs remain the assignment authority; profile names are resolved only for
display. Search, filters, sorting, counts, and ten-item pagination execute in
PostgreSQL.

## Permissions

| Operation | Owner | Admin | Sales manager | Sales representative |
| --- | --- | --- | --- | --- |
| View company leads | All | All | All | Assigned only |
| Create | Any active assignee | Any active assignee | Any active assignee | Self-assigned only |
| Edit | All company leads | All company leads | All company leads | Assigned leads |
| Reassign | Yes | Yes | Yes | No |
| Convert | Yes | Yes | Yes | Assigned leads |
| Archive/restore | Yes | Yes | Yes | No |
| View activities | Visible leads | Visible leads | Visible leads | Assigned leads |

The database is authoritative. Authenticated clients have no direct
insert/update/delete privilege on leads and cannot insert or alter activity
history. Security-definer functions use an empty `search_path`, `auth.uid()`,
active membership checks, role checks, same-company assignee validation, and
safe error codes.

## Lead numbering and mutations

`lead_number_counters` stores the next company-scoped number. `create_lead`
uses a request advisory transaction lock plus an atomic counter-row upsert,
whose row lock serializes allocations for the company. It does not calculate
`MAX(lead_number) + 1` in browser code. A request UUID stored in
`lead_create_requests` makes repeated form submissions idempotent.

`update_lead` locks the current row and compares `updated_at` for optimistic
concurrency. It rejects stale edits, cross-tenant assignees, suspended
assignees, representative reassignment, direct conversion transitions, and
reopening converted leads.

`convert_lead` updates stage, `converted_at`, updater, and activity in one
transaction. Repeating it returns without creating a second conversion
activity. `set_lead_archived` provides controlled soft archive/restore without
adding a new prominent delete control.

## Validation

Server validation covers name length, Pakistani phone normalization, optional
email syntax, service, location, property size, integer PKR budget, timeline,
source, score 0–100, temperature, stage, notes length, active assignee, and the
idempotency request UUID. UI errors are safe and do not expose raw database
messages.

## Activity history and aggregates

Creation, assignment, stage, temperature, general edit, conversion, archive,
and restore operations append immutable company-scoped activities. Lead detail
loads the real activity timeline and actor display name.

Dashboard, reports, and team pages share `lead-report-service`. It derives
total/status/conversion/pipeline figures, sources, services, stages, monthly
trend, recent leads, deterministic top performer, assignments, conversions,
pipeline, and average score from one RLS-visible dataset. Active pipeline
excludes converted, lost, and archived leads. Report date boundaries use
Pakistan company-timezone offsets.

## localStorage retirement

`leadpilot-demo-leads` is no longer read or written and is removed when the
deferred demo workflow context starts. Unknown old browser data is not
automatically imported into a tenant. Mock leads remain only as seed/test and
deferred follow-up presentation fixtures.

The following remain explicitly local/demo in Stage 4A:

- follow-up records and completion
- appointment records and scheduling
- notification content
- company business settings
- deterministic AI insight text

## Verification commands

```bash
npx supabase db reset
npm run auth:prepare-local
npx supabase test db
npx supabase gen types typescript --local --schema public
npm run lint
npm run build
npm start
npm run qa:e2e
npm audit
```

The browser suite covers owner and representative lead visibility, tenant
switching, search, every filter, sorting, pagination, validation, creation,
assignment, optimistic edit, conversion, activity, refresh persistence,
invalid/unauthorized IDs, derived aggregate updates, concurrent numbering,
logout/session behavior, and 1440/820/430/390 px layouts.

## Final executed results

- Clean reset and seed: pass
- Database tests: 100/100 pass
- Generated database types: `src/types/database.ts`
- Lint: pass
- Production build: pass (Next.js 15.5.21)
- Production browser QA: 28/28 pass
- Viewports: 1440, 820, 430, and 390 px pass with no horizontal overflow
- Runtime console/hydration check: pass, no errors
- Audit: 0 vulnerabilities
- Post-QA deterministic reset: pass; Prime Build restored to 20 leads,
  8/8/4 hot/warm/cold, 4 converted, Rs 660,000,000 active pipeline, and
  5 assignments per active member

## Rollback and next stage

Rollback is additive: return the UI to the prior context implementation and
remove the Stage 4A migration only in a disposable/local database, then run a
clean reset. Production rollback must use a forward migration; never edit an
already-applied migration or hard-delete tenant data.

Follow-ups and appointments are the recommended next migration stage after all
final checks pass. This document does not authorize or begin that stage.
