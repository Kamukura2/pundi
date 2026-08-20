begin;

-- v8.3.0: allow requested Crypto quote currencies USD, IDR, and USDT.
alter table public.stock_holdings
  drop constraint if exists stock_holdings_crypto_mapping_check;

alter table public.stock_holdings
  add constraint stock_holdings_crypto_mapping_check
    check (
      (asset_type = 'crypto' and market = 'CRYPTO' and provider = 'binance' and currency in ('USD','IDR','USDT'))
      or asset_type = 'equity'
    );

alter table public.trading_positions
  drop constraint if exists trading_positions_crypto_mapping_check;

alter table public.trading_positions
  add constraint trading_positions_crypto_mapping_check
    check (
      (asset_type = 'crypto' and market = 'CRYPTO' and currency in ('USD','IDR','USDT'))
      or asset_type = 'equity'
    );

alter table public.trading_ledger
  drop constraint if exists trading_ledger_crypto_currency_check;

alter table public.trading_ledger
  add constraint trading_ledger_crypto_currency_check
    check (
      (asset_type = 'crypto' and currency in ('USD','IDR','USDT'))
      or (asset_type = 'equity' and currency in ('USD','IDR'))
    );

commit;
