# Stock API setup

## Finnhub — US stocks

1. Create a Finnhub account and copy its API key into `FINNHUB_API_KEY` on Vercel.
2. Use provider `finnhub`; examples: display symbol `WDC`, market `NASDAQ`, provider symbol `WDC`, currency `USD`.

## Twelve Data — IDX stocks

1. Create a Twelve Data account and copy its API key into `TWELVE_DATA_API_KEY` on Vercel.
2. Use provider `twelvedata`; example: display symbol `BMRI`, market `IDX`, provider symbol `BMRI`, currency `IDR`.
3. Click **Test** in Stocks for every mapping. IDX availability depends on the subscribed Twelve Data plan.

If Twelve Data denies the plan or symbol, CVFinance keeps the latest successful or manual price and shows **API unavailable for current plan**. It never scrapes an unofficial site. The mapping fields (`display_symbol`, `market`, `provider`, `provider_symbol`, `currency`) allow another licensed IDX provider to be added later without changing portfolio UI logic.

Price requests are authenticated and tied to an RLS-visible holding, validated server-side, timed out, and cached for five minutes in a warm function. Provider keys stay in Vercel functions. Finnhub `429` and provider quota errors preserve the stored price. Current live price remains separate from Base and Optimistic future targets.

The holding row is the first user-specific allowlist. When `STOCK_SYMBOL_ALLOWLIST` is set, the route also requires the provider symbol (or `SYMBOL:MARKET`) to be present there. Update this Vercel variable when adding a new ticker.

Official references: [Finnhub quote API](https://finnhub.io/docs/api/quote), [Twelve Data quote API](https://twelvedata.com/docs/market-data/real-time-price).
