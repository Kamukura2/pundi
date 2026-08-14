# Patch v8.0.1 — Dividend Accuracy, Single Source & Reversible Credit

## What this patch fixes

- Collapses duplicate corporate actions reported under different date types by multiple providers.
- Gives issuer/official records priority, followed by Twelve Data, then the fallback provider.
- Removes uncredited provider archive noise from years before the current year.
- Labels eligible shares as the shares owned on the dividend record date.
- Adds a dedicated Dividend Credit History for amounts actually credited to the Investment wallet.
- `Cancel credit & delete` reverses the exact native-currency wallet credit before removing the record.
- Existing duplicate credits are reconciled from the Investment wallet once during upgrade.

## Required database action

Run `supabase/migrations/014_dividend_credit_reversal.sql` once in Supabase SQL Editor before deploying this patch.

The migration is additive and stores the exact credited amount/currency plus reversal timestamp.
