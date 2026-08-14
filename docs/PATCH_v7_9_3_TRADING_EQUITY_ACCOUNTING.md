# CVFinance v7.9.3 — Trading Equity Accounting Fix

This patch repairs the Trading dashboard after a SELL record has synced but Supabase reloads an older position quantity.

- Position quantity and weighted average cost are reconstructed from the position's own OPEN, BUY, and SELL ledger rows.
- A fully sold position is forced to zero open quantity, so its sale proceeds cannot be counted again as an active holding.
- The repaired position and current performance snapshot are saved back to Supabase automatically.
- Realized P/L remains the accumulated result of Trading SELL records only.
- Unrealized P/L applies only to the remaining open Trading quantity.
- Investment positions and every non-Trading tab remain isolated.

No new Supabase migration is required.
