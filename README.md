# CVFinance v7.0.2

v7.0.2 adds delayed IDX prices through Yahoo Finance. IDX quantities are entered as lots (1 lot = 100 shares), while US quantities remain shares and support fractions. The database continues storing the underlying share count, so existing portfolio values remain compatible.

Deployment-ready continuation of CVFinance v6.3.1. The existing eight-tab UI and calculations are preserved while Supabase replaces browser `localStorage` as the authoritative database.

## Included

- Vite + vanilla JavaScript frontend for minimal migration risk
- Supabase Auth, PostgreSQL, RLS, Realtime, optimistic concurrency, and `updated_at`
- IndexedDB loading cache and offline mutation queue
- JSON export/import and v6.3.1 `localStorage` migration
- Installable PWA with offline application shell
- Vercel server routes for Finnhub US quotes and Yahoo Finance delayed IDX quotes
- Provider mapping, validation, cache, timeout, quota fallback, stale status, manual override, and optional daily cron refresh

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
- [Manual actions](docs/MANUAL_ACTIONS.md)
- [Test checklist](docs/TEST_CHECKLIST.md)
- [Rollback](docs/ROLLBACK.md)

Never commit `.env` or a service-role key. The browser receives only the public Supabase anon/publishable key and all personal rows remain protected by RLS.
