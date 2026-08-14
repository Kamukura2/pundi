# CVFinance v7.9.0 — Mobile Trading UX, Reliable Sell & Realized P/L

## Purpose

Make the optional Trading workspace practical on phones and tablets without changing Investment or any other finance module.

## Changes

- Compacts Trading headings, badges, hero figures, KPI grids, wallet cards, position cards, ledger rows, target simulation, chart, range tabs, and actions on phone screens.
- Uses compact mobile IDR notation where a full number would wrap or create a new row.
- Prevents realtime Supabase reloads and background market refreshes from scrolling the active mobile page back to the top.
- Prevents a realtime reload from starting another Trading quote refresh loop.
- Keeps the API quote as the default Sell execution price while allowing any manually typed decimal value with `step="any"`.
- Shows an explicit Sell confirmation toast with the realized P/L and updates Trading state immediately on desktop and mobile.
- Defines Total Gain/Loss as the sum of `realized_pl_idr` from Trading sell records only.
- Calculates the displayed realized percentage against the cost basis of shares actually sold.
- Changes the former Realized tile to Last Sell P/L to avoid duplicating the accumulated total.
- Adds a confirmed Reset All Trading action that clears Trading positions, wallet ledger, targets, and performance snapshots only.
- Keeps Investment, History, accounts, clients, expenses, electricity, and projection data untouched.

## Deployment

No Supabase migration or new environment variable is required. Deploy the updated project to Vercel; the service-worker cache key is bumped to v7.9.0.
