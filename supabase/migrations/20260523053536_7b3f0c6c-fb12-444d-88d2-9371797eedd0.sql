
-- ============ ENUMS ============
create type public.visibility_level as enum ('private','friends','aligned','public');
create type public.follow_status as enum ('pending','accepted');
create type public.event_kind as enum ('task_completed','review_saved','lesson_learned','plan_repaired','streak_milestone','weekly_recap','community_joined');
create type public.comments_mode as enum ('off','friends','mutuals');

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'New user',
  handle text unique,
  main_goal text,
  school_stage text,
  goal_tags text[] not null default '{}',
  subject_tags text[] not null default '{}',
  device_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_goal_tags_gin on public.profiles using gin(goal_tags);
create index profiles_subject_tags_gin on public.profiles using gin(subject_tags);

create table public.user_privacy (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_visibility public.visibility_level not null default 'private',
  progress_visibility public.visibility_level not null default 'friends',
  aligned_discovery_opt_in boolean not null default false,
  comments_mode public.comments_mode not null default 'friends',
  updated_at timestamptz not null default now()
);

create table public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  status public.follow_status not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_status on public.follows(followee_id, status);

create table public.progress_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.event_kind not null,
  title text not null,
  context text,
  goal_tags text[] not null default '{}',
  subject_tags text[] not null default '{}',
  visibility public.visibility_level not null default 'friends',
  source_key text,
  created_at timestamptz not null default now(),
  unique (user_id, kind, source_key)
);
create index progress_events_user_created on public.progress_events(user_id, created_at desc);
create index progress_events_goal_tags_gin on public.progress_events using gin(goal_tags);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.progress_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  created_at timestamptz not null default now(),
  unique (event_id, user_id, kind)
);
create index reactions_event_idx on public.reactions(event_id);

-- ============ HELPERS ============
create or replace function public.is_accepted_follower(_viewer uuid, _author uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.follows
    where follower_id = _viewer and followee_id = _author and status = 'accepted'
  );
$$;

create or replace function public.is_mutual(_a uuid, _b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.follows f1
    join public.follows f2 on f2.follower_id = f1.followee_id and f2.followee_id = f1.follower_id
    where f1.follower_id = _a and f1.followee_id = _b
      and f1.status = 'accepted' and f2.status = 'accepted'
  );
$$;

create or replace function public.shares_goal_tag(_viewer uuid, _author uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles pv, public.profiles pa
    where pv.id = _viewer and pa.id = _author
      and (pv.goal_tags && pa.goal_tags or pv.subject_tags && pa.subject_tags)
  );
$$;

create or replace function public.viewer_aligned_opt_in(_viewer uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select aligned_discovery_opt_in from public.user_privacy where user_id = _viewer), false);
$$;

-- updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger privacy_touch before update on public.user_privacy for each row execute function public.touch_updated_at();

-- auto-create profile + privacy on sign up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1), 'New user'))
  on conflict (id) do nothing;
  insert into public.user_privacy (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end; $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.user_privacy enable row level security;
alter table public.follows enable row level security;
alter table public.progress_events enable row level security;
alter table public.reactions enable row level security;

-- profiles
create policy "profiles self read" on public.profiles for select
  using (auth.uid() = id);
create policy "profiles public read" on public.profiles for select
  using (exists (select 1 from public.user_privacy up where up.user_id = profiles.id and up.profile_visibility = 'public'));
create policy "profiles mutuals read" on public.profiles for select
  using (public.is_mutual(auth.uid(), id));
create policy "profiles aligned read" on public.profiles for select
  using (
    exists (select 1 from public.user_privacy up where up.user_id = profiles.id and up.aligned_discovery_opt_in = true)
    and public.viewer_aligned_opt_in(auth.uid())
    and public.shares_goal_tag(auth.uid(), id)
  );
create policy "profiles self upsert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);

-- privacy
create policy "privacy self read" on public.user_privacy for select using (auth.uid() = user_id);
create policy "privacy self upsert" on public.user_privacy for insert with check (auth.uid() = user_id);
create policy "privacy self update" on public.user_privacy for update using (auth.uid() = user_id);

-- follows
create policy "follows self read" on public.follows for select
  using (auth.uid() = follower_id or auth.uid() = followee_id);
create policy "follows self insert" on public.follows for insert
  with check (auth.uid() = follower_id);
create policy "follows followee accept" on public.follows for update
  using (auth.uid() = followee_id) with check (auth.uid() = followee_id);
create policy "follows self delete" on public.follows for delete
  using (auth.uid() = follower_id or auth.uid() = followee_id);

-- progress events
create policy "events self read" on public.progress_events for select using (auth.uid() = user_id);
create policy "events public read" on public.progress_events for select using (visibility = 'public');
create policy "events friends read" on public.progress_events for select
  using (visibility = 'friends' and public.is_accepted_follower(auth.uid(), user_id));
create policy "events aligned read" on public.progress_events for select
  using (
    visibility = 'aligned'
    and public.viewer_aligned_opt_in(auth.uid())
    and public.shares_goal_tag(auth.uid(), user_id)
  );
create policy "events self insert" on public.progress_events for insert with check (auth.uid() = user_id);
create policy "events self update" on public.progress_events for update using (auth.uid() = user_id);
create policy "events self delete" on public.progress_events for delete using (auth.uid() = user_id);

-- reactions
create policy "reactions read with event" on public.reactions for select
  using (exists (select 1 from public.progress_events e where e.id = reactions.event_id));
create policy "reactions self insert" on public.reactions for insert with check (auth.uid() = user_id);
create policy "reactions self delete" on public.reactions for delete using (auth.uid() = user_id);
