create or replace function public.seed_cvfinance_mvp()
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  bmri_id uuid := gen_random_uuid();
  wdc_id uuid := gen_random_uuid();
  card_id uuid := gen_random_uuid();
  gopay_id uuid := gen_random_uuid();
  shopee_id uuid := gen_random_uuid();
  y integer;
  base_bmri numeric[] := array[5750,6250,6500,6750,7000,7250,7500,7750,8000,8250];
  opt_bmri numeric[] := array[6500,7200,8000,8800,9700,10700,11800,13000,14300,15700];
  base_wdc numeric[] := array[458,550,620,700,760,820,880,950,1020,1100];
  opt_wdc numeric[] := array[500,620,720,820,920,1040,1170,1320,1490,1680];
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if exists (select 1 from public.accounts where user_id = uid) then
    return jsonb_build_object('seeded', false, 'reason', 'data_exists');
  end if;

  insert into public.accounts (user_id,name,account_type,balance) values
    (uid,'Cash','Cash',3396235),(uid,'BCA','Bank',10234404),(uid,'GoPay','Wallet',284382),
    (uid,'ShopeePay','Wallet',40932),(uid,'SeaBank','Bank',52000);
  insert into public.transactions (user_id,transaction_type,amount,description,category,channel,transaction_date) values
    (uid,'expense',240000,'Internet bill','Essentials','Transfer','2026-08-06'),
    (uid,'expense',50000,'Grocery','Food','Offline','2026-08-06'),
    (uid,'expense',42000,'Coffee','Coffee','Grab','2026-08-05'),
    (uid,'income',500000,'Bonus sales','Others','Transfer','2026-08-05');
  insert into public.monthly_budgets (user_id,category,monthly_amount) values
    (uid,'Food',3000000),(uid,'Coffee',800000),(uid,'Electricity',2000000),(uid,'IPL',227500),
    (uid,'Internet',296667),(uid,'Needs',1800000),(uid,'Subscriptions',260000),(uid,'Others',1000000);
  insert into public.yearly_expenses (user_id,name,amount,payment_month,category) values
    (uid,'Annual Insurance',6000000,'December','Insurance'),(uid,'Vehicle Tax',2500000,'March','Tax');
  insert into public.planned_events (user_id,name,amount,event_date,category) values
    (uid,'Child Vaccine',1950000,'2027-07-01','Health'),(uid,'Domestic Holiday',12000000,'2027-12-01','Travel'),
    (uid,'Card Installment',1250000,'2026-09-10','Installment');
  insert into public.credit_facilities (id,user_id,source,limit_amount) values
    (card_id,uid,'Credit Card',10000000),(gopay_id,uid,'GoPayLater',3000000),(shopee_id,uid,'ShopeePayLater',5000000);
  insert into public.credit_items (user_id,facility_id,source,description,amount,due_date,is_paid) values
    (uid,card_id,'Credit Card','Game purchase',750000,'2026-08-26',false),
    (uid,gopay_id,'GoPayLater','Online order',420000,'2026-08-31',false),
    (uid,shopee_id,'ShopeePayLater','Household item',680000,'2026-09-25',false);
  insert into public.clients (user_id,name,monthly_retainer,paid_this_month,previous_outstanding,status) values
    (uid,'Getlook',4000000,2000000,0,'pending'),(uid,'Client B',2500000,1200000,500000,'pending'),
    (uid,'New Client C',1800000,0,0,'pending'),(uid,'Paused Client',2200000,0,0,'freeze');
  insert into public.stock_holdings (id,user_id,display_symbol,market,provider,provider_symbol,currency,quantity,avg_purchase_price,current_price,manual_current_price,price_source,price_status) values
    (bmri_id,uid,'BMRI','IDX','twelvedata','BMRI','IDR',10000,4200,6200,6200,'manual','manual'),
    (wdc_id,uid,'WDC','NASDAQ','finnhub','WDC','USD',2.8033875,358.77,405,405,'manual','manual');
  for y in 2027..2036 loop
    insert into public.stock_price_targets (user_id,holding_id,scenario,target_year,target_price) values
      (uid,bmri_id,'base',y,base_bmri[y-2026]),(uid,bmri_id,'optimistic',y,opt_bmri[y-2026]),
      (uid,wdc_id,'base',y,base_wdc[y-2026]),(uid,wdc_id,'optimistic',y,opt_wdc[y-2026]);
  end loop;
  insert into public.electricity_readings (user_id,reading_date,reading_time,remaining_kwh) values
    (uid,'2026-08-06','19:00',500),(uid,'2026-08-20','19:00',25);
  insert into public.app_settings (user_id,theme,base_mode,optimistic_mode,base_growth,optimistic_growth,usd_idr,rate_kwh,legacy_import_completed)
    values (uid,'dark','manual','manual',8,14,16250,1740,true) on conflict (user_id) do nothing;
  return jsonb_build_object('seeded', true);
end;
$$;

revoke all on function public.seed_cvfinance_mvp() from public, anon;
grant execute on function public.seed_cvfinance_mvp() to authenticated;
