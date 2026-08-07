# CVFinance v7 handoff

Baseline: v6.3.1. This release keeps Accumulation, Cashflow, Expenses, Clients, Stocks, Electricity, Prospect, and Insights with the existing visual direction and calculation rules.

Implemented:

- Supabase is authoritative; `localStorage` is read only for one-time v6 migration and a non-financial theme hint.
- Every financial row is user-owned and protected by RLS.
- Realtime reloads cloud changes; `updated_at` guards simultaneous edits.
- IndexedDB holds a temporary cache and coalesced offline mutation queue.
- Sync UI exposes loading, saving, saved, offline, unsynced, and error states.
- JSON backup/import, one-time legacy import, and SQL MVP seed are included.
- Vercel hosts the Vite PWA and server-side stock routes.
- Finnhub covers US symbols; Yahoo Finance provides delayed `.JK` quotes for personal, low-volume IDX tracking.
- Optional Vercel Cron refresh uses a server-only service-role key.

Not performed inside this package: creating third-party accounts, entering private API keys, applying SQL to the user's Supabase project, pushing to the user's GitHub, or deploying to the user's Vercel. Follow `docs/MANUAL_ACTIONS.md` for those credentialed steps.
