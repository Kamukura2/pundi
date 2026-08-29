# Pundi Technical Beta Baseline

- Product version: `8.3.5`
- Current production URL: `https://pundi-silk.vercel.app`
- Current runtime build: verified by `npm run test:health-v4` against the production alias
- Supabase project ref: `ndeycwoyjwyntjkgbzlz`
- Repository: `https://github.com/Kamukura2/pundi`

## Gates

Core contracts cover backup/import security, sync/realtime race behavior, API contracts, entitlements, empty states, double-submit protection, and build identity. Browser contracts cover responsive viewports and serious/critical accessibility violations. Production contracts cover public health, admin smoke, dedicated normal-user smoke, and role authorization.

## Security and lifecycle

Ownership/RLS and Realtime isolation are preserved. Auth recovery and account lifecycle are preserved. Backup exports use new Pundi filenames while schema-based import compatibility remains for legacy files. No billing provider is configured; manual entitlement metadata is not provider-verified payment.

## Known blocker

Branded Auth Email + Custom SMTP: COMPLETE. Resend custom SMTP, Pundi sender identity, confirmation/recovery templates, and controlled confirmation/recovery mailbox verification passed.

## Rollback pointer

Rollback is a Vercel deployment promotion/rollback operation only; do not run database rollback. Run 3 introduced no migration. Identify the current and previous READY Pundi deployments in Vercel before promotion and verify the alias plus public health checks afterward.
