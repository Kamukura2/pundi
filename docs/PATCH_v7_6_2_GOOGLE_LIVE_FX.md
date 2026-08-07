# CVFinance v7.6.2 — Current USD/IDR and dedicated refresh

- USD/IDR now uses the current Google Finance `USD-IDR` market quote first.
- Yahoo Finance intraday data is the first fallback; its latest valid one-minute close is preferred over stale metadata.
- Finnhub remains the final remote fallback, followed by the last successful per-user saved rate in the client.
- The FX badge shows the provider. Hovering it shows the provider timestamp.
- The dedicated refresh button bypasses both browser and warm-function caches.
- Every successful refresh immediately recalculates US holdings, USD Wallet, total assets, Prospect, and Insights.
- US valuation remains `shares × current USD price × current USD/IDR`.

No Supabase migration is required.
