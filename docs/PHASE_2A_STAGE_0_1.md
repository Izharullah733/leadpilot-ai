# Phase 2A — Stage 0 and Stage 1

Date: 2026-07-23

## Scope

This increment adds and verifies the local Supabase/PostgreSQL foundation while
keeping the Phase 1 application independent from Supabase at runtime.

Explicit non-goals:

- Supabase authentication in the application
- Replacing the demo cookie, React context, or `localStorage`
- Importing Supabase clients into UI routes
- Invitation, notification, password-reset, or external-integration workflows

## Verified environment

| Component | Executed result |
|---|---|
| Docker Desktop | 4.83.0.234302; Engine running |
| Docker CLI / Engine | 29.6.2 (`desktop-linux`, Linux containers) |
| WSL | 2.7.10.0; default version 2; kernel 6.18.33.2-2 |
| Node | v24.18.0 from `.tools/node` |
| npm | 11.16.0 |
| Supabase CLI | 2.109.1, installed as a project dev dependency |

Docker, WSL, Node, npm, and Supabase versions were verified from the project
root. The project-local Node installation was added to the process PATH because
global Node was unavailable.

## Executed local workflow

The verified order is:

1. `npx supabase start`
2. `npx supabase db reset`
3. Provision local Auth credentials using temporary process-only environment
   variables
4. Verify parity and RLS
5. `npx supabase test db`
6. Generate database types from the running schema
7. Run Phase 1 regression checks

Provisioning follows the reset because a reset recreates the seeded Auth rows
and their randomized password hashes. No local test password or service-role
credential was written to a source file, documentation, or environment file.

## Migration, seed, and runtime results

- All three migrations applied in order:
  `foundation_schema`, `safeguards`, then `rls_foundation`.
- The initial seed execution correctly stopped on its parity assertion because
  active pipeline data totaled PKR 660,100,000 instead of PKR 660,000,000.
- The smallest data correction was applied to one active demo lead budget
  (PKR 3,900,000 to PKR 3,800,000).
- A complete `npx supabase db reset` then passed, including migrations and seed.
- Four demo users received unique cryptographically generated local-only
  passwords. Five seeded Auth users, including the isolation fixture, were
  confirmed in the database.
- The first password-generation shell attempt used an unavailable static .NET
  API and made no user updates. It was rerun with the compatible cryptographic
  RNG instance.
- Optional local Analytics was disabled because its Vector collector repeatedly
  attempted to use the Windows Docker TCP endpoint. This avoids enabling the
  unauthenticated Docker daemon endpoint on port 2375. Database, Auth, REST,
  Realtime, Storage, Studio, and gateway services remain available.
- After the configuration restart, `npx supabase status` returned exit code 0,
  core health checks passed, and seeded data/Auth users remained intact.

## Verified database parity

| Metric | Real local database result |
|---|---:|
| Company | Prime Build & Properties |
| Active team members | 4 |
| Total leads | 20 |
| Hot / warm / cold | 8 / 8 / 4 |
| Converted leads | 4 |
| Conversion rate | 20% |
| Active pipeline | PKR 660,000,000 |
| Assigned leads per member | 5 / 5 / 5 / 5 |
| Follow-ups due on 2026-07-23 | 5 |
| Upcoming site visits | 3 |
| Isolation-test tenants | 1 separate tenant |

## Database and security validation

`npx supabase test db` passed twice, including after the final stack restart:

- Files: 1
- pgTAP assertions: 15
- Result: PASS

Manual role impersonation in a rolled-back SQL transaction confirmed:

- anonymous reads are denied (`42501`);
- cross-company reads return zero rows;
- forged `company_id` inserts are denied (`42501`);
- cross-company assignee references are rejected (`23503`);
- owner, admin, and sales manager each see all 20 company leads;
- the sales representative sees exactly 5 assigned leads;
- the representative cannot see a temporarily unassigned lead;
- the final active owner cannot be removed or demoted (`23514`).

No service-role credentials or secret-key patterns were found in browser-facing
`src` source code.

## Generated database types

The running local schema generated:

`src/types/database.ts`

The file is 29,036 bytes and contains generated definitions for all nine public
tables. An initial generation attempt lacked Docker on the subprocess PATH and
produced an error stub; the file was replaced by a successful schema-generated
result and was not manually fabricated or edited.

## Final regression validation

| Command | Final result |
|---|---|
| `npm run lint` | PASS; exit code 0 |
| `npm run build` | PASS; Next.js 15.5.21 production build and 14 routes |
| `npm run qa:e2e` | PASS; 17/17 browser checks |
| `npm audit` | PASS; 0 vulnerabilities |

The first E2E invocation was made without its documented production-server
prerequisite and failed with `ERR_CONNECTION_REFUSED`. After `npm start`
reported ready on `localhost:3000`, the complete suite was rerun and passed
17/17. The passing suite covered the existing Phase 1 authentication,
navigation, lead workflows, localStorage recovery, dialogs, console/runtime
errors, and responsive widths of 390px, 430px, and 820px.

## Stage boundary

Stage 2 authentication migration has not started. The existing demo cookie,
React context, localStorage data flow, UI routes, and Phase 1 workflows remain
unchanged.
