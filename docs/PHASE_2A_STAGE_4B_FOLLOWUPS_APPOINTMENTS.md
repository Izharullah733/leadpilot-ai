# Phase 2A Stage 4B — Follow-ups and appointments

Stage 4B makes Supabase/PostgreSQL the sole runtime authority for leads,
follow-ups, and appointments. Notifications, company-settings UI, reminders,
AI integrations, and production messaging remain deferred.

## Architecture

Reads flow from authenticated server pages through domain services and typed
repositories. Repositories select explicit columns; services resolve the
selected company, active database membership, visible leads, active members,
and company timezone before returning display DTOs. RLS remains active for
every ordinary read.

Mutations flow from client forms to validated server actions and then to
controlled PostgreSQL functions. A form cannot supply an authoritative
company ID or role. Creation request UUIDs provide idempotency, while updates
compare `updated_at` under a row lock and return a safe stale-data conflict.
Ordinary authenticated users have no direct insert, update, or delete
privileges on either workflow table.

## Permissions

| Operation | Owner / Admin / Manager | Sales representative |
| --- | --- | --- |
| View follow-ups | Company-wide | Assigned or linked to an accessible lead |
| Create follow-up | Any accessible company lead/active assignee | Assigned lead, self-assigned |
| Reschedule/complete/cancel | Company-wide pending records | Own assigned pending records |
| View appointments | Company-wide | Assigned or linked to an accessible lead |
| Create appointment | Linked or standalone | Assigned lead, self-assigned |
| Edit/status transitions | Company-wide permitted records | Own assigned permitted records |
| Archive/restore | Yes | No |

The database validates same-company leads and active members. Forged tenant,
lead, or assignee identifiers are rejected without exposing cross-company
record existence.

## Status transitions

Follow-ups start as `pending` and may become `completed` or `cancelled`.
Repeating the same terminal transition is idempotent. Completion stores both
completion time and completing member; cancellation stores its timestamp.
Terminal follow-ups cannot be edited.

Appointments start as `pending`. Valid paths are `pending -> confirmed ->
completed`, or cancellation from a non-terminal state. Confirmation and
completion cannot be skipped or replayed into an invalid state. Completed and
cancelled appointments are final.

## Timezone and validation

The company timezone is loaded from `company_settings`, defaulting safely to
`Asia/Karachi`. Follow-up overdue/today/upcoming grouping compares calendar
dates in that timezone. Browser `datetime-local` values are interpreted as
Pakistan local time before being stored as UTC timestamps.

Server validation covers accessible lead, active assignee, required date/time,
priority, notes length, appointment type, linked lead or standalone customer,
start/end ordering, location, and valid transitions. Database constraints and
controlled functions repeat the security-critical checks.

## Activity history

Meaningful linked-lead events are append-only: follow-up scheduling,
rescheduling, completion, cancellation, appointment scheduling,
rescheduling, confirmation, completion, and cancellation. Metadata contains
record IDs, status/time changes, and member IDs only. Normal users cannot
insert, edit, or delete activities directly.

## Browser-local retirement

The demo workflow context was removed. Runtime reads and writes no longer use
the old appointment, completed-follow-up, or scheduled-follow-up localStorage
keys. A small client cleanup removes the retired keys without importing
unknown historical browser data. Unsynced historical local-only changes are
intentionally not migrated.

## Verification

The recorded pre-change baseline was: 100/100 database assertions, 28/28
browser checks, passing lint/build, and zero audit findings.

Final commands:

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

Database coverage includes tenant isolation, all four roles, same-company
relationships, representative self-assignment, idempotent creation and
completion, optimistic conflicts, metadata consistency, time ordering,
transitions, activity creation, soft deletion, timezone aggregates, and role
scoping.

Final executed results:

- Clean local reset and deterministic seed: passed.
- Local Auth reprovisioning: passed without printing credentials.
- Database suite: 154/154 assertions passed across five files.
- Generated database types: regenerated from the running local schema at
  `src/types/database.ts`.
- ESLint: passed.
- Next.js 15.5.21 production build: passed.
- Production Chrome E2E: 30/30 checks passed.
- Viewports exercised: 1440, 820, 430, and 390 pixels.
- Runtime console, React key, and hydration checks: no errors in the final run.
- `npm audit`: zero vulnerabilities after pinning the patched
  `brace-expansion` release through npm overrides.
- Final seed parity: Prime Build & Properties, four active members, 20 leads,
  8/8/4 hot/warm/cold, four converted, PKR 660,000,000 active pipeline, five
  reference-date follow-ups, five appointments, three upcoming site visits,
  and five assigned leads per member.

## Remaining limitations

- Reminder delivery is disabled and explicitly labelled for a later
  integration stage.
- Browser forms currently interpret date/time input using Pakistan time; a
  future settings stage should make editing the company timezone available.
- Lists are bounded to 200 records; cursor pagination should be added before
  high-volume production use.
- Reports have no existing workflow section, so no new chart or report section
  was introduced.
- Notifications, settings migration, AI, WhatsApp, Facebook, payments, and
  public onboarding remain outside Stage 4B.
