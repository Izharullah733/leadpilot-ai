# Phase 2A — Stage 3 Membership and Tenant Shell

Date: 2026-07-24

## Scope and baseline

Stage 3 adds database-authoritative company selection, membership administration,
role hierarchy, secure invitations, and audit history. Leads, follow-ups,
appointments, dashboard, reports, and business settings remain the Phase 1
React context/localStorage demo.

Executed baseline results before Stage 3:

| Check | Result |
|---|---|
| Supabase status | PASS; local stack healthy |
| Database tests | PASS; 20/20 |
| Lint | PASS |
| Build | PASS |
| Browser QA | 23/24; functional/auth checks passed, one `/favicon.ico` console 404 was recorded |
| npm audit | PASS; 0 vulnerabilities |

## Tenant selection

`public.list_my_tenants()` returns only active memberships in active companies.
The server resolves the selected company on every protected render. The
HTTP-only `leadpilot_company` cookie is a preference only: an unknown,
suspended, removed, or cross-company value is ignored and safely falls back to
an authorized membership. The selector appears only for users with multiple
active memberships.

## Role matrix

| Capability | Owner | Admin | Sales manager | Sales representative |
|---|---:|---:|---:|---:|
| View all members | Yes | Yes | Yes | No; self only |
| View invitations | Yes | Yes | Yes | No |
| Invite admin | Yes | No | No | No |
| Invite manager/representative | Yes | Yes | No | No |
| Manage owners/admins | Owner only | No | No | No |
| Manage manager/representative | Yes | Yes | No | No |
| Change own role/status | No | No | No | No |

The final active owner trigger remains authoritative. Direct authenticated
writes to `company_members` and all authenticated table access to
`company_invitations` are revoked; controlled functions revalidate `auth.uid()`,
active membership, tenant, and current database role.

## Invitation lifecycle

1. An owner/admin submits an allowed role and normalized email.
2. The server generates a 256-bit random token and stores only its SHA-256 hash.
3. A 72-hour, single-use link is delivered to local Mailpit.
4. Anonymous inspection reveals only safe invitation presentation fields.
5. Acceptance requires an authenticated, confirmed account with the exact
   invited email.
6. One transaction activates/creates membership, marks the invitation accepted,
   records acceptance metadata, and writes audit history.
7. Resend rotates the token and expiry. Revoke invalidates the invitation.

Invite-only signup UI is available through a valid invitation reference.
Direct public signup without membership cannot enter the application shell.
Production mail delivery remains deferred.

Local Mailpit is available at `http://127.0.0.1:54324`; SMTP is exposed on
port `54325`. Raw invitation links, local passwords, and server credentials
must never be copied into source or documentation.

## Data-access and audit architecture

- `src/data-access/repositories` contains typed raw Supabase RPC calls.
- `src/services` resolves authorization and membership/invitation workflows.
- `src/actions` exposes safe server mutation results to the UI.
- `membership_audit` records invitation and member lifecycle events. Normal
  users cannot insert, update, or delete audit history.
- Sensitive security-definer functions use an empty explicit `search_path`,
  `auth.uid()` authority, and restricted execute grants.

## Local workflow

```bash
npx supabase start
npx supabase db reset
npm run auth:prepare-local
npx supabase test db
npm run build
npm start
npm run qa:e2e
```

`qa:e2e` performs a local-only deterministic fixture cleanup before browser
checks. The cleanup obtains the local service credential in process memory and
does not print or persist it. Mailpit is also cleared for deterministic invite
verification.

## Executed final validation

| Check | Result |
|---|---|
| Database reset | PASS; all five migrations and seed applied |
| Database tests | PASS; 58/58 across 3 files |
| Generated types | PASS; `src/types/database.ts`, 33,908 bytes |
| Lint | PASS |
| Build | PASS; 19 routes |
| Browser QA | PASS; 27/27 |
| npm audit | PASS; 0 vulnerabilities |

Browser QA ran against the production server. Business routes were checked at
390px, 430px, and 820px; auth pages at 1440px, 820px, and 390px. Stage 3 tests
covered multi-tenant selection and forged preference fallback, all four role
views, Mailpit delivery, wrong-email denial, atomic acceptance, and token reuse
denial. No console, hydration, React runtime, or horizontal-overflow error was
recorded in the passing run.

## Remaining limitations

- Business records and metrics are still browser-local and are not
  tenant-secured. Team cards explicitly label those values as demo metrics.
- A production email provider, public company onboarding, invitation rate
  limiting, and hosted Supabase deployment are deferred.
- There is no dedicated audit-history UI.
- Ownership transfer uses safe owner promotion and the final-owner invariant;
  no separate guided transfer wizard is included.
