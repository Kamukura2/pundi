# Pundi Public Launch Foundation v1

## Scope

Pundi v8.4.0 adds a public product entry point while preserving the existing authenticated application and Pundi Supabase project. No payment provider, analytics SDK, customer data, or finance records were added.

## Domain architecture

| Host | Role | Vercel target |
| --- | --- | --- |
| `pundi.online` | Public landing, legal, support | Existing `creativevista/pundi` |
| `www.pundi.online` | Permanent redirect to apex | Existing `creativevista/pundi` |
| `app.pundi.online` | Authenticated Pundi application | Existing `creativevista/pundi` |
| `auth.pundi.online` | Resend/Supabase sender only | **Unchanged** |
| `pundi-silk.vercel.app` | Temporary compatibility hostname | Retained |

## DNS gate — COMPLETE

Public DNS and Vercel domain verification are complete and were checked independently:

```text
pundi.online       A      216.198.79.1
pundi.online       A      64.29.17.1
www.pundi.online   CNAME  29cb29df359cdd66.vercel-dns-017.com.
app.pundi.online   CNAME  29cb29df359cdd66.vercel-dns-017.com.
```

`auth.pundi.online` remains reserved for the Resend/Supabase transactional sender. Its Resend sending records were preserved and were not changed. No Rumahweb DNS, nameserver, Resend DNS, or runtime DNS mutation is part of this closeout.

## Routing

Vite builds separate public entries: `landing.html`, `privacy.html`, `terms.html`, and `support.html`. Host-aware Vercel rules rewrite apex public paths to those entries. The app remains `index.html`; `/auth/reset-password` rewrites to the app entrypoint. `www` redirects to `https://pundi.online`.

The old Vercel alias is not disabled. It remains the rollback/fallback surface until DNS, app-domain smoke, and Auth migration are verified.

## Auth migration gate — COMPLETE

The owner configured Pundi Supabase Auth after the app host became HTTPS-ready:

1. Site URL: `https://app.pundi.online`.
2. Recovery redirect: `https://app.pundi.online/auth/reset-password`.
3. Legacy compatibility retained: `https://pundi-silk.vercel.app` and its recovery route.
4. Sender retained: `Pundi <no-reply@auth.pundi.online>`.
5. One fresh confirmation and one fresh recovery request were accepted by Auth.
6. The owner visually verified sender, subject, Pundi branding, and app-domain destinations for both messages.

No further Auth, SMTP, DNS, or runtime changes are required for this cutover.

## Privacy/legal/support

- `/privacy` describes account email, user-entered finance data, Supabase Auth, Resend transactional email, hosting, export/backup, and account deletion without unsupported compliance/security guarantees.
- `/terms` states as-is availability, user responsibility for accuracy/account access, non-advice boundaries, acceptable use, and deletion/termination.
- `/support` directs beta users to the in-app feedback path and clearly marks `SUPPORT_EMAIL_OWNER_DECISION`; no nonexistent mailbox is advertised.

These are baseline product documents and are not jurisdiction-specific legal advice. Owner/operator legal identity should be formalized before commercial terms or paid launch.

## Beta feedback

The authenticated app has a visible, unobtrusive `Feedback` control that opens the public support path. It collects no telemetry, screenshot, finance data, secret, or session information and introduces no backend collection.

## SEO/PWA/security

- Public landing has canonical metadata for `https://pundi.online`, description, Open Graph tags, robots, and sitemap.
- App entry is `noindex`; robots disallow app/admin/auth/api paths.
- The service-worker shell cache is `pundi-shell-v8.4.0`; manifest start URL/scope target `https://app.pundi.online/`.
- CSP remains narrow to Pundi origin, the verified Supabase project, and the declared Google Fonts assets used by the public page. `auth.pundi.online` is not used as the application origin.

## Rollback

1. Keep `pundi-silk.vercel.app` enabled.
2. If domain routing fails, remove/revert only the public host rewrites and leave the old alias available.
3. If Auth cutover fails, restore Pundi Site URL to the prior verified alias and retain the reset redirect allowlist temporarily.
4. Do not roll back the database; this foundation adds no migration.
5. Remove custom web-domain bindings only after confirming the old alias remains healthy.

## Verification state

**Public Launch Foundation v1: COMPLETE**

Verified evidence includes public DNS, Vercel domain bindings, Ready production deployment, HTTPS/TLS, apex/www/app routing, public legal/support routes, authenticated app-domain smoke, role authorization, PWA assets, security headers, Pundi Supabase HTTPS/WSS connectivity, and final production/check/build gates. The owner also verified fresh confirmation and recovery email sender, subject, branding, and app-domain destinations. A temporary local resolver fallback was not used; normal Windows/Node/Playwright resolution recovered before final smoke.
