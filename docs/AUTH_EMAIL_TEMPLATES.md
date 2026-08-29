# Pundi Auth Email Templates v1

Status: **PREPARED**. Applying templates and enabling a branded sender require Supabase Auth configuration access and custom SMTP/domain verification.

These templates are Pundi-only and use the same-origin production URL. They do not claim payment, legal, or delivery guarantees.

## Confirmation email

**Subject:** Confirm your Pundi account

```html
<h2>Welcome to Pundi</h2>

<p>Thanks for creating your Pundi account.</p>

<p>Please confirm your email address to finish setting up your account.</p>

<p><a href="{{ .ConfirmationURL }}">Confirm my email</a></p>

<p>If you did not create a Pundi account, you can safely ignore this email.</p>

<p>— Pundi</p>
```

## Password recovery email

**Subject:** Reset your Pundi password

```html
<h2>Reset your Pundi password</h2>

<p>We received a request to reset the password for your Pundi account.</p>

<p><a href="{{ .ConfirmationURL }}">Reset my password</a></p>

<p>If you did not request a password reset, you can safely ignore this email.</p>

<p>This link should only be used by you and should not be shared.</p>

<p>— Pundi</p>
```

## Email-change / reauthentication email

**Status:** NOT APPLICABLE to the current Pundi v8.3.5 UI. Account Settings exposes password change and account lifecycle controls, but no email-change action was found in the current application flow. Do not apply or verify an email-change template until that flow is intentionally added.

If a future Pundi release adds email changing, validate this template against the then-current flow before applying it. The variable `{{ .ConfirmationURL }}` is supported by Supabase Auth templates.

## SMTP readiness checklist

- [x] Choose an approved sender domain: `auth.pundi.online`.
- [x] Verify the sender domain with the SMTP provider.
- [x] Configure Resend custom SMTP in Supabase Auth SMTP settings.
- [x] Set the verified sender name to `Pundi` and sender address to `no-reply@auth.pundi.online`.
- [ ] Confirm the Site URL is `https://pundi-silk.vercel.app`.
- [ ] Keep the recovery redirect allowlist entry at `https://pundi-silk.vercel.app/auth/reset-password`.
- [ ] Send one controlled confirmation and recovery test using a designated non-customer account.
- [ ] Confirm the template links land on the Pundi origin and do not contain CVFinance branding.
- [ ] Record the provider configuration privately; never commit SMTP credentials.

## Current truth

- Current delivery: Resend custom SMTP is enabled in Pundi Supabase Auth.
- Provider: Resend.
- Verified sender domain: `auth.pundi.online`.
- Sender: `Pundi <no-reply@auth.pundi.online>`.
- Branded templates: prepared in this document; confirmation and recovery application remains pending.
- Mailbox verification: pending.
- External blocker: apply the two templates and complete controlled mailbox verification.

## Rollback

If a branded template causes delivery or link problems, restore the prior Supabase template and retain the Pundi recovery redirect. Do not change application recovery code or redirect routes as a template rollback.
