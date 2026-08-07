# CVFinance v7.1.0 — private Telegram input

This release continues the existing deployed CVFinance project. It does not rebuild the UI or create another database.

## Added

- Dedicated webhook route: `/api/telegram/cvfinance-webhook`
- Strict Telegram user + private chat allowlisting
- Telegram webhook secret header validation
- Server-only Supabase secret/service-role client scoped to `CVFINANCE_OWNER_USER_ID`
- Persistent 20-minute multi-step state in Supabase
- Telegram update idempotency and source markers
- Deterministic Indonesian amount, category, channel, and Jakarta date parsing
- Quick income/expense entry and `/start`, `/help`, `/balance`, `/client`, `/credit`, `/electricity`, `/stocks`, `/target`, and `/summary`
- Structured redacted Vercel logs

## Required migration

Run `supabase/migrations/005_telegram_cvfinance.sql` once before the production webhook is registered. It adds bot metadata/state tables and nullable idempotency fields. It does not remove or reset existing records.

## Deployment

Follow `docs/TELEGRAM_SETUP.md`. The runtime has no long-polling process and continues working with the user's PC turned off.
