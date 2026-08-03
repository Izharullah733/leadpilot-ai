# Phase 2A Stage 6 — AI lead intelligence and assisted scoring

Stage 6 adds optional, company-controlled AI recommendations to the existing
lead detail workflow. It does not replace the deterministic Phase 1 score,
change pipeline stages or assignments automatically, send messages, or add any
external integration.

## Provider architecture

All provider calls originate in a Server Action through a small provider
boundary in `src/lib/ai/provider.ts`. `AI_PROVIDER=openai` uses the official
OpenAI SDK and Responses API with strict Structured Outputs. The selected model
is centralized in `src/lib/openai/client.ts` and can be overridden by the
server-only `OPENAI_MODEL` environment variable. The current default is
`gpt-5.6-terra`, chosen as the balanced model for this advisory workflow.

`AI_PROVIDER=mock` selects a deterministic provider with the exact same output
schema. Production builds reject mock use unless the explicit
`AI_ALLOW_MOCK_IN_PRODUCTION_TESTS=true` QA guard is present. A missing provider
never falls back silently. No live OpenAI request was made during Stage 6
implementation or validation.

The real request uses:

- the Responses API;
- a strict JSON Schema with additional server-side parsing and bounds checks;
- `store: false` and no background execution;
- a configurable timeout/abort signal;
- a hashed member identifier as the safety identifier;
- a correlation ID and safe non-PII metadata;
- no hidden reasoning or chain-of-thought storage.

## Data minimization and privacy

AI is disabled in seeded company settings. Before enabling it, an owner or
admin must acknowledge that only the following fields are sent to the selected
provider:

- neutral lead reference;
- service required;
- location and property size;
- numeric budget;
- expected timeline and source;
- current stage and temperature;
- existing deterministic score;
- salesperson notes.

Lead name, email address, phone number, internal user identity, company contact
details, and unrelated tenant data are excluded. The prompt instructs the
provider to use supplied evidence only, identify missing information, avoid
fabricated certainty, and return a professional Pakistan-market reply draft.
The suggested reply is never sent automatically and is always labelled for
human review.

## Persistence and auditing

Migration `202608020001_ai_lead_intelligence_stage6.sql` adds:

- `company_settings.ai_settings`, validated by a fail-closed database function;
- append/versioned `lead_ai_insights` rows with company, lead, requester,
  provider, model, prompt version, fingerprint, structured output, state,
  timestamps, and safe failure metadata;
- append-only `ai_usage_events` containing status, token totals, latency and a
  safe error code, but no prompts, lead text, credentials, or provider payload;
- controlled generation, completion, failure, explicit-apply, settings and
  usage-summary RPCs;
- activity types for generation, regeneration, score application and
  temperature application.

A stable SHA-256 fingerprint is calculated from the minimized input. Unchanged
input reuses the current successful insight. Forced regeneration creates a new
version. If a relevant lead field changes, the previous result is marked stale
in the UI and cannot be applied until regenerated.

Generation writes a short-lived database lock before calling the provider. A
partial unique index permits only one active generation per lead; stale locks
are expired safely. Company daily/monthly limits, per-user hourly limits,
cooldown and maximum concurrency are enforced by the database before the
provider call. Failed attempts are retained for audit and quota accounting.

## Authorization and RLS

Business identity always comes from the authenticated Supabase user and active
`company_members` row. Client-supplied roles are not trusted.

- Owner and Admin can change AI company settings and generate/apply where they
  can access the lead.
- Sales Manager can generate/apply company-wide when included in the allowed
  role list, but cannot change AI settings or view the owner/admin usage view.
- Sales Representative can generate/apply only for their assigned leads and
  only when included in the company allowed-role list.

Insight SELECT policy delegates to the existing lead-access predicate, so
representatives cannot discover other representatives' AI results. Authenticated
clients have no direct INSERT/UPDATE privileges on insight or usage tables.
Controlled Security Definer RPCs re-resolve membership, company and lead scope
for every write. Usage summaries are owner/admin only. Service-role credentials
are not used by application UI or provider code.

## Human approval contract

AI output is advisory. The official rule-based score remains visibly separate
from the AI recommendation. Generation never updates score, temperature,
stage, assignment, follow-up, appointment, or message state. Applying a score
or temperature requires a dedicated confirmation dialog and changes only that
single field. The database records old/new values in lead activity history.

## Configuration

Server-only variables:

```env
AI_PROVIDER=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-terra
AI_REQUEST_TIMEOUT_MS=30000
AI_ALLOW_MOCK_IN_PRODUCTION_TESTS=
```

Never prefix the provider key with `NEXT_PUBLIC_`. The last variable is only a
test guard for a production-mode local/CI server and must not be enabled in a
customer deployment. Company quota values and role choices live in validated
database settings, not environment variables.

## Local deterministic QA

With local Supabase healthy and local Auth users provisioned:

```powershell
$env:AI_PROVIDER="mock"
$env:AI_ALLOW_MOCK_IN_PRODUCTION_TESTS="true"
npm run build
npm run start
npm run qa:e2e
```

To verify the browser's missing-provider state, run a server with
`AI_PROVIDER` and `OPENAI_API_KEY` unset after the company has been enabled by
the main suite, then run:

```powershell
npm run qa:ai-unconfigured
```

## Validation executed

The final values below must be updated only from completed commands:

- Database reset: passed; final cleanup reset reapplied all migrations and seed
- Database pgTAP: 244/244 assertions passed
- ESLint: passed
- Production build: passed with Next.js 15.5.21
- Browser QA: 36/36 checks passed at 1440px, 820px, 430px and 390px
- Missing-provider browser QA: passed
- `npm audit`: passed with 0 vulnerabilities
- Live OpenAI calls: none

After QA, a final reset and local Auth reprovision restored the deterministic
state: Prime Build & Properties has 20 leads, 4 converted leads, PKR
660,000,000 active pipeline, 20 normalized follow-up rows, 5 appointment rows,
AI disabled, and no persisted AI insights or usage events. The seed's existing
validation also retains 5 follow-ups due on the reference date and 3 upcoming
site visits.

Browser coverage includes disabled-by-default behavior, owner opt-in and
acknowledgment, deterministic generation, persistence, reply copy, explicit
apply confirmation, stale detection, regeneration/versioning, safe provider
failure, representative scoping, manager read-only settings, server-side quota
failure, responsive layouts, and console/hydration monitoring. Database tests
add cross-tenant denial, direct-write denial, lock/reuse behavior, failure
non-mutation, usage visibility, and both score and temperature audit records.

## Remaining operational boundaries

- No production OpenAI key or live response has been validated; provider
  account configuration, model access, billing and real-world latency remain a
  deployment check.
- Generation is synchronous within a Server Action. Database locking makes
  retries safe, but a durable background job/worker is intentionally deferred.
- Cost estimates are represented by token usage and quotas; no billing UI or
  external telemetry integration was added.
- Suggested replies are copy-only. WhatsApp, email, Facebook, SMS, payments and
  notification delivery integrations remain outside this stage.
