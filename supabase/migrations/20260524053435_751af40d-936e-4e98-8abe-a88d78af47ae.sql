
-- Comments on progress events
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.progress_events(id) on delete cascade,
  user_id uuid not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists comments_event_id_idx on public.comments(event_id, created_at desc);

alter table public.comments enable row level security;

create policy "comments read with event"
on public.comments for select
using (exists (select 1 from public.progress_events e where e.id = comments.event_id));

create policy "comments self insert"
on public.comments for insert
with check (auth.uid() = user_id);

create policy "comments self update"
on public.comments for update
using (auth.uid() = user_id);

create policy "comments self delete"
on public.comments for delete
using (auth.uid() = user_id);

create trigger comments_set_updated_at
before update on public.comments
for each row execute function public.set_updated_at();

-- Speed up @handle lookup
create index if not exists profiles_handle_lower_idx on public.profiles (lower(handle));
