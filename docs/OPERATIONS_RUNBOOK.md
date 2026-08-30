# Pundi Operations Runbook v3

Pundi is an isolated finance product. Keep all operations scoped to the Pundi repository, the `creativevista/pundi` Vercel project, and Supabase ref `ndeycwoyjwyntjkgbzlz`.

## Canonical locations

- Repository: `https://github.com/Kamukura2/pundi`
- Workspace: `C:\JensenBot\Pundi`
- Production app: `https://app.pundi.online`
- Public site: `https://pundi.online`
- Legacy compatibility: `https://pundi-silk.vercel.app`
- Vercel project: `creativevista/pundi`
- Supabase project/ref: `Pundi` / `ndeycwoyjwyntjkgbzlz`

Never use the CVFinance repository, CVFinance Supabase project, or Jensen Research Hub for Pundi work.

## Acquisition v1

`Pundi Acquisition v1: COMPLETE` on release `8.7.0`. Run `npm run growth:status` for first-party aggregate CTA clicks and one-row signup attribution. The source allowlist is `google`, `reddit`, `facebook`, `linkedin`, `whatsapp`, `friend`, `community`, `organic`, `direct`, `other`; unknown values become `other`. Acquisition events contain only event type, source, landing path, CTA, and timestamp. Calculator values stay client-side. No automatic community posting is permitted. Synthetic `ref=other` smoke data must be removed and excluded from real-growth totals. Search Console sitemap submission remains owner-manual and non-blocking.

`npm run growth:status` and `npm run beta:status` use the same aggregate taxonomy: `total Auth users` is the admin API total, `operational/test identities excluded` counts the designated admin and normal-user smoke fixtures, `probable real users` is the remainder, and `attributable users` is the separate count from `user_acquisition`. “Beta users” is no longer used as an inferred population label. No emails, IDs, finance contents, passwords, tokens, or synthetic activity are emitted.

## Standard verification

From the workspace:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run test:password-recovery
npm run test:account-lifecycle
npm run test:admin-smoke
npm run test:isolation
npm run check
npm run build
git restore --source=HEAD -- dist
git clean -fd -- dist
git diff --check
```

The admin, normal-user, and isolation commands require local untracked files. `scripts/provision-user-smoke.mjs` safely reuses or creates only the designated `pundi-user-smoke@creativevista.dev` fixture, confirms it is not an admin, has no entitlement override, and has zero finance rows, then writes `.env.user-smoke.local`. Load ignored files in the process environment; do not add dotenv loading to the browser bundle. No owner credential switching is required.

## Local environment files

- `.env.admin-smoke.local`: designated admin smoke email/password only.
- `.env.user-smoke.local`: designated normal-user smoke email/password only; Git-ignored and never committed.
- `.env.pundi-test.local`: `PUNDI_TEST_PROJECT_REF`, `PUNDI_TEST_SUPABASE_URL`, `PUNDI_TEST_SUPABASE_ANON_KEY`, and `PUNDI_TEST_SUPABASE_SERVICE_ROLE_KEY` for disposable integration tests.
- `.env.supabase-pundi.local`: ignored Pundi-only `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD`, loaded by `scripts/pundi-supabase.ps1` only for its child process.
- `.env.local`: local development/Vercel tooling configuration.

All are covered by `.env*` in `.gitignore`. Never print contents, commit them, or copy server keys into source, `package.json`, logs, or client assets.

## Isolated Pundi Supabase automation

All future Pundi Supabase CLI operations must use the repository wrapper, not the default Supabase CLI login or a named profile:

```bash
npm run supabase:pundi -- projects list --output-format json
npm run supabase:pundi -- db push --dry-run --project-ref ndeycwoyjwyntjkgbzlz
npm run supabase:pundi -- -WriteOperation migration repair --status applied <exact-version> --project-ref ndeycwoyjwyntjkgbzlz
```

`scripts/pundi-supabase.ps1` reads the ignored `.env.supabase-pundi.local` file, verifies the exact `Pundi` / `ndeycwoyjwyntjkgbzlz` project before every invocation, rejects Nook and mismatched write targets, and restores the process environment after the child CLI exits. It never embeds or prints the token, changes global Windows environment variables, or changes Nook authentication. A write-capable operation must include the exact Pundi ref and the explicit `-WriteOperation` switch.

The Pundi database password is not passed on command lines. Routine account switching, named profiles, and default Supabase CLI login are not required. If the CLI direct pooler route is unavailable, use the authenticated exact-Pundi Management API SQL path; never replay legacy migrations to compensate for an incomplete CLI history.

## Admin smoke

The admin and normal-user smoke harnesses are read-only against production. They verify Pundi `/api/config`, real Auth login, `/api/admin`, aggregate metrics, pagination, privacy, normalization, onboarding, session persistence, Settings, Feedback, and logout. They must use only the designated non-customer smoke accounts. `scripts/provision-user-smoke.mjs` safely reuses or creates only the dedicated normal fixture, confirms it is not admin/paid and has zero finance rows, rotates only that fixture password, and updates `.env.user-smoke.local` without printing secrets. If admin credentials fail, rotate only the designated admin fixture with authorized Pundi server tooling and update `.env.admin-smoke.local`.

Do not create business rows, alter subscriptions, alter entitlements, or use the owner account for smoke authentication.

## Isolation harness

`npm run test:isolation` uses two disposable Auth users and a tagged dataset against the exact Pundi ref. It checks local cache/queue isolation, cross-user CRUD denial, owner-scoped child relationships, and Realtime filtering. Cleanup runs in `finally`; a successful run must report disposable rows and users removed.

Never substitute a different Supabase URL or infer a project from a stale environment file.

## Controlled Beta v1 release closeout

Controlled Beta Operations v1 is **COMPLETE** for Pundi `8.5.0`. Live catalog inspection proved 018 and 019 equivalent before their history entries were repaired without SQL replay. Migration 020 was then applied as the sole forward change and verified with forced RLS, ownership policies, and admin-path tests. Production feedback and admin smoke passed with disposable cleanup and zero finance mutations.

## Auth and account lifecycle

Recovery uses `/auth/reset-password`, performs callback processing before validation, keeps recovery routing isolated from dashboard bootstrap, signs out and verifies no active session after a successful password update, then returns to normal Sign In. Do not bypass this state machine with a normal `connect()` path.

Account deletion requires explicit confirmation and remains protected against client-supplied ownership and admin/owner deletion hazards. Never test destructive account operations against real customer accounts.

## Deployment

For runtime changes only:

1. inspect `git status`, branch, and HEAD;
2. run the full relevant gates;
3. stage only reviewed Pundi source/migration files;
4. commit and push `main` normally;
5. deploy the existing `creativevista/pundi` project;
6. wait for Vercel `READY`;
7. verify `/`, `/auth/reset-password`, `/sw.js`, and `/api/config` with safe HTTP checks.

Docs-only and local-secret changes do not require a production deployment. Never force-push or create a replacement project.

## Migration safety

Inspect the actual migration sequence and production identity before any database change. Prefer one additive forward migration. Never reset or replay legacy migrations, truncate production tables, or insert fake finance data. Verify RLS, owner policies, Realtime membership, and aggregate counts after an approved migration.

## Scheduler and health

Keep one existing Windows health scheduler if present; do not create duplicate tasks. The canonical `Pundi Admin Smoke Health` action runs the tracked PowerShell wrapper with `Start In: C:\JensenBot\Pundi`; the wrapper sets deterministic user paths, loads only ignored Pundi smoke env files, runs headless read-only smoke with bounded timeout/process-tree cleanup, and writes sanitized state atomically. Health checks should use sanitized logs, bounded retention, the dedicated smoke account, and read-only API assertions. The production smoke readiness path must use bounded `domcontentloaded` plus explicit Pundi auth/dashboard markers rather than generic Playwright `networkidle`; a direct runner PASS is separate from the scheduler gate, which requires a fresh `Ready` / `Last Result: 0`. A missing credential is an explicit blocked state, not a reason to skip silently.

## Productization v2

- Product version is `8.5.0`, sourced from `package.json`, lockfile, README heading, document title, and the service-worker shell cache key.
- Build identity is generated by Vite from the current Git short SHA and rendered as `Pundi v8.5.0 · build <sha>`; `PUNDI_BUILD_ID` may override it only in an explicitly controlled build.
- The onboarding card is rendered only after authenticated cloud state loads, only when all finance collections are empty, and is dismissed under `pundi-onboarding-dismissed:<userId>`. It creates no sample records and is safe across logout/account switching.
- Entitlements are resolved by `src/entitlements/resolver.js`: unknown/missing metadata defaults to Free, manual provenance is preserved, and explicit per-feature overrides take precedence. No payment provider or feature gating is active.
- Production security headers are configured in `vercel.json`. CSP permits only same-origin app resources, the verified Pundi Supabase HTTPS/WSS endpoints, and required inline styles used by the current UI. `frame-ancestors 'none'`, `nosniff`, strict-origin referrer policy, and restrictive Permissions-Policy are enabled.
- `/api/account` and `/api/admin` reject malformed JSON with a safe 400 response. Sensitive responses remain private/no-store.
- The service worker uses `pundi-shell-v8.5.0`, excludes `/api/*`, synchronously clones responses before asynchronous caching, and deletes old shell caches during activation.

## Regression commands

- `npm run test:productization-v2`: onboarding, headers, API parsing, cache identity, and release identity contract.
- `npm run test:entitlement`: canonical resolver semantics and override precedence.
- `npm run test:backup-security`: hostile backup schema, ownership, secret, duplicate-ID, numeric, and export privacy fixtures.
- `npm run test:sync-races`: user-scoped queue/cache, coalescing, subscription, logout, switch, and recovery lifecycle contract.
- `npm run test:api-contract`: actual API module enumeration and method/auth/error/privacy contract.
- `npm run test:responsive`: headless Playwright viewport and auth-mode checks.
- `npm run test:a11y`: headless axe serious/critical checks plus labels, names, IDs, status, and menu semantics.
- `npm run test:regression`: core non-browser regression including productization, backup, sync, API, empty states, double-submit, lifecycle, recovery, admin, and isolation contracts.
- `npm run test:admin-smoke`: read-only production health runner using the designated smoke account.
- `npm run test:health-v3`: read-only production HTTP/build/header/SW/backend health check.

After every runtime release, run `npm run check`, `npm run build`, restore generated `dist` if needed, and run `git diff --check`.

## Health and deployment markers

The expected production build identity is Pundi `8.5.0`; the build marker is the non-secret Git short SHA and the deployment commit is tracked separately by Git/Vercel. Verify the production alias, exact marker, and response headers headlessly after deployment. Do not claim authenticated UI behavior from a public HTTP check alone.

## Rollback rehearsal

Run 3 and Run 4 introduced no database migration. For a bad frontend deployment, identify the current and previous `READY` deployment in the existing `creativevista/pundi` Vercel project, promote the previous Pundi deployment using the Vercel dashboard or `vercel promote <deployment-url> --scope creativevista`, then verify `https://pundi-silk.vercel.app` and the production health runner. Do not use database rollback commands for these frontend-only releases and do not point the alias backward until deployment identity is confirmed.

## Auth email configuration

- Provider: Resend.
- Verified sender domain: `auth.pundi.online`.
- Sender: `Pundi <no-reply@auth.pundi.online>`.
- Confirmation subject: `Confirm your Pundi account`.
- Recovery subject: `Reset your Pundi password`.
- Confirmation and recovery templates: applied in the Pundi Supabase Auth project.
- Delivery and mailbox verification: PASS; confirmation and recovery messages were verified by the owner.
- Email-change template: not applicable to the current Pundi UI.

Maintain these settings only in the Pundi Supabase Auth project. Never place SMTP credentials in source, client configuration, logs, or documentation.

## Auth email rollback

If SMTP authentication fails, the sender domain loses verification, the provider is unavailable, or a template is malformed: inspect the provider/Supabase delivery error, restore the last known-good Auth template, and if necessary disable custom SMTP to return to the prior Supabase delivery behavior. Retain the Pundi recovery redirect and do not change the application recovery route. Re-enable custom SMTP only after credentials/provider status and a controlled test are verified.


- Application: redeploy the prior verified Pundi commit through `creativevista/pundi`.
- Database: use only an explicitly reviewed forward-compatible repair; never reset production.
- Auth email: restore the prior Supabase template while retaining the known-good Pundi recovery redirect.
- Local tests: preserve the untracked env files and rotate only the dedicated smoke credential if needed.

## Security boundary

Never expose passwords, JWTs, access/refresh tokens, service-role keys, SMTP credentials, reset URLs, private finance rows, customer emails, or admin metadata in chat, logs, fixtures, screenshots, or Git.
