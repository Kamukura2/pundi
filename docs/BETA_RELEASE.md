# Pundi Technical Beta Baseline

## Acquisition v1

Pundi Acquisition v1: COMPLETE. Use `npm run growth:status` for aggregate first-party CTA and signup attribution metrics. User-count semantics are explicit: both status commands report total Auth users, excluded operational/test identities, and the same probable-real-user remainder; `user_acquisition` attributable users remain separate. No finance data, calculator inputs, identities, tokens, or arbitrary referrers are measured. See `docs/ACQUISITION.md` for the operating boundary and manual distribution workflow.


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



## Growth Website v1 closeout

**Pundi Growth Website v1: COMPLETE**

- Indonesian-first homepage and seven focused SEO pages are live at `https://pundi.online`.
- Public sitemap: `https://pundi.online/sitemap.xml`.
- Search Console sitemap submission: **OWNER ACTION / NON-BLOCKING**.
- Authenticated app remains isolated at `https://app.pundi.online` and is excluded from indexing.
- Previous isolated admin contract can intermittently return `503` for the normal-user probe; this remains non-blocking while canonical production authorization and production smoke remain `401 / 403 / 200`.
- No runtime authorization fix was required for the 503. App cache routing was corrected to use the private `/app.html` entrypoint after the public homepage split.
- Release version: `8.7.0`.
- Acquisition v1: COMPLETE; production signup attribution verification PASS with disposable cleanup.
- Dedicated normal-user smoke identity is self-maintained locally through `scripts/provision-user-smoke.mjs`; `.env.user-smoke.local` is ignored and no owner credential switching is required.
- Search Console submission remains **OWNER ACTION / NON-BLOCKING**.

## Rollback pointer

Rollback is a Vercel deployment promotion/rollback operation only; do not run database rollback. Run 3 introduced no migration. Identify the current and previous READY Pundi deployments in Vercel before promotion and verify the alias plus public health checks afterward.

## Controlled Beta Operations v1 closeout

**COMPLETE — Pundi 8.5.0**

- Repository `main` is merged and pushed at the verified release commit.
- Existing Vercel project `creativevista/pundi` reached `Ready`; public and app aliases serve v8.5.0.
- Remote migration history is synchronized through 020. 018/019 were proven equivalent from live catalog inspection and repaired as bookkeeping only; 020 was applied normally.
- Feedback ownership/RLS, admin authorization, privacy, XSS-safe rendering, input limits, production triage, and zero finance mutation checks passed.
- No beta invitation infrastructure or payment capability was added.
