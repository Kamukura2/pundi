# CVFinance v7 handoff

Baseline: v6.3.1. v7.7.0 keeps all eight modules, renames Cashflow to History in the UI, and uses an auditable month-aware projection engine for Accumulation and Prospect.

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
- v7.1.0 adds an isolated private Telegram webhook at `/api/telegram/cvfinance-webhook`.
- The bot uses its own token/secret/allowlist variables, deterministic parsing, persistent expiring state, and the same Supabase owner UUID for every query.
- Telegram writes flow through existing Supabase Realtime to the web/PWA; no PC process or long polling is used.
- v7.2.0 isolates the redesigned phone/tablet shell at 1024 px and below, preserves the desktop UI, and keeps the five-button floating mobile navigation persistent.
- Mobile switches every financial module to contained cards or internally scrollable tables, prevents page-level overflow, and scrolls to the top when changing sections.
- v7.4.0 adds migration `007`, monthly budget progress, recurring/ending client drag sorting, dynamic projection years, OLED surfaces, bilingual US/ID UI, and illustrated data-driven Insights.
- v7.5.1 adds migration `009`, non-recurring Entrusted Funds deducted once from Cash or Stocks, and dynamic History tags tied directly to Monthly Budget meters.
- v7.5.2 adds migration `010`, persisted Monthly Budget sorting, fluid pointer-based sorting, richer projection/stock charts, distinct Insight palettes, and tighter mobile Prospect values.
- v7.6.0 adds migration `011`, optional Netcash/Wallet assets, exact visible Prospect equations, separated dated Credit, and two-dimensional grid sorting.
- v7.7.0 requires no migration. It makes USD/IDR strictly Google Finance-only, adds the fixed History-only Expense Perusahaan dashboard, four client summary metrics, separate paid/unpaid client palettes, brighter Insight cards, and momentum guidance.
- v7.7.2 requires no migration. It replaces Google HTML FX parsing with Yahoo Finance `IDR=X` JSON, rejects implausible/sudden quote changes, highlights current-month Yearly cards, expands the Expense Perusahaan dashboard, brightens Fixed Monthly, and adds toggleable Transaction tag filters.
- v7.7.4 requires no migration. Prospect contains isolated annual and monthly operating dashboards. Monthly Net uses recurring-client monthly income minus monthly budget and one-twelfth of yearly budget. Events, Credit, Stocks, and History are excluded, and neither dashboard writes into Balance, Net Worth, Cash, or Prospect.
- v7.7.5 requires no migration. It adds a full-bleed fuchsia icon, P/L percentages, vertical target-price editing, unique read-only Decision Metrics, and brighter dark-mode summary grids. History remains ledger-only and all projection rules are unchanged.
- v7.7.6 requires no migration. It adds a read-only Financial Action Plan, white labels on colored OLED summary cards, and full-height Target Price groups with merged Ticker/Current blocks and no internal scrollbar. All financial formulas remain unchanged.
- v7.7.7 requires no migration. Client cards now state either `0 outstanding` or the remaining nominal plus `outstanding left`; Target Price years render as two compact year-target cards per row; Future Cash + Assets cards are collapsed by default and reveal their existing auditable detail on click. Target persistence and all financial formulas remain unchanged.
- v7.7.8 requires no migration. History now has one current-month Total Expense headline, separate category and channel donuts with nominal/percentage legends, a dedicated current-month transaction area, and collapsed permanent archives for prior months. Calendar rollover changes the active month filter but never deletes a transaction. History remains ledger-only and is excluded from Balance, Net Worth, Cash, and Prospect.
- v7.7.9 requires no migration. Client card headlines show `PAID` or only the outstanding nominal. Add Transaction places Description before Amount and uses the newest synchronized transaction as the complete template for the next batch entry, preserving type, description, amount, category, channel, and date. Both History donuts are larger. All History isolation and projection rules remain unchanged.
- Separate Supabase Auth users have isolated empty datasets through per-table RLS. The Telegram bot remains intentionally assigned to the single `CVFINANCE_OWNER_USER_ID` configured in Vercel.

Not performed inside this package: creating third-party accounts/bots, entering private API keys, applying SQL to the user's Supabase project, pushing to the user's GitHub, registering the Telegram webhook, or deploying to the user's Vercel. Follow `docs/TELEGRAM_SETUP.md` for those credentialed steps.
