# CVFinance v7.8.2 — Trading SPY baseline and Target Price

## What changed

- Portfolio vs SPY works from the first position/deposit and does not wait for a Sell.
- The daily SPY close remains the comparison baseline while the latest API quote is rendered as a separate current preview.
- The benchmark displays current SPY price, provider, and quote time.
- Add Trading Position now asks only for ticker, market, shares, entry price, and opening date.
- The current API price is the primary number on every Trading position card.
- Manual fallback price, Take Profit, and Stop Loss controls were removed from Trading UI.
- Target Price Simulation accepts one target per ticker and calculates projected P/L, percentage return, and projected total value.
- Delete permanently removes an incorrect ticker and its linked Trading ledger rows. Real exits must use Sell.

## Deployment

No new Supabase migration or environment variable is required. Replace the repository files with this build, keep the existing `TWELVE_DATA_API_KEY`, then redeploy on Vercel.

After deployment, open Trading and press refresh once. Existing same-day snapshots are repaired by the benchmark-history refresh and the current SPY quote is displayed in the SPY KPI.
