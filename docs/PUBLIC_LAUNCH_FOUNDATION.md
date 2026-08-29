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

## DNS gate

At registration, Vercel reported the Rumahweb nameservers were still active and supplied these records:

```text
A | @   | 76.76.21.21
A | www | 76.76.21.21
A | app | 76.76.21.21
```

The owner must add only these three web records in Rumahweb DNS/cPanel, after checking that no conflicting `A`/`CNAME` records exist. Do not change nameservers unless separately approved. Do not alter any `auth` record, DKIM, SPF, sending CNAME, DMARC, MX, or other Resend record.

After propagation, verify with `nslookup` and `vercel domains inspect` before Auth URL migration.

## Routing

Vite builds separate public entries: `landing.html`, `privacy.html`, `terms.html`, and `support.html`. Host-aware Vercel rules rewrite apex public paths to those entries. The app remains `index.html`; `/auth/reset-password` rewrites to the app entrypoint. `www` redirects to `https://pundi.online`.

The old Vercel alias is not disabled. It remains the rollback/fallback surface until DNS, app-domain smoke, and Auth migration are verified.

## Auth migration gate

Only after `https://app.pundi.online` is HTTPS-ready:

1. Set Pundi Supabase Site URL to `https://app.pundi.online`.
2. Retain `https://pundi-silk.vercel.app` temporarily if active links require it.
3. Add `https://app.pundi.online/auth/reset-password` to the redirect allowlist.
4. Retain the old reset route temporarily during migration.
5. Trigger controlled confirmation and recovery tests; verify links without exposing tokens.
6. Keep sender `Pundi <no-reply@auth.pundi.online>` unchanged.

The hosted Auth configuration was not mutated by this source release. The local authenticated Management API previously returned `403 insufficient privileges`; this remains an external owner-access gate.

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

Local source, build, responsive, accessibility, routing, metadata, and PWA contracts are verified. Vercel domain bindings are registered but DNS is not yet verified. Supabase hosted Auth URL migration and live custom-domain email-link verification remain pending until the external DNS/API gate is cleared.
