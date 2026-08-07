-- CVFinance v7.6.0: optional portfolio cash components.
-- Safe migration: adds nullable-input-compatible numeric columns with zero defaults.

alter table public.app_settings
  add column if not exists stock_netcash_idr numeric(20,4) not null default 0,
  add column if not exists stock_wallet_usd numeric(20,8) not null default 0;

alter table public.app_settings
  drop constraint if exists app_settings_stock_netcash_nonnegative,
  drop constraint if exists app_settings_stock_wallet_nonnegative;

alter table public.app_settings
  add constraint app_settings_stock_netcash_nonnegative check (stock_netcash_idr >= 0),
  add constraint app_settings_stock_wallet_nonnegative check (stock_wallet_usd >= 0);
