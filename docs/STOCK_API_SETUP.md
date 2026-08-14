# Stock API setup

## Twelve Data — primary US Trading quotes

1. Create a Twelve Data account and copy the API key from its dashboard.
2. Add `TWELVE_DATA_API_KEY` to Vercel as a server-only variable. Never prefix it with `VITE_`.
3. Keep `FINNHUB_API_KEY` configured as the automatic fallback.
4. Redeploy. Trading requests Twelve Data first for each unique ticker and SPY.
5. While Trading is visible, prices refresh every two minutes and stop when the tab is hidden. Manual refresh bypasses the short server cache.

Twelve Data Basic includes real-time regular-session US equities. According to Twelve Data's current extended-hours documentation, live real-time pre/post data is plan-dependent. During an active session, CVFinance asks Finnhub for a fresher quote when Twelve Data supplies only the previous close. The UI labels `pre-market`, `real-time`, `after-hours`, `previous-close`, or `market-closed`; it never relabels a stale close as live extended-hours data.

## Finnhub — US stocks

1. Create a Finnhub account and copy its API key into `FINNHUB_API_KEY` on Vercel. Trading uses it automatically when Twelve Data is unavailable or not fresh for the active session.
2. Use provider `finnhub`; examples: display symbol `WDC`, market `NASDAQ`, provider symbol `WDC`, currency `USD`.

## Yahoo Finance delayed — IDX stocks

1. No API key is required.
2. Run `supabase/migrations/004_yahoo_idx_provider.sql` once.
3. Use provider `yahoo`; example: display symbol `BMRI`, market `IDX`, provider symbol `BMRI`, currency `IDR`.
4. The server automatically requests the Yahoo symbol `BMRI.JK` and labels the result delayed.
5. Click **Test** in Investment for every mapping.

If Yahoo is temporarily unavailable or throttled, CVFinance keeps the latest successful or manual price and shows an explicit provider error. It never substitutes a simulated price. The mapping fields (`display_symbol`, `market`, `provider`, `provider_symbol`, `currency`) allow a licensed IDX provider to be added later without changing portfolio UI logic.

Price requests are authenticated and tied to an RLS-visible holding, validated server-side, timed out, and cached for five minutes in a warm function. Provider keys stay in Vercel functions. Finnhub `429` and provider quota errors preserve the stored price. Current live price remains separate from Base and Optimistic future targets.

The holding row is the first user-specific allowlist. When `STOCK_SYMBOL_ALLOWLIST` is set, the route also requires the provider symbol (or `SYMBOL:MARKET`) to be present there. Update this Vercel variable when adding a new ticker.

References: [Twelve Data API documentation](https://twelvedata.com/docs), [Twelve Data pre/post-market guide](https://support.twelvedata.com/en/articles/5195429-pre-post-market-data), [Finnhub quote API](https://finnhub.io/docs/api/quote), [yfinance documentation and personal-use disclaimer](https://ranaroussi.github.io/yfinance/).
