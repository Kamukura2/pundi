# Pundi Controlled Beta v1

## Scope
Pundi 8.5.0 is a controlled beta, not a payment or monetization release. Signup remains available; the operator distributes `https://app.pundi.online` selectively. No invite-code or waitlist system is used.

## Before inviting a beta user

- Confirm `https://pundi.online` and `https://app.pundi.online` are healthy.
- Confirm the current production build/version and the existing six-hour admin smoke task.
- Confirm branded Auth email remains `Pundi <no-reply@auth.pundi.online>`.
- Run the current read-only production smoke and review known issues.
- Confirm the Feedback and Admin Beta Feedback sections are available.

## Invitation message

> Pundi is currently in beta. Use non-critical personal data initially. Send unclear or broken behavior through **Feedback** in the app. Never share your password, recovery link, access token, or sensitive finance data.
>
> Open Pundi: https://app.pundi.online

Do not ask beta users to upload sensitive screenshots or finance exports.

## Feedback workflow

1. User opens **Feedback** in the authenticated app.
2. Selects a category and describes what they expected and what happened.
3. Pundi sends only the allowlisted message and safe context: version, build, route, and short browser summary.
4. Operator reviews the item in `/admin` → **Beta Feedback**.
5. Operator assigns status (`New`, `Reviewing`, `Planned`, `Resolved`, or `Closed`), priority (`Low`, `Normal`, `High`, or `Critical`), and an optional short note.

Feedback text is rendered as text, not HTML. Finance rows, tokens, passwords, screenshots, and automatic logs are not attached.

## Serious defect procedure

If a report suggests cross-user exposure, auth bypass, account deletion failure, corrupted financial records, or another confidentiality/integrity issue:

1. Mark the feedback **Critical**.
2. Pause broader invitations.
3. Preserve only the minimum safe metadata needed for investigation.
4. Reproduce with disposable identities or read-only/static tests; never use real finance data.
5. Do not modify DNS, Auth URLs, SMTP, or unrelated CVFinance/Jensen systems.
6. Resume invitations only after a verified fix, fresh production smoke, and owner review.

## Health monitoring

Keep the single existing Windows task **Pundi Admin Smoke Health**. It runs the existing read-only production health chain and writes sanitized local runtime state. Do not create feedback rows from the scheduler. Verify task status with the existing status helper and investigate non-zero results before inviting more users.

## Operator privacy rules

Admin triage may show masked/safe identity reference, category, message, version/build, route, status, and priority. It must not expose balances, transactions, holdings, clients, backups, session values, passwords, or tokens.

## Rollback boundary

This run does not alter completed DNS, Vercel domain bindings, Auth URLs, SMTP, or payment systems. If beta runtime changes need rollback, use the normal Git/Vercel release procedure and preserve the existing legacy compatibility alias.
