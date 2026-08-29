# Pundi Technical Beta Baseline

- Product version: `8.5.0`
- Current production URL: `https://app.pundi.online`
- Public site URL: `https://pundi.online`
- Legacy compatibility URL: `https://pundi-silk.vercel.app`
- Current runtime build: verified by `npm run test:health-v4` against the production alias
- Supabase project ref: `ndeycwoyjwyntjkgbzlz`
- Repository: `https://github.com/Kamukura2/pundi`

## Gates

Core contracts cover backup/import security, sync/realtime race behavior, API contracts, entitlements, empty states, double-submit protection, and build identity. Browser contracts cover responsive viewports and serious/critical accessibility violations. Production contracts cover public health, admin smoke, dedicated normal-user smoke, and role authorization.

## Security and lifecycle

Ownership/RLS and Realtime isolation are preserved. Auth recovery and account lifecycle are preserved. Backup exports use new Pundi filenames while schema-based import compatibility remains for legacy files. No billing provider is configured; manual entitlement metadata is not provider-verified payment.

## Public launch closeout

**Public Launch Foundation v1: COMPLETE**

- Public: `https://pundi.online`
- App: `https://app.pundi.online`
- Auth email: `auth.pundi.online`
- Confirmation app-domain flow: PASS — owner visually verified sender, subject, branding, and app-domain link.
- Recovery app-domain flow: PASS — owner visually verified sender, subject, branding, and `app.pundi.online/auth/reset-password` destination.
- Technical Beta: COMPLETE
- Branded Auth Email: COMPLETE
- Temporary local resolver fallback: not used; normal resolution recovered.
- Disposable confirmation/recovery identities: deleted and cleanup verified.

No version bump or runtime change is required for this docs-only closeout. Do not modify Rumahweb DNS, Resend DNS, Vercel domain bindings, Supabase Auth URLs, SMTP, CVFinance, or Jensen Research Hub.



## Rollback pointer

Rollback is a Vercel deployment promotion/rollback operation only; do not run database rollback. Run 3 introduced no migration. Identify the current and previous READY Pundi deployments in Vercel before promotion and verify the alias plus public health checks afterward.
