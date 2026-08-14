# CVFinance v7.8.0 — Investment + Trading + SPY

> Provider setup in this historical patch is superseded by v7.8.1. Current builds use Twelve Data first and Finnhub as fallback; see `PATCH_v7_8_1_TWELVE_DATA_TRADING.md`.

## What changed

- The existing `Stocks` navigation label is now `Investment`. Its data model and behavior are unchanged.
- A separate optional `Trading` page tracks active positions without mixing their cost basis or transactions into Investment.
- Trading supports opening positions, funding, buying more, selling partially or fully, and withdrawing IDR/USD cash.
- Sell proceeds move into the Trading wallet automatically.
- Deposits and withdrawals are stored as external flows, so they do not become profit or loss.
- Total Trading equity includes open positions plus the isolated IDR and USD Trading wallets.
- Realized P/L is captured on every sell. Unrealized P/L uses the remaining position cost basis.
- Daily snapshots power 1W, 1M, 3M, YTD, and ALL portfolio returns versus SPY.
- Prospect shows `Investment Stocks` and `Trading Stocks` as separate lines, including explicit zero values.
- Insights adds Trading P/L, alpha versus SPY, and realized sell win rate.

## Required database action

Run `supabase/migrations/012_trading_portfolio.sql` once in Supabase SQL Editor before deploying this version. The migration is additive and creates:

- `trading_positions`
- `trading_ledger`
- `trading_snapshots`

All three tables use per-user RLS and Supabase Realtime. No Investment, History, client, budget, or projection row is modified by the migration.

## Free US quote setup

Create a free Alpaca account and add these server-side Vercel variables:

```text
ALPACA_API_KEY_ID=...
ALPACA_API_SECRET_KEY=...
```

Never prefix either key with `VITE_` or expose it in frontend code. Alpaca Free provides live IEX trades, including qualifying extended-hours prints, but it is not the consolidated SIP feed from every US exchange. When Alpaca is not configured, Trading falls back to the existing Finnhub server key.

## Trading performance logic

`Trading equity = open positions + IDR wallet + USD wallet × USD/IDR`

`Total Trading P/L = Trading equity − net external contributions`

Deposits increase net contributions. Withdrawals reduce net contributions. Buys and sells move value between positions and the Trading wallet, so neither creates an artificial cash-flow gain or loss. Sell executions separately record realized P/L against the weighted average cost basis.

The benchmark chart uses flow-neutral daily snapshots. SPY daily reference prices are used for the same snapshot dates. A new portfolio naturally starts with limited chart history and becomes denser as daily snapshots accumulate.
