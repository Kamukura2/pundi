# Pundi Technical Beta Baseline

- Product version: `8.3.5`
- Current production URL: `https://pundi-silk.vercel.app`
- Current runtime build: `bf8de0a`
- Supabase project ref: `ndeycwoyjwyntjkgbzlz`
- Repository: `https://github.com/Kamukura2/pundi`

## Gates

Core contracts cover backup/import security, sync/realtime race behavior, API contracts, entitlements, empty states, double-submit protection, and build identity. Browser contracts cover responsive viewports and serious/critical accessibility violations. Production contracts cover public health, admin smoke, dedicated normal-user smoke, and role authorization.

## Security and lifecycle

Ownership/RLS and Realtime isolation are preserved. Auth recovery and account lifecycle are preserved. Backup exports use new Pundi filenames while schema-based import compatibility remains for legacy files. No billing provider is configured; manual entitlement metadata is not provider-verified payment.

## Known blocker

Branded Auth email remains `BLOCKED_EXTERNAL`: approve an SMTP provider, verify the Pundi sender domain, configure Supabase Auth SMTP, apply `docs/AUTH_EMAIL_TEMPLATES.md`, and perform mailbox verification.

## Rollback pointer

Rollback is a Vercel deployment promotion/rollback operation only; do not run database rollback. Run 3 introduced no migration. Identify the current and previous READY Pundi deployments in Vercel before promotion and verify the alias plus public health checks afterward.
