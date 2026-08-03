# LeadPilot AI

LeadPilot AI is a responsive B2B lead-management dashboard designed for Pakistani construction companies, property dealers, and real-estate sales teams. Phase 2A Stage 4B uses Supabase for authentication, tenancy, team membership, leads, follow-ups, and appointments while preserving the existing product interface.

## Features

- Supabase email/password authentication with SSR cookie refresh and protected routes
- Database-authoritative profile, company membership, and role resolution
- Multi-company selector with membership-validated HTTP-only preference
- Owner/admin membership management and manager/representative restrictions
- Hashed, expiring, single-use invitations delivered to local Mailpit
- Password recovery, callback validation, secure logout, and access-denied states
- Live lead-derived dashboard KPIs, reports, and team performance scoped by RLS
- Server-filtered, sorted, and paginated lead list with 20 realistic seed records
- Validated, idempotent lead creation and optimistic-concurrency editing
- Atomic conversion, controlled assignment, soft-archive service, and append-only activity
- Detailed lead profiles, database activity timeline, and clearly labeled demo AI insights
- Role-scoped follow-up board with real create, reschedule, complete, and cancel actions
- Persistent appointments with filtering and controlled confirm/complete/cancel transitions
- Responsive sidebar/mobile navigation, accessible forms, empty/loading/not-found states, and toast feedback

## Tech stack

- Next.js 15 App Router
- React 19 and TypeScript
- Tailwind CSS 4
- Lucide React icons
- Supabase JS and Supabase SSR
- PostgreSQL/RLS as the runtime authority for leads, follow-ups, and appointments

## Folder structure

```text
src/
  app/                 Routes, layouts, and global styles
    (app)/             Authenticated dashboard routes
  components/          Shared shell, UI, dialog, toast, and AI insight
  data/                Seed-aligned fixtures retained for tests and presentation copy
  data-access/         Typed Supabase repositories and domain services
  services/            Tenant and membership workflows
  actions/             Validated server-side membership and business mutations
  lib/                 Supabase, email, constants, and formatting utilities
  types/               Domain interfaces
```

## Installation and development

Requires Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Other commands:

```bash
npm run lint
npm run build
npm start
npm run qa:e2e
npm run qa:screenshots
```

`qa:e2e` runs the product-readiness browser checks against a production server at
`http://localhost:3000` using an installed Google Chrome browser.

### Review screenshots

Start the application, then run `npm run qa:screenshots`. The command uses the
installed Chrome browser through `playwright-core` and saves full-page captures
for the login, dashboard, leads, new lead, follow-ups, appointments, reports,
team, and settings pages in:

```text
qa-artifacts/screenshots/desktop-1440/
qa-artifacts/screenshots/mobile-390/
```

Set `CHROME_PATH` or `QA_BASE_URL` when Chrome or the application uses a
different location. Browser binaries are not downloaded or stored in the project.

## Local authentication accounts

No reusable password is committed. With local Supabase running, prepare
repeatable git-ignored QA accounts after a database reset:

```bash
npm run auth:prepare-local
```

The command writes public local configuration and generated test passwords to
the ignored `.env.local`, then provisions the seeded Auth users without
printing credentials.

## Current limitations

- Authentication is local Supabase Auth until a hosted project is configured.
- Leads, follow-ups, appointments, dashboard workflow metrics, and team workload are shared Supabase data.
- Notifications and company-settings UI remain deferred.
- Unsynced legacy lead/workflow localStorage data is removed, not silently imported into a tenant.
- Demo AI insights are deterministic copy and do not call an AI model.
- Reminder delivery is disabled until a later integration stage.
- Seed dates are deterministic for repeatable database verification.
- No external integrations, payments, messaging, or cloud database are used.

## Phase 2A database foundation

Stage 0 and Stage 1 add the versioned Supabase/PostgreSQL foundation. Stage 2
replaces the demo authentication cookie with real Supabase Auth and resolves
the signed-in user, profile, company membership, and role on the server. Stage
3 adds tenant switching, role management, invitations, and membership audit
history. Stage 4A makes Supabase the sole runtime authority for leads. Stage
4B adds controlled follow-up and appointment workflows, activity history,
timezone-aware metrics, and retirement of the old browser-local context.

The database foundation is in:

```text
supabase/
  config.toml
  migrations/
  seed.sql
  tests/database/
```

It contains company-scoped tables, role-aware RLS policies, controlled
membership and invitation functions, append-only membership audit history,
concurrency-safe lead numbering, controlled lead mutation functions,
append-only lead activities, deterministic demo data, and local pgTAP
assertions, persistent company settings, in-app notifications, and optional
company-controlled AI lead intelligence.

### Environment variables

Copy `.env.example` to an untracked `.env.local` only when working with
Supabase:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=
SUPABASE_SERVICE_ROLE_KEY=
AI_PROVIDER=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-terra
AI_REQUEST_TIMEOUT_MS=30000
AI_MOCK_DEMO_ENABLED=
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. It must never be placed in a
`NEXT_PUBLIC_` variable, committed, logged, or imported by browser code. Raw
JWT secrets are neither required nor supported by this repository.

AI assistance is opt-in and server-side. `AI_PROVIDER=openai` requires a
server-only `OPENAI_API_KEY`; the browser never receives that key. The
deterministic provider is selected explicitly with `AI_PROVIDER=mock` and is
intended only for local/CI QA. Company owners/admins must separately accept the
data-minimization notice and enable AI in Settings. See
`docs/PHASE_2A_STAGE_6_AI_LEAD_INTELLIGENCE.md` for the provider boundary,
privacy contract, quotas, and operational controls.

For a hosted **demo/staging** environment, follow
`docs/HOSTED_DEMO_DEPLOYMENT.md`. It defines the guarded seed, Vercel variables,
Supabase Auth URLs, email limitations and rollback order. Never run local
database reset, Auth provisioning or E2E cleanup against a linked project.

### Local Supabase workflow

Supabase local development requires the Supabase CLI and a running
Docker-compatible container engine. From the repository root:

```bash
npx supabase start
npx supabase db reset
npm run auth:prepare-local
npx supabase test db
```

Local invitation messages are captured by Mailpit at
`http://127.0.0.1:54324`. See
`docs/PHASE_2A_STAGE_3_MEMBERSHIP.md` for the role matrix, invitation lifecycle,
and tenant selection behavior. See `docs/PHASE_2A_STAGE_4A_LEADS.md` for the
lead architecture, permissions, validation, and verification results. See
`docs/PHASE_2A_STAGE_4B_FOLLOWUPS_APPOINTMENTS.md` for workflow permissions,
status transitions, timezone handling, and localStorage retirement. See
`docs/PHASE_2A_STAGE_5_SETTINGS_NOTIFICATIONS.md` for company configuration,
profile preferences, notification RLS, event generation, and the local
due/overdue processor.

`npx supabase db reset` is destructive to the local database: it reapplies
the timestamped migrations and then runs `supabase/seed.sql`. Never run a
linked reset against production.

The seed is idempotent and creates:

- Prime Build & Properties
- Ahmed Khan, Sara Malik, Usman Ali, and Hira Shah memberships
- 20 leads distributed across February–July 2026
- 4 converted leads
- 20 normalized follow-up records, with 5 due on the demo reference date
- 5 appointments, including 3 upcoming site visits
- Company settings and lead-created activities
- A minimal second tenant used only for isolation tests

The seed validates these Phase 1 parity totals and excludes soft-deleted rows:

```text
Total leads:             20
Hot / Warm / Cold:       8 / 8 / 4
Converted:               4 (20%)
Active pipeline:         Rs 66 Crore
Follow-ups on 2026-07-23: 5
Upcoming site visits:    3
Assigned leads:          5 per salesperson
```

Seeded Auth rows initially use randomized, unknowable password hashes; no
reusable password is committed. `npm run auth:prepare-local` safely obtains the
local service credential in process memory, reuses or generates ignored local
test passwords, and provisions owner, representative, no-membership, and
suspended-membership QA accounts. The provisioning code refuses remote
projects by default.

### Database type generation

Generate TypeScript types only after the local database has successfully
started and all migrations have been applied:

```bash
npx supabase gen types typescript --local --schema public > src/types/database.ts
```

PowerShell alternative:

```powershell
npx supabase gen types typescript --local --schema public |
  Set-Content -Encoding utf8 src/types/database.ts
```

`src/types/database.ts` is generated from the verified local schema. Regenerate
it after schema changes; do not hand-edit it.

### Soft-delete contract

`leads`, `follow_ups`, and `appointments` have `deleted_at` columns and partial
indexes for live records. Lead repositories, activities, and aggregates
exclude archived records. Stage 4A exposes the controlled archive/restore
service without adding a new prominent delete interface.

### Local notification processing

Stage 5 in-app due and overdue alerts can be generated explicitly in local
development. The command is idempotent and refuses remote Supabase URLs:

```bash
npm run notifications:process-local
```

No background scheduler or external delivery channel is enabled.

### Local deterministic AI QA

No live provider call is required for regression testing. Build and start the
application with explicit local-only mock configuration, then run the normal
browser suite:

```powershell
$env:AI_PROVIDER="mock"
$env:AI_ALLOW_MOCK_IN_PRODUCTION_TESTS="true"
npm run build
npm run start
npm run qa:e2e
```

The suite resets Stage 6 fixtures, enables AI through the same owner settings
workflow used by the product, validates generation and explicit application,
and leaves the real-provider path uncalled. Never set
`AI_ALLOW_MOCK_IN_PRODUCTION_TESTS` in a customer deployment.

## Later Phase 2 roadmap

- Production OpenAI enablement and operational monitoring
- Email notifications
- WhatsApp Business integration
- Facebook Lead Ads integration
- Audit-history UI
- CSV import and export
- Production deployment
