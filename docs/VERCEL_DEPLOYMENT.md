# Vercel deployment

1. Create a private GitHub repository and push this project directory.
2. In Vercel, choose **Add New → Project**, import that repository, and accept the detected Vite settings.
3. Add the required environment variables from `.env.example` to Production, Preview, and Development:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `FINNHUB_API_KEY`
   - `TWELVE_DATA_API_KEY`
4. For the optional scheduled stock refresh, also add server-only `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET`. Never prefix or expose the service-role value to the frontend.
5. Set `STOCK_SYMBOL_ALLOWLIST` to the provider symbols you use, separated by commas. Add new holdings here before testing them.
6. Deploy. Use the generated `*.vercel.app` URL; no desktop PC needs to stay on.
7. Add that production URL to Supabase Auth URL Configuration, then redeploy once.
8. On Android Chrome, open the Vercel URL, sign in, and choose **Install app** from CVFinance or **Add to Home screen** from Chrome.

The cron in `vercel.json` runs on weekdays. If the Vercel plan does not support the configured cadence, remove only the `crons` block; opening the app and the manual refresh button still update prices.

Official references: [Vercel environment variables](https://vercel.com/docs/environment-variables), [Vercel Cron](https://vercel.com/docs/cron-jobs).
