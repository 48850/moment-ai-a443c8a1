# Real Social Graph — Phase 1 (this pass)

Goal: replace the demo-only Social feed with a real backend-driven social graph. Two tabs (Friends, Aligned), real progress events, opt-in aligned discovery, safe privacy defaults. Sample/demo users only render as an empty-state placeholder when the viewer has zero connections.

## Scope of this pass

In:
1. Backend tables + RLS for `profiles`, `follows`, `progress_events`, `goal_tags` (array on profile), `user_privacy`, `reactions`.
2. Sign-in linkage: each device's existing `moment_state` keeps working, plus a lightweight account row (anon-user keyed by `auth.uid()`) used for the social graph. Auth via Lovable Cloud email + password (no Google in this pass to keep small).
3. Auto-emit `progress_events` when: task completed, plan repaired, streak milestone, weekly recap, Forge review saved.
4. Social tab rewrite:
   - Friends / Aligned tab toggle
   - Real feed from `progress_events` filtered by follow graph (Friends) or shared goal tags + opt-in (Aligned)
   - Aligned people suggestions module
   - Follow button (request → accept)
   - Preset reactions persisted to `reactions`
   - Empty states that invite connection (no fake feed)
5. Privacy settings page wired to `user_privacy` (profile visibility, progress visibility, aligned discovery, comments).

Out (later phases):
- Comments threads, friend streaks computed server-side, goal communities/rooms, invite links, weekly recap generator, reports/blocks UI, Google OAuth.

## Data model

```text
profiles            id=uid, display_name, handle, main_goal, school_stage, goal_tags text[], subject_tags text[]
user_privacy        user_id, profile_visibility, progress_visibility, aligned_discovery_opt_in, comments_mode
follows             follower_id, followee_id, status (pending|accepted), created_at
progress_events     id, user_id, kind, title, context, goal_tags text[], subject_tags text[], visibility (private|friends|aligned|public), created_at
reactions           id, event_id, user_id, kind, created_at  (unique per event+user+kind)
```

RLS rules (high level):
- `profiles`: SELECT allowed if own row OR `profile_visibility='public'` OR (visibility='friends' AND mutual follow).
- `progress_events`: SELECT allowed if own OR (`visibility='friends'` AND viewer is accepted follower of author) OR (`visibility='aligned'` AND viewer shares ≥1 goal_tag AND viewer has `aligned_discovery_opt_in=true`) OR `visibility='public'`.
- `follows`: SELECT own rows; INSERT own follower_id; UPDATE only followee can flip pending→accepted.
- `reactions`: SELECT if can read parent event; INSERT own.

Helpers as SECURITY DEFINER SQL functions: `public.is_accepted_follower(viewer, author)`, `public.shares_goal_tag(viewer, author)`.

## Event emission

Client-side hook `useEmitProgressEvent()` writes a row whenever `state-store` records:
- task done → `task_completed`
- plan repaired note → `plan_repaired`
- streak threshold crossed → `streak_milestone`
- Forge review save → `review_saved`

Idempotency: dedupe key (`user_id + kind + source_id`) stored in event row to avoid double inserts.

## UI

`src/pages/app/Social.tsx`:
- Hero (kept) — counts driven by real `progress_events` from today.
- Tabs: Friends | Aligned (URL-synced).
- Friends feed: events from accepted follows (own + theirs).
- Aligned feed: events where `visibility in ('aligned','public')` AND author shares ≥1 of my goal_tags; requires my own `aligned_discovery_opt_in=true` (otherwise show opt-in CTA panel).
- Aligned People module: top 5 candidates by tag overlap with [Follow] / [Requested] button.
- Empty state: clear "no friends yet — find aligned people / invite friend / open discovery settings".
- `DEMO_FRIEND_EVENTS` only render as an example strip when both feeds are empty AND user is in the first-run state, clearly labelled "example".

`src/pages/app/settings/PrivacySettings.tsx`:
- Bind toggles to `user_privacy` table.
- Defaults: profile=private, progress=friends, aligned_discovery=off, comments=friends.

## Files

New:
- `src/lib/social/api.ts` — typed queries (feeds, follows, reactions, aligned people).
- `src/hooks/use-progress-emitter.ts` — listens to state-store, inserts events.
- `src/hooks/use-social-feed.ts` — fetches Friends/Aligned feeds with realtime subscribe.
- `src/components/app/social/AlignedPeople.tsx`
- `src/components/app/social/FollowButton.tsx`
- `src/components/app/social/EmptyConnections.tsx`

Edited:
- `src/pages/app/Social.tsx` — wire to real data, add tabs.
- `src/components/app/social/ProgressEventCard.tsx` — accept real-row shape; reactions persist.
- `src/components/app/social/ReactionBar.tsx` — call `reactions` table.
- `src/pages/app/settings/PrivacySettings.tsx` — bind to `user_privacy`.
- `src/App.tsx` — ensure auth route gates Social (anonymous viewers see sign-in CTA).
- `src/stores/settings-store.ts` — keep local mirror, sync to `user_privacy`.

## Migration (single call, includes RLS + helpers)

Creates the 5 tables above, enables RLS, adds helper functions, indexes on `progress_events(user_id, created_at)`, `follows(follower_id,status)`, `profiles(goal_tags gin)`.

## Acceptance

1. Two users (separate browsers) can follow each other; accepted follow makes events visible in Friends feed.
2. Aligned tab is empty until viewer toggles discovery on; then shows opted-in users with overlapping tags.
3. Completing a task in-app creates a `progress_events` row and surfaces in Friends feed for followers.
4. Privacy defaults are safe; nothing public unless user opts in.
5. Demo users only appear as labelled "example" in fully-empty state.
6. No leaderboards, no follower counts, no shame copy.
7. Build passes.

## Asking before I ship

This pass needs auth. Two questions:

1. **Auth method for this pass** — email+password only (fastest), or also enable Google OAuth?
2. **Existing local users** — do you want their current `moment_state` (device-keyed) to auto-migrate to their account on first sign-in, or keep them separate until they explicitly link?

Confirm those and I'll run the migration and ship.
