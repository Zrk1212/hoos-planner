-- RLS guard. (a) RLS on every public table, (c) catalog tables are read-only to anon/authenticated,
-- sync_log is service-role only (the app never reads it client-side), (d) assert_rls_enabled() fails the
-- migration (and scripts/check-rls.ts) if any public table lacks RLS.

do $$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
           where n.nspname = 'public' and c.relkind in ('r','p') loop
    execute format('alter table public.%I enable row level security', r.relname);
  end loop;
end $$;

revoke insert, update, delete, truncate on public.terms, public.sections, public.courseforum_ratings, public.sync_log from anon, authenticated;

-- sync_log is internal bookkeeping: drop the public read policy and the grant.
drop policy if exists "sync_log public read" on public.sync_log;
revoke all on public.sync_log from anon, authenticated;

create or replace function public.assert_rls_enabled() returns void
language plpgsql security definer set search_path = '' as $$
declare missing text;
begin
  select string_agg(c.relname, ', ') into missing
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r','p') and not c.relrowsecurity;
  if missing is not null then
    raise exception 'RLS disabled on public tables: %', missing;
  end if;
end $$;

revoke all on function public.assert_rls_enabled() from public, anon, authenticated;
grant execute on function public.assert_rls_enabled() to service_role;

select public.assert_rls_enabled();
