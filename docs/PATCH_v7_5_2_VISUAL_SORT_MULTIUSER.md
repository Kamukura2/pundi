# CVFinance v7.5.2 — Visual, Sorting, and Multi-user Patch

## Required migration

Run `supabase/migrations/010_monthly_budget_sort_order.sql` before deploying v7.5.2. It adds only `sort_order` metadata and an index to Monthly Budgets. Existing budget categories, amounts, and payment progress are preserved.

## Included

- Fluid pointer-based sorting with a visible placeholder, floating card, touch long-press, mouse movement activation, and viewport auto-scroll.
- Persistent Monthly Budget sorting.
- Distinct wallet, client, coffee, electricity, history, and stock Insight palettes with light halos.
- Projection KPI breakdown beneath Base vs Optimistic.
- Yearly portfolio-value chart in the Stocks hero.
- Automatic provider column removed from Holdings while IDX still maps to Yahoo and US markets still map to Finnhub.
- Smaller mobile Prospect values to avoid wrapping.
- Verified user isolation: browser reads/writes and offline caches are scoped to the authenticated Supabase user; all financial tables enforce owner-only RLS.

Telegram remains intentionally single-owner. Its server routes continue to use `CVFINANCE_OWNER_USER_ID` and should not be shared with a second web user.
