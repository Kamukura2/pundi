do $$
declare table_name text;
begin
  foreach table_name in array array['accounts','transactions','monthly_budgets','yearly_expenses','planned_events','credit_facilities','credit_items','clients','stock_holdings','stock_price_targets','electricity_readings','app_settings']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I', table_name);
    end if;
  end loop;
end $$;
