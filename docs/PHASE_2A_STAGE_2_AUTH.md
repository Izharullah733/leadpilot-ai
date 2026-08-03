# Phase 2A — Stage 2 Supabase Authentication

Date: 2026-07-24

## Scope

Stage 2 replaces the Phase 1 demo cookie with real Supabase email/password
authentication. It does not migrate leads, appointments, follow-ups,
dashboard, reports, team, settings, or any other business data from React
context and browser `localStorage`.

Deferred work includes invitations, hosted email configuration, business-data
repositories, OpenAI, WhatsApp, Facebook, payments, and notifications.

## Baseline

The following commands passed before Stage 2 changes:

| Command | Baseline result |
|---|---|
| `npx supabase status` | PASS; local core services healthy |
| `npx supabase test db` | PASS; 15/15 pgTAP assertions |
| `npm run lint` | PASS |
| `npm run build` | PASS |
| `npm run qa:e2e` | PASS; 17/17 browser checks |
| `npm audit` | PASS; 0 vulnerabilities |

## Packages

- `@supabase/supabase-js` 2.110.8
- `@supabase/ssr` 0.12.3

Both versions were confirmed from the npm registry before installation.

## Authentication architecture

- Browser operations use a singleton typed Supabase browser client.
- Server Components and route handlers use a typed Supabase server client with
  Next.js cookie adapters.
- Middleware calls `auth.getUser()` to validate and refresh sessions. It does
  not trust a client-created boolean cookie.
- Protected routes receive private no-store cache headers.
- Login redirects accept only allow-listed internal application paths. Scheme
  URLs, protocol-relative URLs, backslashes, and non-application paths fall
  back to `/dashboard`.
- The protected server layout independently calls `auth.getUser()` before
  rendering application content.
- `public.get_my_auth_context()` is a self-only `security definer` function. It
  derives profile, company, membership status, and role from `auth.uid()` and
  accepts no client-supplied user, company, or role.
- Only active memberships in active companies receive the application shell.
  Suspended and missing memberships receive dedicated denial states.
- The application shell displays the resolved database name, company, and
  role. It does not claim that localStorage business records are protected by
  database RLS.

## Login, logout, and recovery

- `/login` uses `signInWithPassword`.
- Authenticated users are redirected away from `/login`.
- `/auth/logout` signs out the local Supabase session, returns a 303 redirect,
  sends private no-store headers, and clears browser cache data.
- `/forgot-password` requests a Supabase recovery email and always presents a
  professional generic success state.
- `/auth/callback` exchanges a valid PKCE code and sends invalid or expired
  codes to a safe error state.
- `/update-password` requires a valid authenticated recovery session, validates
  a 12-character password and confirmation, updates it through Supabase, then
  signs out.

## Local test accounts

No test password is committed or printed. After a local database reset:

```bash
npm run auth:prepare-local
```

The command:

1. reads local Supabase status without printing credentials;
2. creates or reuses cryptographically generated passwords in git-ignored
   `.env.local`;
3. provisions seeded Auth users through the local Admin API;
4. exposes only public Supabase configuration to the Next.js browser bundle.

QA fixtures cover an owner, sales representative, user without membership, and
suspended member. The service-role credential remains process-only and is not
stored in `.env.local`.

## Database additions

- `202607240001_auth_context.sql`
- two local-only Auth/profile fixtures for missing and suspended memberships;
- one suspended local-only company membership fixture;
- `stage_2_auth_context.test.sql`
- regenerated `src/types/database.ts`

The original 20 business leads and all requested parity totals remain
unchanged.

## Security validation

Automated browser coverage verifies:

- valid and invalid real login;
- protected routes before login;
- retired demo-cookie forgery denial;
- forged/expired Supabase session-cookie denial;
- session persistence through refresh;
- safe internal next redirects;
- authenticated redirect away from login;
- real owner and representative membership resolution;
- no-membership and suspended-membership denial;
- logout, browser Back after logout, and protected access after logout;
- password-reset request UI and invalid callback handling;
- no browser console, hydration, or React runtime errors.

Database coverage verifies that anonymous callers cannot execute the
auth-context resolver and that owner, representative, missing, and suspended
contexts resolve from database authority.

## Final validation

| Command | Final result |
|---|---|
| `npx supabase test db` | PASS; 20/20 pgTAP assertions |
| `npm run lint` | PASS; exit code 0 |
| `npm run build` | PASS; Next.js production compilation and type checking |
| `npm run qa:e2e` | PASS; 24/24 browser checks |
| `npm audit` | PASS; 0 vulnerabilities |

Browser QA covers the complete Phase 1 workflow plus authentication pages at
1440px, 820px, and 390px. Existing business-route mobile checks remain at
390px, 430px, and 820px.

## Remaining limitations

- Business data remains browser-local and is not tenant-protected until Stage 3.
- Password-reset mail is delivered to local Mailpit during local development;
  hosted delivery requires later production configuration.
- Invitations and company switching are not implemented.
- Local Supabase credentials and test accounts are development-only.
