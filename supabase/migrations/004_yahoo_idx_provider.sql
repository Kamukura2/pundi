begin;

alter table public.stock_holdings
  drop constraint if exists stock_holdings_provider_check;

alter table public.stock_holdings
  add constraint stock_holdings_provider_check
  check (provider in ('finnhub','twelvedata','yahoo'));

update public.stock_holdings
set provider = 'yahoo',
    provider_symbol = regexp_replace(upper(provider_symbol), '\\.JK$', '')
where market = 'IDX'
  and provider <> 'yahoo';

commit;
