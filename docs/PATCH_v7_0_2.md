# CVFinance v7.0.2 — IDX delayed prices

This patch replaces the paid Twelve Data IDX integration with delayed Yahoo Finance quotes for personal, low-volume use.

## Behavior

- IDX symbols are normalized server-side: `BMRI` becomes `BMRI.JK`.
- IDX quantity remains displayed in lots and stored in shares (`100 lots = 10,000 shares`).
- US prices continue to use Finnhub.
- IDX responses are always labelled `delayed`; no real-time entitlement is claimed.
- Quotes are cached for five minutes. The last successful/manual price remains in Supabase if a later refresh fails.
- Two Yahoo chart hosts are tried before an explicit provider error is returned. Synthetic prices are never used.

## Required deployment step

Run `supabase/migrations/004_yahoo_idx_provider.sql` once in the Supabase SQL Editor before deploying this code. It expands the provider constraint and converts existing IDX holdings from Twelve Data to Yahoo without deleting holdings or price data.

After the Vercel deployment is Ready, `TWELVE_DATA_API_KEY` may be deleted from Vercel because v7.0.2 no longer routes IDX quotes to Twelve Data.

Yahoo Finance data is unofficial and may be delayed, throttled, or temporarily unavailable. This integration is intended only for a personal portfolio tracker, not exchange-grade, redistribution, or commercial use.
