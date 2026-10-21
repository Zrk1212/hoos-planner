-- Sign in with ChatGPT sessions for the in-site chat. The browser holds only a random session token in an
-- httpOnly cookie; this table keys rows by its SHA-256 and keeps the OpenAI tokens AES-256-GCM encrypted
-- (key in the server env, never in the database). Service role only: no anon/authenticated access at all.
create table if not exists public.chatgpt_sessions (
  id_hash text primary key,
  sub text not null,
  email text,
  enc_access text not null,
  enc_refresh text,
  access_expires_at timestamptz not null,
  model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);

alter table public.chatgpt_sessions enable row level security;
revoke all on public.chatgpt_sessions from anon, authenticated;

create trigger chatgpt_sessions_updated_at before update on public.chatgpt_sessions
  for each row execute function public.set_updated_at();

create index if not exists chatgpt_sessions_last_used on public.chatgpt_sessions (last_used_at);

select public.assert_rls_enabled();
