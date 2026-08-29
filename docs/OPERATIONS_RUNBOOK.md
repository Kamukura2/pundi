# Pundi Operations Runbook v1

Pundi is an isolated finance product. Keep all operations scoped to the Pundi repository, the `creativevista/pundi` Vercel project, and Supabase ref `ndeycwoyjwyntjkgbzlz`.

## Canonical locations

- Repository: `https://github.com/Kamukura2/pundi`
- Workspace: `C:\JensenBot\Pundi`
- Production: `https://pundi-silk.vercel.app`
- Vercel project: `creativevista/pundi`
- Supabase project/ref: `Pundi` / `ndeycwoyjwyntjkgbzlz`

Never use the CVFinance repository, CVFinance Supabase project, or Jensen Research Hub for Pundi work.

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

The admin smoke and isolation commands require local untracked files. Load them in the process environment; do not add dotenv loading to the browser bundle.

## Local environment files

- `.env.admin-smoke.local`: designated smoke email/password only.
- `.env.pundi-test.local`: `PUNDI_TEST_PROJECT_REF`, `PUNDI_TEST_SUPABASE_URL`, `PUNDI_TEST_SUPABASE_ANON_KEY`, and `PUNDI_TEST_SUPABASE_SERVICE_ROLE_KEY` for disposable integration tests.
- `.env.local`: local development/Vercel tooling configuration.

All are covered by `.env*` in `.gitignore`. Never print contents, commit them, or copy server keys into source, `package.json`, logs, or client assets.

## Admin smoke

The smoke harness is read-only against production. It verifies Pundi `/api/config`, real Auth login, `/api/admin`, aggregate metrics, pagination, privacy, and normalization. It must use only the designated non-customer smoke account. If credentials fail, rotate only that account password with authorized Pundi server tooling and update `.env.admin-smoke.local` without printing the password.

Do not create business rows, alter subscriptions, alter entitlements, or use the owner account for smoke authentication.

## Isolation harness

`npm run test:isolation` uses two disposable Auth users and a tagged dataset against the exact Pundi ref. It checks local cache/queue isolation, cross-user CRUD denial, owner-scoped child relationships, and Realtime filtering. Cleanup runs in `finally`; a successful run must report disposable rows and users removed.

Never substitute a different Supabase URL or infer a project from a stale environment file.

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

Keep one existing Windows health scheduler if present; do not create duplicate tasks. Health checks should use sanitized logs, bounded retention, the dedicated smoke account, and read-only API assertions. A missing credential is an explicit blocked state, not a reason to skip silently.

## Rollback outline

- Application: redeploy the prior verified Pundi commit through `creativevista/pundi`.
- Database: use only an explicitly reviewed forward-compatible repair; never reset production.
- Auth email: restore the prior Supabase template while retaining the known-good Pundi recovery redirect.
- Local tests: preserve the untracked env files and rotate only the dedicated smoke credential if needed.

## Security boundary

Never expose passwords, JWTs, access/refresh tokens, service-role keys, SMTP credentials, reset URLs, private finance rows, customer emails, or admin metadata in chat, logs, fixtures, screenshots, or Git.
