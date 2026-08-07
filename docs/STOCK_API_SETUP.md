# Stock API setup

## Finnhub — US stocks

1. Create a Finnhub account and copy its API key into `FINNHUB_API_KEY` on Vercel.
2. Use provider `finnhub`; examples: display symbol `WDC`, market `NASDAQ`, provider symbol `WDC`, currency `USD`.

## Yahoo Finance delayed — IDX stocks

1. No API key is required.
2. Run `supabase/migrations/004_yahoo_idx_provider.sql` once.
3. Use provider `yahoo`; example: display symbol `BMRI`, market `IDX`, provider symbol `BMRI`, currency `IDR`.
4. The server automatically requests the Yahoo symbol `BMRI.JK` and labels the result delayed.
5. Click **Test** in Stocks for every mapping.

If Yahoo is temporarily unavailable or throttled, CVFinance keeps the latest successful or manual price and shows an explicit provider error. It never substitutes a simulated price. The mapping fields (`display_symbol`, `market`, `provider`, `provider_symbol`, `currency`) allow a licensed IDX provider to be added later without changing portfolio UI logic.

Price requests are authenticated and tied to an RLS-visible holding, validated server-side, timed out, and cached for five minutes in a warm function. Provider keys stay in Vercel functions. Finnhub `429` and provider quota errors preserve the stored price. Current live price remains separate from Base and Optimistic future targets.

The holding row is the first user-specific allowlist. When `STOCK_SYMBOL_ALLOWLIST` is set, the route also requires the provider symbol (or `SYMBOL:MARKET`) to be present there. Update this Vercel variable when adding a new ticker.

References: [Finnhub quote API](https://finnhub.io/docs/api/quote), [yfinance documentation and personal-use disclaimer](https://ranaroussi.github.io/yfinance/).
