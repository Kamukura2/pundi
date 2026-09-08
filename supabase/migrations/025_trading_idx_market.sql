begin;

-- v8.8.1: allow existing Trading IDX lot/share semantics.
-- Additive constraint update only; stored quantity remains canonical shares.
alter table public.trading_positions
  drop constraint if exists trading_positions_market_check;

alter table public.trading_positions
  add constraint trading_positions_market_check
    check (market in ('IDX','NASDAQ','NYSE','AMEX','CRYPTO'));

commit;
