## Goal

Make Tasks, Plan/Constellation, and Mission show only real, user-grounded data, and document what the AI layer actually persists.

---

## 1. Tasks page — strip the noise

- Remove `<GitHubBranchStatus />` (dev-only forge branch widget) and its import.
- Remove the "forge" pill branch (`byForge`, `forge_feature_id` check, `Zap` tag).
- Remove the **Missed** filter chip and the missed bucket. Tasks past due stay in `pending` (no special tab, no amber badge).
- Filters become: `all | pending | completed`.

## 2. User-added tasks → AI refinement

- Keep the manual composer.
- After `addManual`, fire-and-forget call to `app-intelligence` with a new intent **`refine_user_task`**:
  - input: `{ raw_title, estimated_minutes, goal, current_stage }`
  - output: `{ refined_title, why_now, proof_of_completion, estimated_minutes, priority, category }`
- On result, `dispatch({ type: "task/update", payload: { id, changes } })` so the task gets clearer wording, a proof, and a "why now" — synced with the goal/plan.
- Show a subtle "refining…" shimmer on the row while pending; silent fallback on error (task stays as user typed it).
- Register the intent in `app-intelligence/index.ts` `tools()`.

## 3. Constellation actually syncs with the plan

Current state: `Constellation` on Plan reads `vm.scheduleBlocks` which is `day_plan` — that part is fine. The drift is:
- `WeekConstellation` (the bar chart) reads only `tasks.completed_at` and ignores `schedule_state.week_plan`. Rename/rework it to read the actual `week_plan` blocks per day so the weeks horizon reflects the same source as `WeeklyGrid`.
- `Constellation` sequential links auto-chain every block, even unrelated ones — change to only link blocks that share `linked_task_ids` or are sequential in time on the same day.

## 4. Mission — stop inventing data

Audit findings to fix:
- `MattersCard` shows `ws.bottleneck` and `ws.next_proof` even when empty by falling back to `"Address bottleneck: …"` or `"Complete one proof task in {name}"` — that's the "assuming random stuff". Change: if no real bottleneck/next_proof, render an empty-state CTA ("Define this in Chat") instead of a synthetic action.
- `STAGE_BRIEF` currently always falls back to `"Foundation"` copy when stage is unknown — change to render no brief instead of a fake one.
- Stop creating `mission/snapshot` entries when `analytics.totalTasks === 0` (right now it snapshots zero-state daily, polluting history).
- `topProofWs` / `nextProof`: only render the `NextProofCard` if the proof string was authored (skip the synthetic empty state's hardcoded sentences).

## 5. AI persistence audit (delivered as `docs/AI_AUDIT.md`)

I'll grep every `useAI(...)`, `supabase.functions.invoke(...)` and `dispatch(...)` call and produce a table:

| Intent | Trigger | Saved to state? | Field | Gap |
|---|---|---|---|---|

Known suspected gaps to verify and document:
- `suggest_tasks` results — only saved if user clicks `+`; the unselected suggestions vanish.
- `mission_insight` — rendered in `AIInsight`, never persisted; lost on reload.
- `plan_reform` explanation — saved to `reform_note` ✓.
- `refine_task` / new `refine_user_task` — needs `dispatch` to persist or it's wasted.
- `daily_debrief`, `reflect_summary` — check if Reflect page persists.
- `forge_*` intents — check Forge state writes.

The audit file ends with a short "fixes recommended" list.

## Technical notes

- New intent `refine_user_task` schema:
  ```ts
  {
    refined_title: string,
    why_now: string,
    proof_of_completion: string,
    estimated_minutes: number,
    priority: "high"|"medium"|"low",
    category: "goal_direct"|"bottleneck_removal"|"discovery"|"maintenance",
  }
  ```
- All AI calls keep going through `buildContextPacket(state)` per the core memory rule.
- No schema/migration changes — `task/update` already exists.

## Out of scope (call out if relevant later)

- Rewriting the Forge page itself.
- Changing how `pursuit_model` is generated.
- Auth/RLS changes.
