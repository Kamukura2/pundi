# CVFinance v7.9.6 — Closed Position Tombstone & Re-entry

This patch fixes the delayed Supabase resurrection of a fully sold Trading card.

- Zero-share positions are retained internally as synchronized closed tombstones.
- Active Trading Portfolio renders only positions with shares greater than zero.
- Target Price Simulation follows the same active-only rule.
- Closed tickers are excluded from market-price refreshes.
- Closing clears the obsolete target price.
- Reopening the same ticker reuses its synchronized row with a fresh quantity, entry date, target, and cost basis.
- Previous-cycle OPEN/BUY/SELL records stay permanently in Trading Ledger but are detached from the new cycle.
- Investment and every non-Trading module remain unchanged.

No Supabase migration is required.
