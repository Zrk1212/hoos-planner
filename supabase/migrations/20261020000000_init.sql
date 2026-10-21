-- hoos-planner schema. Catalog tables are public-read (RLS select true), written only
-- by the service role from scripts/ (nightly sync). user_plans is per-user via RLS.

create table if not exists public.terms (
  code text primary key,                 -- SIS strm, e.g. '1272'
  name text not null,                    -- 'Spring 2027'
  start_date date,
  end_date date,
  q_a_start date, q_a_end date,          -- first 7-week half (Q1 fall / Q3 spring)
  q_b_start date, q_b_end date,          -- second half (Q2 / Q4)
  synced_at timestamptz,
  section_count integer default 0
);

create table if not exists public.sections (
  term text not null references public.terms(code) on delete cascade,
  class_nbr integer not null,
  crse_id text,
  crse_offer_nbr integer,
  subject text not null,
  catalog_nbr text not null,
  course text generated always as (subject || ' ' || catalog_nbr) stored,
  class_section text,
  descr text,
  topic text,
  component text,
  section_type text,
  units text,
  units_min numeric,
  units_max numeric,
  grading_basis text,
  acad_group text,
  acad_org text,
  acad_career text,
  campus text,
  location text,
  instruction_mode text,
  instruction_mode_descr text,
  session_code text,
  session_descr text,
  start_dt date,
  end_dt date,
  class_stat text,
  enrl_stat text,
  enrl_stat_descr text,
  class_capacity integer,
  enrollment_total integer,
  enrollment_available integer,
  wait_cap integer,
  wait_tot integer,
  combined_section text,
  schedule_print text,
  class_type text,
  rqmnt_designtn text,
  crse_attr text,
  crse_attr_value text,
  attrs text[] not null default '{}',   -- e.g. {ASUD-AIP, ASUR-R21C2}
  instructors jsonb not null default '[]'::jsonb,
  instructor_names text,
  meetings jsonb not null default '[]'::jsonb,  -- normalized, see lib/meetings.ts
  reserve_caps jsonb not null default '[]'::jsonb,
  icons jsonb not null default '[]'::jsonb,
  raw jsonb,
  source text not null default 'sis',   -- 'sis' | 'seed'
  updated_at timestamptz not null default now(),
  primary key (term, class_nbr)
);
create index if not exists sections_term_subject_idx on public.sections (term, subject);
create index if not exists sections_term_course_idx on public.sections (term, course);
create index if not exists sections_attrs_idx on public.sections using gin (attrs);

create table if not exists public.courseforum_ratings (
  id bigint generated always as identity primary key,
  course text not null,                  -- 'DS 1002'
  instructor text not null default '',   -- '' = course-level aggregate
  rating numeric,
  difficulty numeric,
  gpa numeric,
  last_term text,
  tcf_path text,
  fetched_at timestamptz not null default now(),
  unique (course, instructor)
);
create index if not exists courseforum_ratings_course_idx on public.courseforum_ratings (course);

create table if not exists public.sync_log (
  id bigint generated always as identity primary key,
  kind text not null,                    -- 'sis' | 'courseforum' | 'seed'
  term text,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  rows integer,
  requests integer,
  note text
);

create table if not exists public.user_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  term text not null,
  name text not null default 'My plan',
  profile jsonb,                         -- parsed audit (lib/audit-parser.ts Profile)
  cart jsonb not null default '[]'::jsonb,  -- [{class_nbr, role?}]
  filters jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, term, name)
);
create index if not exists user_plans_user_idx on public.user_plans (user_id);

-- RLS
alter table public.terms enable row level security;
alter table public.sections enable row level security;
alter table public.courseforum_ratings enable row level security;
alter table public.sync_log enable row level security;
alter table public.user_plans enable row level security;

create policy "terms public read" on public.terms for select to anon, authenticated using (true);
create policy "sections public read" on public.sections for select to anon, authenticated using (true);
create policy "ratings public read" on public.courseforum_ratings for select to anon, authenticated using (true);
create policy "sync_log public read" on public.sync_log for select to anon, authenticated using (true);

create policy "plans select own" on public.user_plans for select to authenticated using ((select auth.uid()) = user_id);
create policy "plans insert own" on public.user_plans for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "plans update own" on public.user_plans for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "plans delete own" on public.user_plans for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger user_plans_updated_at before update on public.user_plans
  for each row execute function public.set_updated_at();
