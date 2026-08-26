-- Pundi Phase 1: enforce owner-scoped child relationships.
-- Forward-only: no data rewrite or destructive operation.

begin;

-- Parent keys make the owner part of every relationship identity.
alter table public.credit_facilities
  add constraint credit_facilities_user_id_id_key unique (user_id, id);
alter table public.stock_holdings
  add constraint stock_holdings_user_id_id_key unique (user_id, id);
alter table public.trading_positions
  add constraint trading_positions_user_id_id_key unique (user_id, id);

-- Replace ID-only foreign keys with owner+ID foreign keys. This prevents a
-- valid child row for one account from pointing at another account's parent.
alter table public.credit_items
  drop constraint if exists credit_items_facility_id_fkey;
alter table public.credit_items
  add constraint credit_items_user_facility_fkey
  foreign key (user_id, facility_id)
  references public.credit_facilities (user_id, id)
  on delete set null;

alter table public.stock_price_targets
  drop constraint if exists stock_price_targets_holding_id_fkey;
alter table public.stock_price_targets
  add constraint stock_price_targets_user_holding_fkey
  foreign key (user_id, holding_id)
  references public.stock_holdings (user_id, id)
  on delete cascade;

alter table public.investment_dividends
  drop constraint if exists investment_dividends_holding_id_fkey;
alter table public.investment_dividends
  add constraint investment_dividends_user_holding_fkey
  foreign key (user_id, holding_id)
  references public.stock_holdings (user_id, id)
  on delete cascade;

alter table public.trading_ledger
  drop constraint if exists trading_ledger_position_id_fkey;
alter table public.trading_ledger
  add constraint trading_ledger_user_position_fkey
  foreign key (user_id, position_id)
  references public.trading_positions (user_id, id)
  on delete set null;

commit;
