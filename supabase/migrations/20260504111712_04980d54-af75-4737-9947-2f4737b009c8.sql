create table if not exists public.moment_state (
  device_id text primary key,
  state jsonb not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

alter table public.moment_state enable row level security;

-- Single-local-user model: anyone with the device_id (kept in localStorage) can read/write their own row.
-- This is intentional for the no-auth phase. Tighten with auth later.
drop policy if exists "moment_state public read" on public.moment_state;
create policy "moment_state public read"
  on public.moment_state
  for select
  using (true);

drop policy if exists "moment_state public insert" on public.moment_state;
create policy "moment_state public insert"
  on public.moment_state
  for insert
  with check (true);

drop policy if exists "moment_state public update" on public.moment_state;
create policy "moment_state public update"
  on public.moment_state
  for update
  using (true)
  with check (true);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_moment_state_updated on public.moment_state;
create trigger trg_moment_state_updated
  before update on public.moment_state
  for each row execute function public.set_updated_at();