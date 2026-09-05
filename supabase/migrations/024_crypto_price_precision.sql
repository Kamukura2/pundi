begin;

-- v8.8.1: preserve fractional crypto prices and execution values.
-- This only widens numeric precision/scale; existing values are retained.
alter table public.stock_holdings
  alter column avg_purchase_price type numeric(28,10) using avg_purchase_price,
  alter column current_price type numeric(28,10) using current_price,
  alter column manual_current_price type numeric(28,10) using manual_current_price;

alter table public.stock_price_targets
  alter column target_price type numeric(28,10) using target_price;

alter table public.trading_positions
  alter column avg_purchase_price type numeric(28,10) using avg_purchase_price,
  alter column current_price type numeric(28,10) using current_price,
  alter column manual_current_price type numeric(28,10) using manual_current_price,
  alter column target_price type numeric(28,10) using target_price,
  alter column stop_loss_price type numeric(28,10) using stop_loss_price;

alter table public.trading_ledger
  alter column execution_price type numeric(28,10) using execution_price;

commit;
