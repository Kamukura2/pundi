# CVFinance v7.9.4 — Desktop Trading SELL Button Fix

- Trading position actions now use one permanent delegated click handler.
- Price refreshes and Supabase re-renders can no longer leave a visible desktop button without a handler.
- Decorative card layers ignore pointer events.
- The action row is explicitly placed above card decoration.
- SELL opens the existing execution dialog with an editable price.
- SELL is disabled only when the ledger-confirmed open quantity is zero.

No Supabase migration is required.
