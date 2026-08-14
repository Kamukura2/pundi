# CVFinance v7.8.1 — Twelve Data Trading quotes

## What changed

- Trading now requests Twelve Data first using the server-only `TWELVE_DATA_API_KEY`.
- Finnhub remains an automatic fallback and Investment quote behavior is unchanged.
- If Twelve Data returns only a previous close during an active US session, CVFinance checks Finnhub before accepting that stale value.
- Quote badges distinguish pre-market, regular real-time, after-hours, previous close, and market closed.
- Identical Trading tickers are requested once per refresh cycle.
- Automatic refresh runs every two minutes only while Trading is visible; the manual button forces a fresh provider request.
- Existing Trading positions, wallet balances, execution ledger, P/L, snapshots, SPY benchmark, Investment, History, and Prospect formulas are unchanged.

## Deployment

No new Supabase migration is required after `012_trading_portfolio.sql`.

Add these server-only Vercel variables and redeploy:

```text
TWELVE_DATA_API_KEY=...
FINNHUB_API_KEY=...
```

Do not prefix either key with `VITE_`. Twelve Data Basic supplies real-time regular-session US equities. Live real-time extended-hours access is plan-dependent; Finnhub is used as the best-effort free fallback when the primary response is not fresh.
