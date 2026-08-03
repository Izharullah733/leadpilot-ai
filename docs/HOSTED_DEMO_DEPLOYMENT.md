# LeadPilot AI hosted demo deployment

This runbook prepares a **demo/staging** deployment with a Vercel Next.js app
and a separate hosted Supabase project named `leadpilot-demo`. It is not a
production-customer deployment. Do not use customer data, an OpenAI key, or any
external lead-source integration.

## Current readiness decision

The application code builds for Vercel and has no Docker or writable-filesystem
runtime dependency. Hosted deployment must remain paused until all of these
prerequisites are true:

- a new Supabase project named `leadpilot-demo` exists and its project ref is
  independently confirmed;
- a private Git repository exists and its first commit has been reviewed;
- Vercel Preview variables point only to the hosted demo Supabase project;
- migrations have passed a dry run and were pushed without seed data;
- the guarded demo seed target has been checked twice before execution;
- stable Vercel and Supabase Auth URLs have been configured;
- the documented email limitations are accepted.

Current blockers are: no Git metadata, no hosted Supabase project, no private
remote repository, no Vercel project/URL, and no hosted email delivery. These
are expected operator prerequisites, not local application failures.

Confirm Vercel plan eligibility before deployment. Vercel documents its Hobby
plan as personal/non-commercial; a client-facing commercial demo may require a
different eligible plan even when application traffic is small.

## Architecture audit

### Vercel-compatible runtime

- `npm run build` executes `next build`; Vercel should use its normal Next.js
  preset and must not override the output directory.
- Middleware refreshes Supabase cookie sessions and protects application routes.
- Browser, server and middleware clients use only the hosted Supabase URL and
  publishable key. The database remains the authorization authority.
- Auth callback and password recovery derive their origin from the browser or
  incoming HTTPS request. They do not require a localhost URL at runtime.
- Invitation links require `NEXT_PUBLIC_APP_URL`; production rejects a missing
  URL or a non-HTTPS URL.
- Runtime code does not invoke Docker, Supabase CLI, local files, Mailpit or a
  persistent worker. Filesystem/CLI scripts are operator commands only.
- Event-driven in-app notifications work during normal requests. The
  due/overdue processor is deliberately local-only and is **not** a hosted
  scheduler. No background notification schedule is claimed for this demo.
- `AI_PROVIDER=mock` is deterministic and does not instantiate the OpenAI
  client. `AI_MOCK_DEMO_ENABLED=true` is also required in Vercel as an explicit
  production-mode demo acknowledgment. Do not configure `OPENAI_API_KEY`.

### Local-only boundaries

Never run these against the hosted project:

- `npm run auth:prepare-local`
- `npm run notifications:process-local`
- `npm run qa:e2e` (its fixture cleanup and Mailpit assertions are local-only)
- `scripts/prepare-stage3-e2e.mjs`
- `scripts/provision-local-auth-users.mjs`
- `npx supabase db reset --linked`

`supabase/config.toml` contains local ports, Mailpit and localhost Auth URLs.
Those settings configure `supabase start`; they do not configure the hosted
project. Hosted Auth settings must be entered in the Supabase Dashboard.

## 1. Create the hosted Supabase project

Stop after project creation and report only that it exists; do not paste any
key, password or connection string into chat.

1. Sign in to the Supabase Dashboard.
2. Create a new project named exactly `leadpilot-demo` in a demo/staging
   organization.
3. Select a region close to intended reviewers.
4. Generate a unique database password and store it in a password manager.
5. Wait until project health is green.
6. Record the project ref locally without sharing it publicly.

Obtain these values from Project Settings/API and Connect:

- Project URL
- publishable key (preferred) or legacy anon key
- service-role key
- direct or session-pooler PostgreSQL URL
- database password

The service-role key and database URL/password are operator secrets. Do not put
them in a browser variable, Git, screenshots, documentation, or chat.

## 2. Link and migrate safely

From the project root using project-local Node:

```powershell
$env:PATH="$PWD\.tools\node;$env:PATH"
npx supabase login
npx supabase link --project-ref <HOSTED_DEMO_PROJECT_REF>
npx supabase migration list --linked
npx supabase db push --dry-run
```

Review the dry run. It must show only the timestamped migrations in
`supabase/migrations`. Then apply them **without** seed:

```powershell
npx supabase db push
npx supabase migration list --linked
```

Never add `--include-seed`: `supabase/seed.sql` is intentionally local/test
data and includes isolation fixtures. Never use `db reset`, destructive
cleanup, migration-down, or fixture-reset commands against hosted Supabase.

Generate hosted types only after migration status is clean:

```powershell
npx supabase gen types typescript --linked --schema public |
  Set-Content -Encoding utf8 src/types/database.ts
```

Review the resulting file before committing it. A hosted schema should match
the verified local generated types.

## 3. Guarded hosted demo seed

The hosted seed is operator-only and is never run during Vercel deployment.
Create the git-ignored `.env.hosted-demo.local` file locally:

```env
DEMO_SEED_ENABLED=true
DEMO_ENVIRONMENT_NAME=leadpilot-demo
DEMO_SUPABASE_PROJECT_REF=
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DEMO_DATABASE_URL=
DEMO_OWNER_EMAIL=
DEMO_OWNER_PASSWORD=
DEMO_ADMIN_EMAIL=
DEMO_ADMIN_PASSWORD=
DEMO_MANAGER_EMAIL=
DEMO_MANAGER_PASSWORD=
DEMO_REP_EMAIL=
DEMO_REP_PASSWORD=
```

Rules:

- use four unique demo-only email addresses;
- use unique passwords of at least 14 characters from a password manager;
- never copy these values to `.env.example`, Git, Vercel browser variables,
  logs, screenshots or chat;
- confirm the Supabase CLI linked ref, Project URL and database URL all refer to
  the same empty `leadpilot-demo` project;
- take a manual backup/export first if the project is no longer empty.

After explicit confirmation, run once:

```powershell
npm run demo:seed:hosted
```

The command fails closed unless both demo guards, the exact project ref, the
linked CLI ref, the HTTPS Project URL and database URL agree. It derives only
the primary Prime Build tenant from the reviewed local seed, omits isolation
and negative-test users, provisions four confirmed Auth accounts without
emailing passwords, and verifies 20 leads, 4 converted and PKR 660,000,000
active pipeline. It is idempotent for its fixed demo records and explicitly
restores company AI to disabled. Enable AI later through Settings; Vercel still
uses only deterministic mock output.

Do not use this command for customer or unknown projects.

## 4. Supabase Auth URL configuration

In Authentication > URL Configuration set:

- Site URL: `https://<stable-leadpilot-demo-domain>`
- Additional exact redirect URL:
  `https://<stable-leadpilot-demo-domain>/auth/callback`
- Optional local development URL: `http://localhost:3000/auth/callback`
- Optional Vercel preview wildcard:
  `https://*-<vercel-team-or-account-slug>.vercel.app/**`

Use an exact stable URL for the primary demo. Keep preview wildcards restricted
to the actual Vercel team/account pattern. Password reset requests redirect to
`/auth/callback`, which exchanges the PKCE code and then opens
`/update-password`.

Custom company-invitation links are generated by the app from
`NEXT_PUBLIC_APP_URL`; they are not Supabase Auth redirect URLs.

## 5. Email boundary

Supabase's built-in SMTP is best-effort, demo-only, currently limited to two
Auth emails per hour, and without custom SMTP it sends only to email addresses
authorized as members of the Supabase organization. It has no delivery SLA.

Consequences for this no-paid-provider demo:

- existing seeded users can sign in without email delivery;
- password reset can be demonstrated only with an authorized organization
  email, within the low rate limit, and delivery is not guaranteed;
- the application's company invitation email uses its own SMTP transport.
  Mailpit is local-only, so hosted team invitations will fail safely and revoke
  the pending invitation when `SMTP_HOST`/`SMTP_PORT` are absent;
- do not set local Mailpit values in Vercel;
- do not claim invitation or password-reset email is production-grade.

Hosted invitation delivery and confirm-email signup behavior remain a known
demo limitation until a reviewed transactional SMTP provider or Supabase Auth
invitation redesign is approved. No provider is added in this stage.

## 6. Vercel environment variables

Configure values separately for Preview and, only after preview approval,
Production. Environment-variable changes require a new deployment.

| Variable | Classification | Required | Notes |
|---|---|---:|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-safe | Yes | Hosted `leadpilot-demo` URL only |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser-safe | Yes | Publishable key; RLS remains mandatory |
| `NEXT_PUBLIC_APP_URL` | Browser-safe | Yes | Stable HTTPS Vercel demo origin |
| `AI_PROVIDER=mock` | Server-only config | Yes | Never set `openai` |
| `AI_MOCK_DEMO_ENABLED=true` | Server-only, demo-only | Yes | Explicitly permits labelled mock mode on Vercel |
| `AI_REQUEST_TIMEOUT_MS` | Server-only | No | Irrelevant to deterministic mock; omit normally |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only secret | No for app runtime | Prefer omitting from Vercel; use only in the local guarded seed operator file |
| `NEXT_PUBLIC_SITE_URL` | Browser-safe legacy alias | No | Use `NEXT_PUBLIC_APP_URL` instead |
| `SMTP_HOST`, `SMTP_PORT` | Server-only | No | Do not use Mailpit values; invitations fail safely without hosted SMTP |

Do not add any of these to Vercel:

- `OPENAI_API_KEY` or `OPENAI_MODEL`
- database password or `DEMO_DATABASE_URL`
- `DEMO_*` seed guards/accounts/passwords
- `LOCAL_*` or `QA_*` credentials
- local Supabase keys or URLs

Although requested in many generic Supabase templates,
`SUPABASE_SERVICE_ROLE_KEY` is not used by the current Next.js runtime. Leaving
it out of Vercel is the least-privilege choice.

## 7. Private Git repository

There is currently no `.git` directory. Before initializing, copy the project
to a recoverable backup or create a filesystem snapshot. Then, only with owner
approval:

```powershell
git init
git branch -M main
git status --ignored
git add .
git status --short
git diff --cached --check
git commit -m "Prepare LeadPilot hosted demo"
```

Before committing, verify `.env.local`, `.env.hosted-demo.local`, `.tools`,
`.next`, `node_modules`, Supabase temporary link metadata, QA screenshots and
server logs are ignored/untracked. Scan the staged diff for URLs, keys,
passwords and connection strings. Create a **private** GitHub/GitLab/Bitbucket
repository, add its remote, and push `main`. Do not overwrite any remote history.

## 8. Import into Vercel

1. Import the reviewed private repository.
2. Framework preset: Next.js.
3. Root directory: repository root containing `package.json`.
4. Install command: default `npm install`/`npm ci` behavior.
5. Build command: `npm run build`.
6. Do not override Output Directory; Vercel detects `.next`.
7. Add the Preview variables from the table.
8. Deploy Preview; do not promote to Production yet.
9. Copy the stable preview/branch URL into `NEXT_PUBLIC_APP_URL`.
10. Configure that URL in Supabase Auth, then redeploy because environment
    changes do not alter an existing deployment.

The app has no Docker dependency on Vercel. Supabase CLI, pgTAP, seed scripts,
local notification processing and E2E cleanup must not run in Vercel build or
runtime commands.

## 9. Pre-deployment validation

Keep local Docker, Supabase and the production-mode local app running, then run:

```powershell
npx supabase test db
npm run lint
npm run build
npm run qa:e2e
npm audit
```

These are local tests only. Clean local QA fixtures afterward using the existing
local-only cleanup. Do not point QA credentials or `QA_BASE_URL` at hosted
Supabase because the suite intentionally mutates and cleans test records.

## 10. Hosted preview verification

Use dedicated seeded demo accounts and manually verify:

- login, logout, refresh and browser Back after logout;
- protected redirects before login;
- Owner and Sales Representative data scope;
- dashboard, leads CRUD, details and conversion;
- follow-ups and appointments;
- reports and team totals;
- settings and in-app event notifications;
- password reset only if the authorized-address/default-email boundary permits;
- invitation failure is clear when hosted SMTP is intentionally absent;
- AI badge says `Mock / test mode`, AI is manually enabled in Settings, and no
  OpenAI key or request exists;
- 1440px, 820px, 430px and 390px layouts;
- browser console, hydration errors and horizontal overflow;
- Vercel Functions logs contain no credentials or personal seed payloads.

Do not use the local destructive E2E suite as a hosted smoke test. Record each
manual hosted result honestly.

## 11. Safe verification queries

Run read-only queries in the hosted Supabase SQL Editor after seed:

```sql
select name, slug from public.companies where deleted_at is null;

select count(*) as total_leads,
       count(*) filter (where stage = 'converted') as converted_leads,
       coalesce(sum(budget_pkr) filter (where stage not in ('converted','lost')), 0) as active_pipeline
from public.leads
where company_id = '10000000-0000-0000-0000-000000000001'
  and deleted_at is null;

select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

Expected primary totals are 20, 4 and 660000000. Every tenant business table
must retain RLS. Do not paste query output containing personal fields into chat.

## 12. Security checklist

- Hosted project is demo-only and contains synthetic data.
- Local and hosted Supabase credentials are never mixed.
- Publishable key is the only Supabase key exposed to the browser.
- Service-role key and database password remain operator-only.
- No `OPENAI_API_KEY`; AI provider and badge both indicate mock.
- RLS migrations and 244 pgTAP assertions pass locally.
- No seed or migration command is part of Vercel builds.
- No localhost or Mailpit variable exists in Vercel.
- Stable HTTPS Site URL and exact callback are allow-listed.
- Preview wildcard is restricted to the actual Vercel account.
- Git repository is private and staged content has been secret-scanned.
- Logs, screenshots and documentation contain no credentials.
- Hosted email limitations are disclosed to every reviewer.

## 13. Rollback

### Vercel

- Keep the last known-good deployment.
- Roll back/instant-rollback to it from the Vercel deployment history.
- If configuration is wrong, remove the affected deployment, correct scoped
  environment variables, and redeploy. Rotating a leaked secret is mandatory;
  deleting a deployment alone is insufficient.

### Supabase

- Do not run remote `db reset` or destructive migration-down commands.
- Before seed or a schema change, record migration status and take the best
  available logical backup/export for the plan.
- Correct schema problems with a reviewed forward migration.
- For a disposable demo that cannot be safely repaired, disconnect Vercel,
  archive/delete only the explicitly identified `leadpilot-demo` project, create
  a fresh demo project, push migrations, and run the guarded seed again.
- Rotate the service-role key and database password if either may be exposed.

Supabase free projects can pause after low activity and default email/backups
have plan limitations. Treat availability and recovery as demo-grade only.

## Local readiness results — 2026-08-02

- Hosted seed is disabled by default: pass.
- Derived primary-tenant seed executed successfully inside a rollback-only
  local PostgreSQL transaction; no isolation fixture was present.
- Local pgTAP: 244/244 assertions passed after a clean deterministic reset.
- ESLint: passed.
- Next.js 15.5.21 production build: passed.
- Browser QA: 36/36 passed, including mock AI, Auth, invitation, responsive
  viewports, console and hydration checks.
- `npm audit`: 0 vulnerabilities.
- Final local parity: 20 leads, 4 converted, PKR 660,000,000 active pipeline.
- Local app restored and running at `http://localhost:3000`.
- Hosted resources created, linked, seeded or deployed: none.
