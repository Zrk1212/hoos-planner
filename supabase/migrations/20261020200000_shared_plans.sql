-- Plans addressed by a random code so an MCP client (claude.ai, Claude Code) can save and reload
-- a profile + cart across conversations without an account. Service-role only: no RLS policies
-- are granted to anon/authenticated, so the public API cannot enumerate codes.
create table if not exists public.shared_plans (
  code text primary key,
  term text not null,
  profile jsonb,
  cart jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.shared_plans enable row level security;
create trigger shared_plans_updated_at before update on public.shared_plans
  for each row execute function public.set_updated_at();
