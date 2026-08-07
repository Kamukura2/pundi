# CVFinance v7.4.0

v7.4.0 rebuilds Accumulation and Prospect around a month-aware cash projection. The current month uses liquid balances, unpaid client receivables, additional History income, remaining monthly budgets, yearly dues, events, credit due dates, and current stocks. Later months and years carry closing cash forward without double-counting History expenses. It also adds monthly budget progress modes, sortable yearly costs, draggable recurring/ending clients, a single credit section under Events, a yearly expense recap, OLED black mode, red/green signed values, US/ID translation, and data-triggered illustrated Insights.

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
- [Manual actions](docs/MANUAL_ACTIONS.md)
- [Test checklist](docs/TEST_CHECKLIST.md)
- [Rollback](docs/ROLLBACK.md)

Never commit `.env` or a service-role key. The browser receives only the public Supabase anon/publishable key and all personal rows remain protected by RLS.
