# Pundi v8.3.3

v8.3.2 releases the approved GoPayLater visual distinction, Indonesian money-input formatting, and direct-IDR crypto FX correction. The existing Stocks navigation label remains Assets; Investment/Trading workspaces, Crypto, persistence, and accounting behavior are preserved.

v8.3.0 extends Crypto with flexible USD, IDR, and USDT requested quotes. User-facing pairs are resolved through validated Binance source symbols, with USD/IDR normalization using the existing CVFinance FX rate. Existing USDT positions remain unchanged.

v8.2.2 fixes the authenticated Crypto runtime crash caused by passing USDT to Intl.NumberFormat as a fiat currency code. USDT now uses numeric formatting with an explicit suffix, while USD/IDR formatting and all Investment/Trading accounting remain unchanged.

v8.2.1 fixes production Crypto quote resolution through a same-origin Vercel REST proxy, aligns Investment/Trading market selectors, simplifies Crypto symbol entry, and places Crypto status beside the existing FX status. Investment and Trading accounting are unchanged.

v8.2.0 adds Crypto as a market-data-only asset class inside Stocks → Investment and Stocks → Trading. Binance public spot data is used without API credentials; crypto prices are displayed in USDT and normalized to IDR using the existing USD/IDR approximation for portfolio totals.

v8.1.2 adds separate persisted Electricity TOP UP events. A top-up increases the current effective meter balance without changing completed consumption intervals; future physical readings reconcile the top-up exactly once.

v8.1.1 replaces the crowded mobile/tablet bottom navigation with a compact hamburger drawer that reuses the complete desktop sidebar. A single floating transaction button remains at the lower-right, the drawer closes after navigation, backdrop taps, or Escape, and phone headers receive clearer vertical spacing. Desktop layout and financial behavior are unchanged.

v8.1.0 rebuilds the phone and tablet workspace around compact, readable cards and a nine-action floating navigation bar that mirrors the desktop section icons. The Clients destination is now the Income workspace with a Clients subcategory, History filters share the Stocks tab design, Available Balance appears above desktop sidebar projections, dividend review uses `✓ Confirm`, and individual Trading Ledger records can be removed with their wallet, position, P/L, and performance effects recalculated. Desktop financial functions and the isolated Investment/Trading workspaces remain unchanged.

v8.0.0 consolidates Investment and Trading into one **Stocks** navigation destination with an in-page Investment/Trading switch. Both workspaces retain their existing isolated calculations and persistence, while their Netcash & USD Wallet cards now share one visual and interaction pattern. Stocks → Investment adds a dynamic confirmed-dividend ledger per active ticker, official/provider discovery, entitlement dates, receivables, one-time wallet crediting, and confirmed future dividend income in Prospect. The new Supabase migration `013_investment_dividends.sql` is required before deploying the application files.

v7.9.6 prevents a fully sold Trading card from reappearing after a delayed Supabase realtime reload. A zero-share synchronized tombstone is retained internally, but only positions with open shares render in Active Trading Portfolio, Target Price Simulation, and price refreshes. Reopening the same ticker reuses that tombstone with a fresh quantity, entry date, target, and cost basis, while completed-cycle ledger records stay detached and permanent. No schema migration is required.

v7.9.5 completes the Trading position lifecycle. Selling every remaining share removes the ticker from Active Trading Portfolio and Target Price Simulation while retaining its OPEN/BUY/SELL ledger history, sale proceeds, and realized P/L. The closed position record is released so the same ticker can later be opened again with a new position id, opening date, quantity, and cost basis. Existing zero-share positions from earlier versions are repaired automatically.

v7.9.4 makes the desktop Trading BUY, SELL, and DELETE controls resilient to quote refreshes and cloud re-renders. A permanent delegated click handler now lives on the Trading portfolio container, while the action row is layered above non-interactive card decoration. SELL still opens with the API price as an editable default and remains disabled only when the ledger-confirmed open quantity is zero.

v7.9.3 fixes Trading equity after a sell by reconciling every active position's quantity and average cost against its isolated Trading ledger. If a Supabase reload returns a stale pre-sell position beside the saved SELL record, CVFinance now repairs the open quantity, refreshes the current snapshot, and persists the corrected position. Sell proceeds therefore appear once, fully sold positions carry no unrealized P/L, and the portfolio/SPY comparison uses the repaired equity. Investment remains excluded.

v7.9.2 renames the Trading dashboard capital label from Net Contributions to Starting Funds. The underlying isolated Trading capital calculation remains unchanged.

v7.9.1 restores native vertical document scrolling on phones and tablets. Mobile background/realtime renders no longer call `scrollTo`, the root document owns the vertical scroll again, and Trading cards explicitly allow vertical pan gestures. All v7.9.0 Trading behavior remains unchanged.

v7.9.0 compacts the complete Trading workspace for phones and tablets, keeps financial values in stable grids, reduces the quote-source badge, and stops realtime/background refreshes from forcing the mobile page back to the top. Sell keeps the API quote as its default but accepts any user-entered execution price, then updates the position, Trading wallet, ledger, and P/L immediately. Total Gain/Loss is now the accumulated realized P/L from Trading sells only, with a sold-cost-basis percentage and a separate Last Sell P/L tile; Investment never enters either number. A confirmed Reset All Trading action removes only Trading positions, wallet entries, ledger, targets, and snapshots for safe testing.

v7.8.3 prevents Trading Target Price edits from being rolled back by a simultaneous background quote refresh or transient Supabase optimistic-lock conflict. Local input remains authoritative, conflicts retry once against freshly loaded cloud metadata, realtime reloads wait for queued local saves, and automatic Trading price refreshes no longer flash the global Saving state or replace an active editor. Target Price Simulation typography, inputs, projected P/L, and projected value are enlarged for clearer desktop and mobile reading.

v7.8.0 renames the existing Stocks navigation to Investment without changing its holdings, targets, wallet, pricing, or projection behavior. It adds a separate optional Trading workspace with persistent positions, USD/IDR trading cash, opening cost basis, buy-more and sell execution dialogs, realized and unrealized P/L, withdrawal-neutral performance, take-profit/stop-loss plans, permanent execution ledger, and a 1W/1M/3M/YTD/ALL equity comparison against SPY. Trading assets are persisted in three new RLS-protected Supabase tables and appear separately from Investment Stocks in Prospect. Insights now report Trading alpha, realized/unrealized performance, and win rate.

v7.7.9 simplifies client cards to `PAID` or the remaining nominal value only, swaps the Add Transaction form so Description sits above Amount, and pre-fills every new entry from the latest saved transaction for faster batch input. The remembered template includes type, description, amount, category, channel, and date and is recovered from the synchronized transaction record itself. History category/channel donuts are enlarged. No financial formula or projection rule changes.

v7.7.8 turns History into a true monthly ledger workspace: the former Income/Expense/Net cards become one Total Expense This Month headline; totals, category mix, channel mix, Budget Pace, and the active transaction list automatically start fresh when the calendar month changes. Nothing is deleted—older transactions move into permanent monthly Archive cards. Category and channel donuts both show nominal values and percentages. History remains ledger-only and cannot change Balance, Net Worth, Cash, or Prospect.

v7.7.7 makes client payment status immediately readable (`0 outstanding` or the remaining nominal plus `outstanding left`), compacts each stock's Target Prices into two year-target cards per row, and turns every Future Cash + Assets year into a click-to-expand detail card. Financial formulas, target save behavior, History isolation, and Prospect calculations remain unchanged.

v7.7.6 fills the remaining Insights space with a read-only Financial Action Plan, increases contrast on colored summary-card labels, and removes internal Target Price scrolling. Ticker and Current use grouped blocks beside the complete 2027–2036 target list. The v7.7.5 P/L percentages, fuchsia identity, Decision Metrics, History isolation, and Prospect formulas remain unchanged.

v7.7.2 removes fragile Google HTML scraping and reads the `IDR=X` quote from Yahoo Finance JSON with two-host fallback, safe-rate validation, and last-valid/manual fallback. It also highlights Yearly costs due this month, enlarges the Expense Perusahaan dashboard, brightens Fixed Monthly, and turns Transaction Budget/Channel tags into rounded toggle filters.

v7.7.1 makes History a strict ledger: neither recorded income nor expense changes Balance, Net Worth, or Prospect, while expense tags still fill the matching Budget meter. Budget Pace is fully dynamic, channels use reusable/custom tags, and Yearly due cards use the dark-blue white-text palette.

v7.6.0 makes every Prospect headline auditable as `Opening Cash + Stocks + Income − Expenses`, separates one-time dated Credit from Events, adds optional IDR Netcash and USD Wallet assets, improves two-dimensional drag sorting, and refreshes yearly/Insight contrast.

v7.5.1 adds non-recurring Entrusted Funds with separate Cash Balance or Stocks deductions, active/settled status, persistent ordering, and an additive RLS-protected Supabase table. History expense categories are now rendered as tags sourced dynamically from Monthly Budgets, so selecting a tag fills that budget's current-month meter. Event urgency colors are inverted: the current month is luminous, another month this year is dark orange, and another year remains gray.

v7.5.0 makes the active-year model fully remaining-month aware. The current month uses liquid balances, unpaid client receivables, additional History income, remaining monthly budgets, yearly dues, events, credit due dates, and current stocks; only the full months after it use recurring income and default monthly expense. It adds persistent direct-card sorting for yearly costs, Events, credit and clients, monthly/yearly History archives with delete controls, automatic monthly client payment reset, hover/touch values on every chart, color-coded Events and client states, a remaining-year client income banner, a split current-year/2036 Prospect hero, and refined Insight alignment.

v7.3.0 adds theme-aware vibrant surfaces and corrects the finance model requested after mobile testing. Accumulation now represents current liquid balances plus current stock value; future plans do not reduce it. Clients are separated into recurring, ending, and frozen lanes; only active recurring clients enter Prospect. Events reduce only their matching projection year, yearly costs track `DONE THIS YEAR`, credit items are editable with provider-specific SVG icons, and the mobile navigation now includes Clients and Electricity.

v7.2.0 adds a mobile/tablet-only responsive shell while leaving the desktop layout and all financial logic intact. It includes compact type and cards, safe currency wrapping, touch-friendly forms, mobile stock holding cards, internally scrollable projection tables, an icon-only persistent bottom navigation, automatic mobile scroll-to-top, and a polished standalone PWA experience.

v7.1.0 adds a dedicated private Telegram webhook for fast CVFinance input. It writes into the same Supabase database, uses a strict user/chat allowlist, persistent expiring conversation state, webhook idempotency, and a server-only service-role client. It does not use long polling or depend on a desktop process.

The v7.0.2 delayed Yahoo Finance IDX pricing remains included. IDX quantities are entered as lots (1 lot = 100 shares), while US quantities remain shares and support fractions.

Deployment-ready continuation of CVFinance v6.3.1. Stocks now contains the unchanged Investment and Trading workspaces behind one switch while Supabase remains the authoritative database.

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
- Confirmed Investment dividend events with record/payment dates, eligibility locking, wallet crediting, and Prospect integration

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
- [Compact targets and Prospect dropdowns v7.7.7 patch](docs/PATCH_v7_7_7_COMPACT_TARGETS_PROSPECT_DROPDOWNS.md)
- [Monthly History and expense mix v7.7.8 patch](docs/PATCH_v7_7_8_MONTHLY_HISTORY_EXPENSE_MIX.md)
- [Sticky transaction entry and larger donuts v7.7.9 patch](docs/PATCH_v7_7_9_STICKY_TRANSACTION_LARGE_DONUTS.md)
- [Investment, isolated Trading ledger and SPY benchmark v7.8.0 patch](docs/PATCH_v7_8_0_INVESTMENT_TRADING_SPY.md)
- [Twelve Data primary Trading quotes v7.8.1 patch](docs/PATCH_v7_8_1_TWELVE_DATA_TRADING.md)
- [Trading SPY baseline and Target Price v7.8.2 patch](docs/PATCH_v7_8_2_TRADING_SPY_TARGETS.md)
- [Trading Target Sync Stability and Readability v7.8.3 patch](docs/PATCH_v7_8_3_TARGET_SYNC_READABILITY.md)
- [Stock Hub and Investment Dividend Ledger v8.0.0 patch](docs/PATCH_v8_0_0_STOCK_HUB_DIVIDENDS.md)
- [Second account setup](docs/SECOND_ACCOUNT_SETUP.md)
- [Manual actions](docs/MANUAL_ACTIONS.md)
- [Test checklist](docs/TEST_CHECKLIST.md)
- [Rollback](docs/ROLLBACK.md)

Never commit `.env` or a service-role key. The browser receives only the public Supabase anon/publishable key and all personal rows remain protected by RLS.
