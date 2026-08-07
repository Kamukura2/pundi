# CVFinance v7.7.3

v7.7.3 replaces the Prospect `Projection Sources` card with a read-only annual operating performance dashboard. It reports recurring-client income, monthly-plus-yearly budget expense, and annual net profit/loss without changing Balance, Net Worth, Cash, Prospect, or any saved financial data. Events, Credit/PayLater, Stocks, and History are explicitly excluded.

v7.7.2 removes fragile Google HTML scraping and reads the `IDR=X` quote from Yahoo Finance JSON with two-host fallback, safe-rate validation, and last-valid/manual fallback. It also highlights Yearly costs due this month, enlarges the Expense Perusahaan dashboard, brightens Fixed Monthly, and turns Transaction Budget/Channel tags into rounded toggle filters.

v7.7.1 makes History a strict ledger: neither recorded income nor expense changes Balance, Net Worth, or Prospect, while expense tags still fill the matching Budget meter. Budget Pace is fully dynamic, channels use reusable/custom tags, and Yearly due cards use the dark-blue white-text palette.

v7.6.0 makes every Prospect headline auditable as `Opening Cash + Stocks + Income − Expenses`, separates one-time dated Credit from Events, adds optional IDR Netcash and USD Wallet assets, improves two-dimensional drag sorting, and refreshes yearly/Insight contrast.

v7.5.1 adds non-recurring Entrusted Funds with separate Cash Balance or Stocks deductions, active/settled status, persistent ordering, and an additive RLS-protected Supabase table. History expense categories are now rendered as tags sourced dynamically from Monthly Budgets, so selecting a tag fills that budget's current-month meter. Event urgency colors are inverted: the current month is luminous, another month this year is dark orange, and another year remains gray.

v7.5.0 makes the active-year model fully remaining-month aware. The current month uses liquid balances, unpaid client receivables, additional History income, remaining monthly budgets, yearly dues, events, credit due dates, and current stocks; only the full months after it use recurring income and default monthly expense. It adds persistent direct-card sorting for yearly costs, Events, credit and clients, monthly/yearly History archives with delete controls, automatic monthly client payment reset, hover/touch values on every chart, color-coded Events and client states, a remaining-year client income banner, a split current-year/2036 Prospect hero, and refined Insight alignment.

v7.3.0 adds theme-aware vibrant surfaces and corrects the finance model requested after mobile testing. Accumulation now represents current liquid balances plus current stock value; future plans do not reduce it. Clients are separated into recurring, ending, and frozen lanes; only active recurring clients enter Prospect. Events reduce only their matching projection year, yearly costs track `DONE THIS YEAR`, credit items are editable with provider-specific SVG icons, and the mobile navigation now includes Clients and Electricity.

v7.2.0 adds a mobile/tablet-only responsive shell while leaving the desktop layout and all financial logic intact. It includes compact type and cards, safe currency wrapping, touch-friendly forms, mobile stock holding cards, internally scrollable projection tables, an icon-only persistent bottom navigation, automatic mobile scroll-to-top, and a polished standalone PWA experience.

v7.1.0 adds a dedicated private Telegram webhook for fast CVFinance input. It writes into the same Supabase database, uses a strict user/chat allowlist, persistent expiring conversation state, webhook idempotency, and a server-only service-role client. It does not use long polling or depend on a desktop process.

The v7.0.2 delayed Yahoo Finance IDX pricing remains included. IDX quantities are entered as lots (1 lot = 100 shares), while US quantities remain shares and support fractions.

Deployment-ready continuation of CVFinance v6.3.1. The existing eight-tab UI and calculations are preserved while Supabase replaces browser `localStorage` as the authoritative database.

## Included

- Vite + vanilla JavaScript frontend for minimal migration risk
- Supabase Auth, PostgreSQL, RLS, Realtime, optimistic concurrency, and `updated_at`
- IndexedDB loading cache and offline mutation queue
- JSON export/import and v6.3.1 `localStorage` migration
- Installable PWA with offline application shell
- Vercel server routes for Finnhub US quotes and Yahoo Finance delayed IDX quotes
- Yahoo Finance `IDR=X` USD/IDR market quote with cache-bypassing refresh, dual-host retry, plausible-range validation, sudden-jump protection, and last-valid/manual fallback
- Provider mapping, validation, cache, timeout, quota fallback, stale status, manual override, and optional daily cron refresh
- Isolated `/api/telegram/cvfinance-webhook` route with deterministic Indonesian money/date parsing
- Telegram quick transactions, balances, clients, credit, electricity, stocks, targets, and summary commands
- Isolated phone/tablet breakpoints up to 1024 px; existing desktop rendering stays unchanged
- Two draggable client lifecycle sections with recurring-income isolation
- Year-aware Events and annual payment completion tracking
- Theme-aware vibrant cards without dark light-mode panels
- Seven-button icon-only mobile navigation and compact stock editing cards
- App-like Android installation through the existing PWA, with no second database or desktop process

## Commands

```bash
npm install
npm run build
npm run check
```

For local full-stack testing, use `vercel dev`; plain `npm run dev` does not emulate `/api/*` server functions.

## Documentation

- [Supabase setup](docs/SUPABASE_SETUP.md)
- [Vercel deployment](docs/VERCEL_DEPLOYMENT.md)
- [Stock API setup](docs/STOCK_API_SETUP.md)
- [Private Telegram bot setup](docs/TELEGRAM_SETUP.md)
- [Mobile v7.2.0 patch](docs/PATCH_v7_2_0_MOBILE.md)
- [Finance and UI v7.3.0 patch](docs/PATCH_v7_3_0_FINANCE_UI.md)
- [Projection and Insight v7.4.0 patch](docs/PATCH_v7_4_0_PROJECTION_INSIGHTS.md)
- [Remaining Year and Sorting v7.5.0 patch](docs/PATCH_v7_5_0_REMAINING_YEAR_SORTING.md)
- [Entrusted Funds and Budget Tags v7.5.1 patch](docs/PATCH_v7_5_1_ENTRUSTED_FUNDS_TAGS.md)
- [Visual, sorting, and multi-user v7.5.2 patch](docs/PATCH_v7_5_2_VISUAL_SORT_MULTIUSER.md)
- [Auditable projection and stock cash v7.6.0 patch](docs/PATCH_v7_6_0_AUDITABLE_PROJECTION.md)
- [Google-only FX and dashboard v7.7.0 patch](docs/PATCH_v7_7_0_GOOGLE_STATUS_DASHBOARDS.md)
- [Annual operating performance v7.7.3 patch](docs/PATCH_v7_7_3_ANNUAL_OPERATING_PERFORMANCE.md)
- [Second account setup](docs/SECOND_ACCOUNT_SETUP.md)
- [Manual actions](docs/MANUAL_ACTIONS.md)
- [Test checklist](docs/TEST_CHECKLIST.md)
- [Rollback](docs/ROLLBACK.md)

Never commit `.env` or a service-role key. The browser receives only the public Supabase anon/publishable key and all personal rows remain protected by RLS.
