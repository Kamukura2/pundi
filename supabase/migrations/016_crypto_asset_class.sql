begin;

-- v8.2.0: extend existing equity records with an explicit crypto asset class.
alter table public.stock_holdings
  add column if not exists asset_type text not null default 'equity';

alter table public.stock_holdings
  drop constraint if exists stock_holdings_asset_type_check,
  drop constraint if exists stock_holdings_provider_check,
  drop constraint if exists stock_holdings_currency_check,
  drop constraint if exists stock_holdings_crypto_mapping_check;

alter table public.stock_holdings
  add constraint stock_holdings_asset_type_check
    check (asset_type in ('equity','crypto')),
  add constraint stock_holdings_provider_check
    check (provider in ('finnhub','twelvedata','yahoo','binance')),
  add constraint stock_holdings_currency_check
    check (currency in ('IDR','USD','USDT')),
  add constraint stock_holdings_crypto_mapping_check
    check (
      (asset_type = 'crypto' and market = 'CRYPTO' and provider = 'binance' and currency = 'USDT')
      or asset_type = 'equity'
    );

alter table public.trading_positions
  add column if not exists asset_type text not null default 'equity';

alter table public.trading_positions
  drop constraint if exists trading_positions_asset_type_check,
  drop constraint if exists trading_positions_market_check,
  drop constraint if exists trading_positions_currency_check,
  drop constraint if exists trading_positions_crypto_mapping_check;

alter table public.trading_positions
  add constraint trading_positions_asset_type_check
    check (asset_type in ('equity','crypto')),
  add constraint trading_positions_market_check
    check (market in ('NASDAQ','NYSE','AMEX','CRYPTO')),
  add constraint trading_positions_currency_check
    check (currency in ('USD','IDR','USDT')),
  add constraint trading_positions_crypto_mapping_check
    check (
      (asset_type = 'crypto' and market = 'CRYPTO' and currency = 'USDT')
      or asset_type = 'equity'
    );

alter table public.trading_ledger
  add column if not exists asset_type text not null default 'equity';

alter table public.trading_ledger
  drop constraint if exists trading_ledger_asset_type_check,
  drop constraint if exists trading_ledger_currency_check,
  drop constraint if exists trading_ledger_crypto_currency_check;

alter table public.trading_ledger
  add constraint trading_ledger_asset_type_check
    check (asset_type in ('equity','crypto')),
  add constraint trading_ledger_currency_check
    check (currency in ('USD','IDR','USDT')),
  add constraint trading_ledger_crypto_currency_check
    check (
      (asset_type = 'crypto' and currency = 'USDT')
      or (asset_type = 'equity' and currency in ('USD','IDR'))
    );

alter table public.trading_snapshots
  add column if not exists benchmark_equity_idr numeric(24,6),
  add column if not exists benchmark_external_flows_idr numeric(24,6),
  add column if not exists benchmark_holdings_value_idr numeric(24,6),
  add column if not exists benchmark_cash_value_idr numeric(24,6);

create index if not exists stock_holdings_user_asset_type_idx
  on public.stock_holdings(user_id, asset_type, market);
create index if not exists trading_positions_user_asset_type_idx
  on public.trading_positions(user_id, asset_type, market);

commit;
