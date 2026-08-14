# Exact manual actions

1. Create accounts: **GitHub**, **Vercel**, **Supabase**, **Twelve Data**, and **Finnhub**.
2. Create one Supabase project.
3. For a new deployment, run all SQL migration files in numeric order. For the v7.5.2 → v7.6.0 update, run only `011_stock_cash_wallet.sql` before uploading the new source.
4. Disable public sign-ups and manually create one confirmed Auth user.
5. Create a private GitHub repository and push this project.
6. Import that repository into Vercel.
7. Create and add these Vercel values: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TWELVE_DATA_API_KEY`, and `FINNHUB_API_KEY`. Leave `STOCK_SYMBOL_ALLOWLIST` unset if tickers will be added inside the app.
8. Optional cron: add `SUPABASE_SERVICE_ROLE_KEY` and a long random `CRON_SECRET`; keep both server-only.
9. Deploy and copy the default Vercel URL into Supabase Auth Site URL.
10. Sign in from the old browser and choose **Import v6.3.1 local data**, or import a JSON backup. Do this once.
11. Open the same Vercel URL on desktop, laptop, and Android; sign in with the same private account.
12. Test every stock mapping. IDX should show `Yahoo (Delayed)` and US holdings should show `Finnhub`.
13. Install the PWA on Android.
14. Follow [TELEGRAM_SETUP.md](TELEGRAM_SETUP.md) to create a new dedicated bot, add the six server-only environment variables, deploy, set BotFather commands, and register the webhook.
