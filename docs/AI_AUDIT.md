# AI Persistence Audit

Snapshot of every place the app calls an AI surface, what comes back, and whether the result actually survives a reload.

All non-chat AI calls go through `app-intelligence` via `useAI(intent)` (or a direct `supabase.functions.invoke("app-intelligence", …)` for two outliers). Chat goes through `chat-coach`. Plan generation goes through `generate-plan`.

## Call sites → persistence

| Intent | Call site | What's returned | Persisted? | Field on state | Gap |
|---|---|---|---|---|---|
| `next_move_rationale` | `src/pages/app/Dashboard.tsx:80` | `{ why_now, next_proof }` | ❌ | — | Component-local `useState` only. Lost on reload. |
| `reframe_rescue` | (registered, not currently called) | `{ reframed_title, micro_steps, gentle_note }` | n/a | — | Dead intent — either wire it up or drop it. |
| `daily_debrief` | `src/pages/app/Reflect.tsx:24` | `{ headline, win, friction, tomorrow_intention }` | ❌ | — | Reflect renders it but never writes to `state.reflections`. User loses today's debrief on refresh. |
| `goal_audit` | `src/pages/app/Audit.tsx:14` | `{ drift_score, status, reasons, recommendation }` | ❌ | — | Audit verdicts are read-only in UI; history not kept. |
| `forge_modules` | (registered, not currently called) | `{ modules[] }` | n/a | — | Dead intent. |
| `forge_guidebook` | `src/pages/app/Forge.tsx:330` + `src/lib/forge/guidebook.ts:651` | Full feature spec | ✅ | `forge_state.active_tools / drafts` | OK. |
| `forge_guidebook_candidates` | `src/pages/app/Forge.tsx:404` | `{ candidates[] }` | ⚠️ Partially | Only chosen candidate is compiled. | Rejected candidates discarded — fine. |
| `forge_feature_ai` | `engines.tsx` (×4), `ForgeFeature.tsx` (×2) | Run-time output per feature | ✅ | `forge_state.signals / runs` via `forge/log_signal` | OK. |
| `rescue_protocol` | `src/pages/app/Rescue.tsx:59` | `{ title, steps, soft_note }` | ❌ | — | Steps shown then forgotten — no log, no link to a task. |
| `suggest_tasks` | `src/pages/app/Tasks.tsx:51` | `{ tasks[] }` | ⚠️ Per-click | Only when user hits `+` → `task/add` | Unselected suggestions vanish (acceptable — they're proposals). |
| `reflect_summary` | (registered, not currently called) | `{ pattern, encouragement }` | n/a | — | Dead intent. |
| `mission_insight` | `src/pages/app/Mission.tsx:257` | `{ observation, suggestion }` | ❌ | — | Re-rendered fresh every reload; insight history not kept. |
| `plan_reform` | `src/pages/app/Plan.tsx:269` | `{ explanation, key_adjustments, focus_suggestion }` | ✅ | `schedule_state.reform_note` (+ `day_plan_a_snapshot`) | `key_adjustments` is **not** stored — only `explanation` is. Minor gap. |
| `refine_user_task` (new) | `src/pages/app/Tasks.tsx` (manual add) | `{ refined_title, why_now, proof_of_completion, estimated_minutes, priority, category }` | ✅ | `tasks[*]` via `task/update` | OK. |
| Chat reply | `src/pages/app/Chat.tsx:304` | Streamed message | ✅ | `chat_state.messages` | OK. |
| `generate-plan` | `src/pages/app/Plan.tsx:368` | `{ days, weeks, months, years }` | ✅ | `localStorage` key (cached per goal) | Not in `MomentState`. Fine for cache, but a fresh device won't see it. |
| `mission/snapshot` (dispatched) | `Mission.tsx:270` | daily analytics snapshot | ✅ | `mission_history[]` | Was snapshotting even with zero data — fixed (skip when `totalTasks===0`). |

## Recommended follow-ups (not done in this pass)

1. **Persist `daily_debrief`** into `state.reflections` keyed by date so Reflect has continuity.
2. **Persist `mission_insight`** into `state.mission_history[last].insight` so the page can show "Last read".
3. **Store `plan_reform.key_adjustments`** alongside `reform_note`.
4. **Drop dead intents** (`reframe_rescue`, `forge_modules`, `reflect_summary`) from `app-intelligence/index.ts` or wire them up — they're currently registered but never invoked.
5. **`rescue_protocol`** — either log the protocol against the task that triggered it or remove it.
6. **`generate-plan`** uses `localStorage` only. If the user wants cross-device sync this should move into `MomentState`.

## Architectural notes

- Every AI call already routes through `buildContextPacket(state)` (verified in `useAI.ts:31`, `Chat.tsx`, `Plan.tsx`, `Forge.tsx`). The core memory rule is satisfied.
- Default model is `google/gemini-3-flash-preview` via Lovable AI Gateway.
- No raw `fetch` to model providers — everything goes through the three edge functions.
