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

> Hi — I’m inviting you to try Pundi as one of the first beta users. It is still a beta product, so some parts may be confusing or imperfect.
>
> Open Pundi: https://app.pundi.online
>
> Create an account normally, then try the personal-finance workflows that are useful to you. If something is confusing or broken, use **Feedback** inside Pundi and tell us what you expected and what happened.
>
> Please do not send passwords, recovery links, access tokens, or sensitive screenshots/finance details. For now, do not use Pundi as the sole record for critical financial information; keep your normal backup or source of truth.

Do not ask beta users to upload sensitive screenshots or finance exports.

## Beta status command

Run `npm run beta:status` from the repository. It reads only the ignored designated smoke credentials in-process, authenticates to the exact Pundi project, queries the existing read-only admin endpoint, and writes aggregate-only state to `runtime/beta/latest.json`. Output contains no emails, IDs, finance rows, tokens, or passwords. The command does not create feedback rows or modify production data.

## Week-one operating procedure

- Invite no more than 3–5 people manually; do not mass-distribute the URL and do not send invitations automatically.
- Before each invitation, confirm the latest `npm run beta:status` is `READY`, and confirm Auth signup, confirmation email, login, logout, Feedback, backup/export, and account deletion using owner-controlled or non-destructive checks. Mailbox delivery and destructive deletion remain owner/manual evidence gates; do not create test finance data.
- Review `npm run beta:status` and the single `Pundi Admin Smoke Health` result daily. Do not create feedback rows from monitoring.
- Triage new feedback in `/admin` using the smallest safe metadata. Assign status and priority without attaching transactions, balances, holdings, budgets, backups, tokens, passwords, or screenshots.
- Reproduce meaningful reports with static/read-only checks or disposable identities. Do not auto-fix feedback or expand scope. Pause broader invitations immediately for an unresolved Critical issue.
- At week one, record actual sessions, feedback, Auth blockers, isolation/security results, scheduler health, and any evidence of data corruption. Do not manufacture activity or declare success from signups alone.

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

## Release closeout

**Controlled Beta Operations v1: COMPLETE**

- Pundi `8.5.0` is deployed on the existing `creativevista/pundi` project.
- Migration 018 and 019 effects were catalog-equivalent and their history entries were repaired without replaying SQL.
- Migration 020 was applied as the sole forward schema change; live `beta_feedback` schema/RLS/policy checks passed.
- Disposable A/B/admin feedback security tests, production submit/triage, authorization checks, and cleanup passed.
- Invite controlled-beta users only after reviewing the current production health result.
