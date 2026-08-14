# CVFinance v7.9.5 — Trading Close Position & Re-entry

- A full SELL immediately removes the zero-share card from Active Trading Portfolio.
- Its Target Price Simulation row disappears with the closed active position.
- OPEN, BUY, and SELL ledger records remain permanent.
- Sale proceeds and realized P/L remain included in Trading metrics.
- The closed database position is released without deleting its ledger history.
- The same ticker can be opened again as a completely new Trading position and cost basis.
- Zero-share cards left by earlier versions are closed automatically on load.

No Supabase migration is required.
