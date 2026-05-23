## Phases 1 + 2 only — Settings + Social Feed MVP

Ship the foundations needed before any real friend system. No auth, no cloud tables, no follower counts, no comments. All state lives in the existing local store so we don't half-build a social network.

---

### Naming change (project-wide)

Rename **Mote → Moment Star** in all user-facing copy. Component file `Mote.tsx` stays for now (internal name) but exports `MomentStar` as the primary symbol; `Mote` kept as deprecated alias to avoid breaking imports. Alt text, tooltips, and any visible string updated.

---

### Phase 1 — Settings / Profile

**Routes** (added to `App.tsx`, nested under `/app`):

```text
/app/settings              → SettingsShell (redirects to /profile)
/app/settings/profile
/app/settings/privacy
/app/settings/device
/app/settings/notifications
/app/settings/plus
/app/settings/safety
```

**Nav entry**: add a Settings gear icon to `AppShell` — desktop sidebar footer + mobile top-bar (keeps the 3-tab bottom nav untouched).

**State** (extend `src/lib/state/schema.ts` with one new top-level slice `settings`, all optional with defaults so existing local state stays valid):

```ts
settings: {
  profile: {
    display_name, username, bio, school_stage, subjects[],
    star_hue (number 0–360 for Moment Star tint)
  },
  privacy: {
    profile_visibility: 'private' | 'friends' | 'aligned',     // default private
    progress_visibility: 'private' | 'friends' | 'aligned',    // default private
    allow_friend_requests: boolean,                            // default true
    aligned_goal_discovery: boolean,                           // default false
    comments_mode: 'off' | 'friends'                           // default off
  },
  device: { mode: 'auto' | 'phone' | 'computer' },             // default auto
  notifications: {
    task_reminders, friend_checkins, streak_reminders,
    weekly_recap, forge_review_reminders                       // all booleans, default true
  }
}
```

Username validation (zod): 3–20 chars `[a-z0-9_]`, trimmed, lowercased. Display name: 1–40 chars. Bio: ≤160 chars. All edits dispatch existing store reducer (`settings/update` action added).

**Device-mode wiring**: extend the existing `surface` detection in `src/lib/ai/useAI.ts` — if `settings.device.mode !== 'auto'`, use it directly; otherwise fall back to `matchMedia`. Same helper exported as `getSurface()` and reused by `JourneyConstellation`'s `isMobile` toggle.

**Components**:
- `SettingsShell` — left rail on desktop, stacked sections on mobile
- `ProfileSettings`, `PrivacySettings`, `DeviceSettings`, `NotificationSettings`
- `PlusSettings` — static feature comparison (free vs Plus), single "Coming soon" CTA, no modal nags
- `SafetySettings` — Report a problem (mailto stub), Blocked accounts (empty state), Delete local data (calls existing `reset`), Privacy policy / Contact (placeholder links)

**Star appearance**: `Moment Star` placeholder section in profile shows the existing mascot with a hue slider (writes `star_hue`). Mascot component reads the hue and applies a CSS `filter: hue-rotate()`.

---

### Phase 2 — Social Feed MVP

**Route**: `/app/social` (added as a 4th sub-tab under the Today group, hidden on mobile bottom nav so we keep 3 primary tabs — accessed via the contextual sub-nav row).

**Data source — local only**:
- A new selector `selectProgressEvents(state)` derives events from existing state:
  - `task_completed` from tasks with `status: done`
  - `review_saved` from tasks with `note_review`
  - `lesson_learned` from learning portfolio entries
  - `plan_repaired` from plan history (if present, else skipped)
  - `streak_milestone` from existing streak counters at thresholds 3/7/14/30/100
  - `weekly_recap` synthesised from last 7 days at most once per week
- A small seed file `src/lib/social/sample-friends.ts` provides 3–5 demo friend events labelled clearly as "Demo" so the feed feels alive without faking real people. Demo events are visually marked with a subtle "Demo" tag and can be hidden via a toggle in Settings → Privacy.

**Components**:
- `SocialFeed` — single column on phone (max 5 cards + "Show more"), two-column on desktop (feed + right-rail with profile summary and Moment Star streak)
- `ProgressEventCard` — one variant per event type, supportive copy only. Title pattern: `{name} {verb} {object}`. Optional 1-line context. Timestamp as "2h", "yesterday".
- `ReactionBar` — 6 preset reactions (Nice, Still moving, Good reset, Big brain, Review saved, Keep going). Counts shown only when ≥1, capped display at 99+. Reactions stored locally per event id.
- `FeedEmptyState` — encourages first check-in with a single CTA

**Phone vs Computer mode** (driven by `getSurface()`):
- Phone: max 5 cards, no right rail, single CTA "Check in"
- Computer: full feed, right rail with profile + active streaks, no comments UI

**Hard exclusions for this release** (explicit so Lovable doesn't drift):
- ❌ No auth, no Supabase tables
- ❌ No follow / friend requests
- ❌ No public profiles / profile pages
- ❌ No open comments
- ❌ No follower counts, no leaderboard, no ranking
- ❌ No aligned-goal discovery UI (toggle in settings only)
- ❌ No communities
- ❌ No realtime
- ❌ No shame copy ("you broke", "you're behind", "don't let them down")

Streak-paused copy uses: "Reset, not ruined." and "Restart with one check-in."

---

### Safety defaults

- `profile_visibility` default **private**
- `progress_visibility` default **private**
- `aligned_goal_discovery` default **off**
- `comments_mode` default **off**
- Report + Block buttons visible on every feed card (open a placeholder sheet for now — wired in the friend-system phase)

---

### Acceptance criteria

1. `/app/settings/*` routes render with all six sections.
2. Profile edits (display name, username, bio, stage, subjects, star hue) persist in local state and survive reload.
3. Privacy controls toggle and persist; all default to the safe values above.
4. Device mode (Auto / Phone / Computer) overrides the existing `surface` detection used by AI calls and the constellation mobile toggle.
5. Notification preferences persist (no real notifications wired — preference storage only).
6. `/app/social` renders a progress feed built from existing local state plus 3–5 clearly-labelled demo cards.
7. Six preset reactions work and persist locally.
8. No follower counts, no comments box, no ranking anywhere.
9. Phone mode caps feed to 5 cards with one CTA; computer mode shows the wider layout.
10. "Moment Star" replaces "Mote" in all visible copy.
11. Existing app routes and behaviour are unchanged.
12. Build passes; no new console errors on `/app`, `/app/settings/*`, `/app/social`.

---

### Implementation order

1. Schema + store reducer for `settings` (with safe defaults + migration of existing local state)
2. Mote → Moment Star copy pass + hue-rotate prop
3. `SettingsShell` + six section pages
4. Device-mode wiring into `getSurface()`
5. `selectProgressEvents` selector + demo seed
6. `SocialFeed`, `ProgressEventCard`, `ReactionBar`
7. AppShell nav entries for Settings + Social
8. Phone/computer layout split, safety-copy audit, build check

---

### Technical notes

- All colours via existing semantic tokens; add `--star-hue` CSS variable for the mascot tint
- Reactions stored as `Record<eventId, ReactionKind[]>` in the new `settings` slice (cleared if exceeds 500 entries — simple LRU)
- Username uniqueness is a no-op at this stage (single-device) but the zod validator is in place for the future cloud migration
- No new edge functions, no new tables, no new secrets
- When the friend-system phase lands later, this slice migrates 1:1 to a `profiles` + `privacy_settings` Cloud table — same field names already chosen for that

Once you approve, I'll ship phases 1 + 2 only. Friends, aligned goals, comments, and communities stay deferred until you green-light Phase 3.