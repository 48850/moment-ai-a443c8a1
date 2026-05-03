# Moment · App Intelligence Spec

> A single working document that unifies **what the AI does**, **where it
> plugs in**, and **how every surface in the app reads from one shared brain**.
> Edit this file freely — it is the canonical source of truth for the
> intelligence layer. Keep it short, opinionated, and decision-oriented.

---

## 0. North Star

**One goal. One plan. One moment at a time.**

The app's job is to convert a teen's ambition into the *single next move* that
unmistakably advances it — and to keep that move honest as life shifts.

Intelligence ≠ chat. Intelligence = the **invisible layer** that:

1. Understands the goal at four horizons (days / weeks / months / years).
2. Picks the **decisive move** for *right now*.
3. Re-plans when reality changes (energy, time, feedback, drift).
4. Explains *why* every move matters — in one sentence.

---

## 1. The Brain (single source of truth)

All intelligence reads from and writes to one object: `MomentState`.

```
MomentState
├── profile               → who the user is, timezone, preferences
├── active_goal           → the locked goal (statement + why + reality_gap)
├── pursuit_model         → compiled: workstreams, capabilities, signals, risks
├── tasks                 → atomic units of work
├── schedule_state        → day_plan + plan A/B snapshots
├── execution_feedback    → how each completed task felt (easy / hard / vague…)
├── reflections           → end-of-day signal
├── alignment             → drift score + reasons
├── home                  → which plan is active
└── forge_state           → AI-compiled custom modules for this user
```

**Rule:** No surface (Today, Plan, Mission, Chat, Reflect, Rescue, Forge,
Audit) holds its own state. They are **pure projections** of `MomentState`
through *selectors*.

---

## 2. Intelligence Layers

The brain has four cooperating layers. Each layer has a clear input → output
contract and lives in a known folder.

| Layer | Folder | Input | Output | Trigger |
|---|---|---|---|---|
| **Compilers** | `src/lib/pursuit/`, `src/lib/forge/` | `active_goal` | `pursuit_model`, `forge_state.candidate_features` | goal change |
| **Engines** (deterministic) | `src/lib/engine/` | `MomentState` | `decisive_move`, `next_best_task`, `plan_ab`, `schedule_validator` | every render |
| **Selectors** | `src/lib/selectors/` | `MomentState` | view-models for each surface | every render |
| **AI Services** (probabilistic) | `supabase/functions/` | goal + context | structured plans, reframes, suggestions | user gesture |

**Hard rule:** UI never calls AI directly. UI calls a selector. A selector may
return a "needs AI" stub; the user clicks → action → edge function → patch
state → selectors recompute.

---

## 3. AI Services Catalog

All AI calls go through Lovable AI Gateway via edge functions. Default model:
`google/gemini-3-flash-preview`. Use structured output (tool calling) for
anything stored in state.

| # | Function | Purpose | Input | Output (stored at) | Model |
|---|---|---|---|---|---|
| 1 | `generate-plan` ✅ | Multi-horizon arc | goal, why, reality_gap | `aiPlan {days,weeks,months,years,principle}` (cached → `plan_state.horizons`) | flash |
| 2 | `next-move-rationale` ⏳ | One-sentence "why this matters now" | task, goal, recent_feedback | `tasks[id].why_now` | flash |
| 3 | `reframe-rescue` ⏳ | Turn a stuck/skipped task into a smaller next step | task, blocker_note | `tasks[id]` patch + new sub-task | flash |
| 4 | `daily-debrief` ⏳ | End-of-day reflection synthesis | today's tasks + feedback | `reflections[today]` | flash |
| 5 | `goal-audit` ⏳ | Drift detection + recommit prompt | goal, last 14d feedback, alignment | `alignment` patch + suggestions | pro |
| 6 | `forge-modules` ⏳ | Custom module proposals | pursuit_model + interview answers | `forge_state.candidate_features` | pro |
| 7 | `chat` ⏳ | Streaming coach with tool access | full convo + state snapshot | streamed tokens + tool calls that dispatch actions | flash |

Legend: ✅ shipped · ⏳ to build

---

## 4. The Decisive Move (the heart)

Every render computes **one** decisive move. Rules, in order:

1. If a task is `in_progress` and started <90 min ago → keep it.
2. Else: pick the highest-priority `pending` task whose
   `linked_workstream_id` matches the most-blocked workstream.
3. Tiebreak: shortest `estimated_minutes` (momentum > heroics).
4. AI enriches with `why_now` (rationale) — never picks the move itself.
5. After completion → trigger feedback capture → feeds `execution_feedback`
   → feeds engine on next render. Closed loop.

Lives in `src/lib/engine/decisive-move.ts`. AI only adds the *story*, not
the *choice*.

---

## 5. Surface Contracts (app unification)

Each surface gets exactly one selector and one set of allowed actions.
This is how the app stays coherent.

### Today (`/app`)
- **Selector:** `selectHomeViewModel`
- **Reads:** `decisive_move`, `tasks` (today only), `whyThisMattered`
- **Writes:** `task/complete`, `feedback/add`
- **AI hooks:** `next-move-rationale` (background), `reframe-rescue` (button)

### Plan (`/app/plan`)
- **Selector:** `selectPlanViewModel` + cached `aiPlan`
- **Reads:** `schedule_state`, `aiPlan.horizons[*]`
- **Writes:** `plan/reform`, `home/setPlan`
- **AI hooks:** `generate-plan` (Generate / Regenerate button)
- **Tabs:** Days / Weeks / Months / Years (single horizon visible at a time)

### Mission (`/app/mission`)
- **Selector:** `selectMissionViewModel`
- **Reads:** `active_goal`, `pursuit_model`
- **Writes:** `goal/set`, `goal/patch`, `pursuit/*`
- **AI hooks:** none synchronous; goal change triggers `compilePursuitModel`

### Chat (`/app/chat`)
- **Reads:** full state (read-only snapshot per turn)
- **Writes:** dispatches actions returned as tool calls from AI
- **AI hooks:** `chat` (streaming, tool-using)

### Reflect (`/app/reflect`)
- **AI hooks:** `daily-debrief`

### Rescue (`/app/rescue`)
- **AI hooks:** `reframe-rescue`

### Audit (`/app/audit`)
- **AI hooks:** `goal-audit`

### Forge (`/app/forge`)
- **AI hooks:** `forge-modules`

---

## 6. Feedback Loops (what makes it learn)

Three loops keep the brain honest. Without these, AI output decays into
generic productivity advice.

### Loop A · Move-level
`task/complete` → `execution_feedback` → next decisive-move pick reweights
priority by: easy=+1, valuable=+2, too_vague=−2, too_big=−1, not_relevant=−3.

### Loop B · Day-level
End of day → `daily-debrief` AI → `reflections[today]` → tomorrow's
`generate-plan` includes last 3 reflections in context.

### Loop C · Goal-level
Every 14 days OR on alignment.drift_score > 0.4 → `goal-audit` AI
→ proposes recommit / pivot / reduce-scope → user confirms → `goal/patch`.

---

## 7. Prompting Conventions

System prompts live **only** in edge functions. Never in the client.

Every AI prompt MUST include:
- The user's age bracket (teen) and tone (energising, never preachy).
- The active goal verbatim.
- The relevant slice of state (don't dump everything).
- Output contract (tool schema or explicit format).

Forbidden in prompts:
- "As an AI…", "I cannot…", corporate hedging.
- Generic productivity tropes (Pomodoro, SMART, eat-the-frog).
- Re-stating the user's input back to them.

---

## 8. Storage & Caching

- `MomentState` → localStorage via `src/lib/storage/local.ts` (today).
- AI outputs that are **expensive** + **stable per goal** → cached in
  localStorage keyed by goal hash (e.g. `moment.aiPlan.v1`).
- AI outputs that are **per-task** → written into `tasks[id]` so they
  survive re-renders and travel with the task.
- Long-term: migrate `MomentState` to Lovable Cloud table `moment_state`
  keyed by `user_id`, with edge functions doing reads server-side to keep
  prompts cheap.

---

## 9. Build Order (recommended)

1. ✅ `generate-plan` shipped → Plan tab is intelligent.
2. **`next-move-rationale`** → Today's decisive move gets a real "why now".
3. **`chat` streaming + tool calls** → conversational layer can mutate state.
4. **`reframe-rescue`** → Rescue tab becomes useful.
5. **`daily-debrief`** → Reflect tab closes Loop B.
6. **`goal-audit`** → Audit tab closes Loop C.
7. **`forge-modules`** → personalisation layer.

---

## 10. Open Questions (decide here)

- [ ] Do we persist `aiPlan` per-goal in Cloud, or keep it client-side?
- [ ] Chat: full state snapshot per turn, or RAG over last N events?
- [ ] When `goal-audit` recommends pivot, do we soft-suggest or block app
      until user responds?
- [ ] Should `next-move-rationale` run automatically on render (latency cost)
      or only when user taps the card?
- [ ] Single shared model, or escalate to `gemini-2.5-pro` for audits?

---

## 11. Non-Goals

- No notifications. No streaks. No XP. No leaderboards.
- No multi-goal juggling. Ever.
- No "AI assistant" framing — the AI is a quiet operator, not a character.

---

*Last edited: 2026-05-03 — keep this file under 300 lines.*
