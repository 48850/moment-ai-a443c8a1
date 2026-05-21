# Experience Engine Shift

Two passes in one ship: (1) make every AI output end in a concrete action, and (2) build Forge's Context Video Studio with storyboard playback and ElevenLabs voiceover.

---

## Pass 1 — Retrofit AI surfaces with `next_action`

### Shared schema (new file)
`src/lib/ai/next-action.ts`
```ts
type NextAction =
  | { kind: "start_task"; task_id: string; label: string }
  | { kind: "break_down"; task_id: string; label: string }
  | { kind: "reform_plan"; label: string }
  | { kind: "schedule"; task_id?: string; when?: string; label: string }
  | { kind: "reflect"; prompt: string; label: string }
  | { kind: "open_node"; node_id: string; label: string }
  | { kind: "rescue"; label: string };
```

### System-prompt rule (added to all three edge functions)
> "Moment is an experience engine, not a content library. Never produce standalone lessons, tips, articles, or generic advice. Every response MUST end with one concrete `next_action` the user can tap right now. Educational text ≤ 2 sentences and always tied to the action. If you can't propose an action, propose a 3-minute launch step on the user's highest-priority pending task."

### Edge function changes
- `app-intelligence`: every freeform intent's response wrapper now requires `{ summary, next_action }`. Tool-schema intents get `next_action` appended to their output shape.
- `chat-coach`: assistant messages add a `next_action` chip rendered under the message bubble.
- `generate-plan`: each generated plan block carries `next_action`; the plan summary surfaces one top-level "Pick one" mission.

### Client renderer
`src/components/app/NextActionChip.tsx` — single tappable chip that dispatches to the right store action (start_task, break_down via `refine_user_task`, navigate to /rescue, /reflect, etc.). Wired into:
- `Chat.tsx` message bubbles
- `Plan.tsx` block cards
- `Tasks.tsx` AI insight cards
- `Mission.tsx` insight panel
- `QuickReviewNotes.tsx` review output

### Copy sweep
Replace static "Here's a guide / Here are tips" patterns in `Mission.tsx`, `Plan.tsx`, `Rescue.tsx`, `Reflect.tsx` headers/empty states with "Pick one:" / "Your next move:" / "Mission:" framing.

---

## Pass 2 — Forge: Context Video Studio

### New edge function
`supabase/functions/forge-context-video/index.ts`
- Input: `{ snapshot, format, tone? }` (snapshot = `buildContextPacket`)
- Calls Lovable AI Gateway (`google/gemini-3-flash-preview`) with structured output via `Output.object(zod schema)`:
```ts
{
  title, format, tone, hook,
  scenes: [{ scene_number, visual_prompt, voiceover, on_screen_text, duration_seconds, palette: { bg, fg, accent } }],
  caption,
  call_to_action: NextAction,
}
```
- Safety rule baked in: roast behaviour / avoidance / chaos only — never intelligence, body, identity, family, mental health, worth.
- Always returns 3–6 scenes, 3–8 seconds each.
- Re-uses portfolio + onboarding context. Refuses generic output (re-rolls if `call_to_action` missing).

### Second edge function
`supabase/functions/forge-video-voiceover/index.ts`
- Input: `{ scenes, voice_id? }` → loops scenes, calls ElevenLabs TTS (`eleven_turbo_v2_5`, default voice Charlie `IKne3meq5aSn9XLyUdCD`), returns `[{ scene_number, audio_base64 }]`.
- Stitches via `previous_text` / `next_text` for prosody continuity.
- Optional flag — UI can render storyboard silently first, fetch voiceover on "Play with voice".

### State
`src/lib/state/schema.ts` — add `forge_videos: ContextVideo[]` to `forge_state`, with `ContextVideo = { id, created_at, format, tone, title, scenes, caption, call_to_action, audio?: { scene_number, audio_base64 }[] }`.

### UI
- New page `src/pages/app/ForgeVideoStudio.tsx` (route `/app/forge/videos`).
- Studio shows 6 generator cards (live-context, no free-text prompt):
  - "Make a funny video about today" (pov)
  - "Roast my procrastination" (roast)
  - "Cinematic goal trailer" (trailer)
  - "Mission briefing for next block" (mission_briefing)
  - "Weekly recap" (recap)
  - "Constellation trailer" (trailer, constellation-focused)
- Each card calls `forge-context-video` with `format` + current snapshot.

### Player
`src/components/app/forge/StoryboardPlayer.tsx`
- Auto-advances through scenes using `useEffect` + `setTimeout(scene.duration_seconds * 1000)`.
- Each scene: full-bleed gradient using `scene.palette`, large kinetic on-screen text, voiceover text below.
- Optional generated image per scene later — v1 uses typography + animated gradients only (zero image-gen cost, instant render).
- Audio: if `forge-video-voiceover` was called, sequentially play `new Audio('data:audio/mpeg;base64,' + scene.audio_base64)` per scene; otherwise silent.
- Bottom: persistent `NextActionChip` from the video's `call_to_action`.
- Replay, regenerate, "with voiceover" toggle.

### Forge integration
- Add a "Video Studio" tile to `Forge.tsx` linking to `/app/forge/videos`.
- Latest 3 generated videos preview as thumbnails on Forge home.

---

## Secrets
`ELEVENLABS_API_KEY` — required for voiceover. Need to add via secrets tool before voiceover function will work. Studio + storyboard work without it (silent mode).

## Out of scope (deferred)
- Real MP4 rendering via Remotion.
- AI-generated images per scene (typography-only v1).
- Persistent storage of audio blobs beyond session (kept in moment_state until user explicitly saves).

## Files touched
**New:** `src/lib/ai/next-action.ts`, `src/components/app/NextActionChip.tsx`, `src/pages/app/ForgeVideoStudio.tsx`, `src/components/app/forge/StoryboardPlayer.tsx`, `supabase/functions/forge-context-video/index.ts`, `supabase/functions/forge-video-voiceover/index.ts`
**Edited:** `src/lib/state/schema.ts`, `src/App.tsx` (route), `src/pages/app/Forge.tsx`, `src/pages/app/Chat.tsx`, `src/pages/app/Plan.tsx`, `src/pages/app/Tasks.tsx`, `src/pages/app/Mission.tsx`, `src/components/app/QuickReviewNotes.tsx`, `supabase/functions/app-intelligence/index.ts`, `supabase/functions/chat-coach/index.ts`, `supabase/functions/generate-plan/index.ts`
