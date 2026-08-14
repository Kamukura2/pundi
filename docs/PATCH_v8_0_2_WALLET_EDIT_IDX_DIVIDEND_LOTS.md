# Patch v8.0.2 — Editable Investment/Trading Wallets & IDX Lot-Based Dividend Eligibility

## Wallet editing

- Investment Netcash IDR and USD Wallet each have an `Edit` button for setting the exact balance.
- Trading Netcash IDR and USD Wallet each have an `Edit` button for setting the exact balance.
- A Trading balance edit creates only the required deposit/withdraw adjustment in Trading Ledger, so it changes Starting Funds and never becomes profit or loss.

## Dividend eligibility units

- IDX dividend confirmation and manual entry use lots.
- One IDX lot is converted internally to 100 eligible shares for dividend calculation.
- IDX lots are stored as whole numbers.
- US holdings continue to use shares and support fractional quantities.

No new Supabase migration is required beyond v8.0.1 migration `014_dividend_credit_reversal.sql`.
