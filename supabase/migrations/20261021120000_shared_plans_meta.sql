-- Plan metadata the live pages read: which programs the student is aiming for (College, McIntire, SDS).
-- Backup sections live in the cart items themselves ({ class_nbr, backup, replaces }).
alter table public.shared_plans add column if not exists meta jsonb not null default '{}'::jsonb;
