# Pundi Auth Email Templates v1

Status: **PREPARED**. Applying templates and enabling a branded sender require Supabase Auth configuration access and custom SMTP/domain verification.

These templates are Pundi-only and use the same-origin production URL. They do not claim payment, legal, or delivery guarantees.

## Confirmation email

**Subject:** Confirm your Pundi account

```text
Welcome to Pundi.

Confirm your email address to activate your private Pundi account:
{{ .ConfirmationURL }}

If you did not create this account, you can ignore this email.

Pundi
Private cloud finance workspace
https://pundi-silk.vercel.app/
```

## Password recovery email

**Subject:** Reset your Pundi password

```text
We received a request to reset your Pundi password.

Choose a new password here:
{{ .ConfirmationURL }}

If you did not request this, you can ignore this email. The link will expire according to your Pundi Auth configuration.

Pundi
Private cloud finance workspace
https://pundi-silk.vercel.app/
```

## Email-change / reauthentication email

**Subject:** Confirm your Pundi email change

```text
Confirm the requested email change for your Pundi account:
{{ .ConfirmationURL }}

If you did not request this change, secure your account by signing in to Pundi and reviewing Account settings.

Pundi
Private cloud finance workspace
https://pundi-silk.vercel.app/
```

## SMTP readiness checklist

- [ ] Choose an approved sender domain.
- [ ] Verify the sender domain with the SMTP provider.
- [ ] Configure provider host, port, username, and password in Supabase Auth SMTP settings.
- [ ] Set the verified sender name to `Pundi` and sender address on the verified domain.
- [ ] Confirm the Site URL is `https://pundi-silk.vercel.app`.
- [ ] Keep the recovery redirect allowlist entry at `https://pundi-silk.vercel.app/auth/reset-password`.
- [ ] Send one controlled confirmation and recovery test using a designated non-customer account.
- [ ] Confirm the template links land on the Pundi origin and do not contain CVFinance branding.
- [ ] Record the provider configuration privately; never commit SMTP credentials.

## Current truth

- Current delivery: Supabase default SMTP/sender/template.
- Branded templates: prepared in this document; not applied automatically.
- Custom SMTP: not configured.
- External blocker: Supabase Auth template/provider settings and sender-domain verification access.

## Rollback

If a branded template causes delivery or link problems, restore the prior Supabase template and retain the Pundi recovery redirect. Do not change application recovery code or redirect routes as a template rollback.
