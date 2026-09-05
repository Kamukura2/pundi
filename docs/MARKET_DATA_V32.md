# Pundi V3.2 shared market-data service

## Historical CVFinance audit (read-only)

The historical CVFinance implementation was inspected without changing the
source project or reading user finance rows:

- IDX equities: Yahoo Chart (`BMRI` normalized to `BMRI.JK`), with query1 and
  query2 fallback and delayed/end-of-day semantics.
- US/trading equities: Twelve Data primary and Finnhub fallback. Missing Vercel
  environment keys produced `provider_not_configured`.
- FX: Yahoo Chart `IDR=X`, with numeric range validation.
- Crypto: Binance public ticker/exchange metadata, with direct-IDR lookup
  attempted before stablecoin/USD conversion.
- Cache/rate limit: in-memory state in a warm Vercel function, not shared across
  Web/Android/Windows instances.

CVFinance remains read-only. The historical Vercel handlers remain untouched.

## V3.2 replacement

Clients call the Pundi-owned Supabase Edge Function:

```text
Web / Capacitor Android / Electron Windows
              |
              v
Supabase Edge Function: market-data
              |
      +-------+---------+----------+
      |                 |          |
  Yahoo Chart       Indodax    Binance Vision
  IDX / US / FX     direct IDR  stablecoin fallback
              |
       service-role-only cache: market_data_cache
```

The client bundle contains only the public Supabase URL/anon key needed by
Supabase Auth and function invocation. Provider credentials are not used by the
service and no provider key is embedded in any client.

## Actions

- `health` / `providerHealth` — public provider diagnostics, rate-limited.
- `marketStatus` — deterministic market session status.
- `quote` — authenticated, ownership-checked equity holding quote.
- `batchQuotes` — authenticated, ownership-checked equity quote batch.
- `cryptoQuote` / `batchCryptoQuotes` — authenticated public-symbol quote(s).
- `fx` — authenticated USD/IDR rate.
- `tradingQuote` / `benchmarkHistory` — authenticated trading quote/history.

Every successful quote includes `provider`, `normalizedSymbol`, `currency`,
`price` or `rate`, `status/state`, `quoteTimestamp`, and cache metadata.
Allowed states are `LIVE`, `DELAYED`, `FALLBACK`, `STALE`, and `OFFLINE`.

## Provider mapping

- IDX `BMRI` -> Yahoo `BMRI.JK`; the `.JK` suffix never enters canonical
  display/storage data.
- US `MU` -> Yahoo `MU`; Stooq is a no-secret fallback.
- Crypto `BTC/IDR` and `ETH/IDR` -> Indodax `BTCIDR` / `ETHIDR` first.
- Crypto without a direct Indodax IDR pair -> Binance `BASEUSDT` (or another
  supported stable pair) multiplied by the shared USD/IDR quote, marked
  `FALLBACK` and `quoteMode=fx-fallback`.
- USD/IDR -> Yahoo `IDR=X`, then Open ER-API fallback, both range-validated.

Provider failure never writes holdings and never substitutes a zero quote.
Expired valid data is returned as `STALE` when available.

## Cache and throttling

`023_market_data_cache.sql` adds only a service cache table. It has no user ID,
no financial row, no auth data, RLS enabled, no anon/authenticated grants, and
service-role-only access. TTLs are 5 minutes for IDX, 2 minutes for US, 1 minute
for crypto, and 10 minutes for FX. Provider batches are concurrency-limited to
five workers.

## Deployment gate

After target access is restored, run from this staging worktree with the
canonical Supabase wrapper and exact ref. This target has incomplete legacy
migration history, so do **not** use broad `db push` or replay older files.
Apply only a separately reviewed new migration through the authorized direct
SQL/query path, then deploy the function:

```text
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File C:/JensenBot/Pundi/scripts/pundi-supabase.ps1 -WriteOperation functions deploy market-data --project-ref ndeycwoyjwyntjkgbzlz --no-verify-jwt --use-api --workdir C:/JensenBot/Tooling/PundiV32Refinement/repo
```

For the V3.2 run, migration `023_market_data_cache.sql` was direct-applied to
`ndeycwoyjwyntjkgbzlz` after remote history/catalog checks and was verified by
read-back. The function performs its own bearer-token validation because the
endpoint is configured with `verify_jwt = false` for consistent custom
error/state responses. Do not deploy while exact target project privileges are
not verified.
