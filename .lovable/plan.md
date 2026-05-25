
# Moment Intelligence + Digital Portfolio — Build Plan

## Doctrine (locked)

Moment turns effort into evidence, and evidence into the next move.

Five primary worlds: **Today · Plan · Coach · Portfolio · Path**.
Embedded surfaces: Review → Portfolio · Forge → Portfolio/Coach · Constellation → Path · Reflect → Portfolio/Today · Rescue → Today/Coach · Tasks → Today/Plan · Recap → Portfolio/Path.

Preserve the existing backend skeleton (MomentState, tasks, schedule_state, execution_feedback, reflections, rescue_signals, chat_messages, pursuit_model, forge_state, learning-portfolio, context-packet, next-best-task, decisive-move, week-plan, chat-coach, app-intelligence router). Nothing is deleted — it's wired together.

The reference zip (`moment-ai-today-export.zip`) supplies the exact shapes for signals/memory/portfolio/decisions; we use those as the starting implementation and then thread them into existing code.

---

## Phase 1 — Signal Ledger (the raw layer)

**Create** `src/lib/signals/types.ts` and `src/lib/signals/build-signal-ledger.ts` (per the zip's shape).

`MomentSignal` fields: `id, type, source, timestamp, related_task_id?, related_block_id?, related_memory_id?, related_goal_id?, value?, confidence, user_facing_meaning, downstream_consumers[]`.

Signal types covered: task_created/started/completed/rejected, feedback_added, block_missed/completed, plan_repaired, reflection_added, rescue_triggered, chat_friction_detected, forge_artifact_created, path_proof_completed, memory_saved, plan_overload_detected.

`buildSignalLedger(state)` returns `{ signals, summary: { total, last_7d, by_type, top_consumers } }` — pure, derived from MomentState. No new storage.

**Rule enforced in code review:** no signal is added unless at least one downstream surface reads it.

---

## Phase 2 — Moment Memory (the user model)

**Create** `src/lib/memory/types.ts` and `src/lib/memory/build-moment-memory.ts`.

`MomentMemory` shape (per zip): `task_profile`, `time_profile`, `learning_profile`, `goal_profile`, `emotional_execution_profile`, plus `recent_wins`, `recent_struggles`, `open_loops`, `review_gaps`, `current_patterns[]`.

Derived from: tasks (durations, categories), execution_feedback (rejection reasons, subject friction), schedule_state (missed/completed blocks → plan_reliability_score), constraints.energy_pattern (best/weak windows), pursuit_model (next_proof, bottleneck), reflections, rescue_signals, alignment.status, existing `detectFeedbackPatterns`.

Pure selector. No AI, no storage. Single source of truth used by every decision engine and edge function.

---

## Phase 3 — Evidence Vault (the portfolio data layer)

**Create** `src/lib/portfolio/types.ts` and `src/lib/portfolio/build-evidence-vault.ts`.

Entry union: `TaskProofEntry | LearningMemoryEntry | ForgeArtifactEntry | ReflectionEntry | RecoveryEntry | PatternEntry | MilestoneEntry | CapabilityEntry | WeeklyRecapEntry`.

`buildEvidenceVault(state)` returns `{ entries, this_week_proof, learning_memories, open_loops, review_queue, skills_forming, summary }`. Derived from completed tasks, reflections, forge_state.forge_signals, rescue_signals, detected patterns, pursuit_model.capability_clusters.

This **extends**, not replaces, the existing `buildLearningPortfolio` in `src/lib/ai/learning-portfolio.ts`. learning-portfolio stays for AI-prompt rendering (Core memory rule); evidence-vault is the structured frontend/decision model.

---

## Phase 4 — Decision Engines

**Create** `src/lib/decisions/`:

- `select-next-move.ts` — scores via existing `selectNextBestTask`, then applies deterministic adaptations from MomentMemory (shrinks task if `preferred_minutes + 15` exceeded OR `too_big` is a top rejection). Emits `{ task, why_it_matters, estimated_minutes, adaptation_applied, adaptation_note, confidence, proof_link }`.
- `adapt-next-move.ts` — applies feedback or memory pattern via existing `tuneTaskFromFeedback`.
- `select-plan-repair.ts` — overload score from missed blocks + upcoming minutes + alignment + plan_reliability + friction.
- `select-review-suggestion.ts` — derives review queue from vault gaps + last completed.
- `select-path-proof.ts` — translates pursuit_model into student-facing Path language (no jargon).

All deterministic. No AI calls. These are the Stage-1 rules layer of the intelligence roadmap.

---

## Phase 5 — Context Packet Upgrade

Extend `src/lib/ai/context-packet.ts` (and mirror in any edge-function renderers) to include:

```
snapshot.signal_ledger_summary   // from buildSignalLedger
snapshot.moment_memory           // from buildMomentMemory
snapshot.evidence_vault_summary  // counts + headline
snapshot.portfolio_recent_entries // last 10
snapshot.review_queue            // top 5
snapshot.path_proof              // from selectPathProof
snapshot.plan_pressure           // from selectPlanRepair
snapshot.current_patterns        // from MomentMemory
snapshot.recent_adaptations      // last 3 adaptation_notes
```

`learning_portfolio` stays as-is (Core memory rule preserved). app-intelligence, chat-coach, generate-plan all receive the upgraded packet automatically.

Add a brief renderer block (`renderMemoryAndVault`) into each edge function's system prompt assembly so the model can reference memory and evidence by name without re-teaching or duplicating completed work.

---

## Phase 6 — Navigation Collapse

Rewrite `src/components/app/AppShell.tsx` to 5 primary worlds:

```
Today    (sub: Today, Coach, Rescue)
Plan     (sub: Plan, Tasks, Forge)
Coach    — promoted from sub-tab to primary (also accessible inside Today)
Portfolio (sub: Portfolio, Review, Reflect)
Path     (sub: Path, Constellation)
```

Settings stays in the top-bar icon (kept). Social moves under Settings or a secondary tray (keeps existing routes alive). Old routes (`/app/mission`, `/app/chat`) redirect to new names but pages keep working.

User-facing renames only — file names stay where they reduce churn. `/app/mission` → label "Path" but route can remain; we add `/app/path` alias.

---

## Phase 7 — Portfolio Surface (the new primary)

**Create** `src/pages/app/Portfolio.tsx` + `src/lib/selectors/portfolio.ts` (per zip).

Sections, in order:
1. Hero — "Your evidence is growing." + vault.summary.headline
2. Stat grid — proof_this_week, memories_saved, artifacts_created, recoveries
3. This week's proof — TaskProofEntry list with goal link
4. Learning memories — key_lesson + confusion_gap
5. Review soon — from `selectReviewSuggestions` with "Save lesson" → Reflect
6. Skills forming — capability_clusters (emerging/developing) as chips
7. Open loops — high-priority pending tasks
8. Patterns noticed — from MomentMemory.current_patterns
9. Artifacts created — forge_signals → links to /app/forge
10. Recovery moments — rescue entries reframed positively

Language rules: never expose "pursuit ontology", "capability cluster", "evidence signal", "velocity", "audit". Use "proof", "memory", "what you finished", "what's forming".

---

## Phase 8 — Feed Portfolio + Memory into every surface

- **Today / Dashboard** — adopt the zip's Dashboard adaptation: Decisive Move card shows `adaptation_note` ("Next move adjusted. Sized for ~22 min blocks.") + a "why that mattered" retrospective card linking last completed task to workstream + next_proof. Inline DoneFeedback chips remain.
- **Plan** — surface `selectPlanRepair.pressure_message` as a calm banner with `repair_today / make_lighter / move_one_task` actions. Block tooltips show why a block was sized using `memory.task_profile.preferred_minutes`.
- **Coach (Chat)** — chat-coach edge function reads `moment_memory` + `evidence_vault_summary` from snapshot; system prompt explicitly tells it to reference portfolio entries by name and never re-teach saved lessons.
- **Review / Reflect** — "Save lesson" creates a `LearningMemoryEntry` (added to state.reflections with `accomplishment` + `friction_tags`); appears immediately in Portfolio.
- **Path (Mission)** — adopt `selectPathProof` output: hero_title, this_week_proof, next_milestone, evidence_collected list, bottleneck_human.
- **Forge** — `select-forge-suggestion` reads `memory.learning_profile.fragile_topics` + `vault.review_queue` and proposes "Generate a quiz from these gaps?".
- **Constellation** — render stars by entry type (proof / memory / milestone / recovery).

Every surface reads. No new writers added unless a consumer exists.

---

## Phase 9 — Pattern intelligence (Stage 2)

`MomentMemory.current_patterns` already exists via `detectFeedbackPatterns`. Add:

- subject-friction pattern (≥2 hard/too_big on same subject root)
- plan-reliability pattern (reliability < 50% for 3+ days)
- energy-timing pattern (missed blocks clustered in a window)
- avoidance pattern (same task skipped/snoozed ≥3 times)

Each pattern carries `{ message, confidence, suggested_adjustment, surface }` so the right tab can render it.

---

## Phase 10 — Stages 3–5 deferred

Personalisation profile, prediction, and learning engine / spaced review are sequenced post-v1 once real signal volume exists. The architecture (Ledger → Memory → Vault → Decisions) is built so these slot in without refactor.

---

## Acceptance criteria (build is done when all are true)

- `buildSignalLedger`, `buildMomentMemory`, `buildEvidenceVault` exist as pure selectors with unit-test-shaped outputs
- `buildContextPacket` includes ledger summary, memory, vault summary, review queue, path proof, plan pressure, patterns, recent adaptations
- Five primary tabs render (Today / Plan / Coach / Portfolio / Path); Settings icon preserved
- Portfolio renders all 10 sections from real state with no jargon
- Today shows `adaptation_note` after feedback and a "why that mattered" card after a completion
- Plan shows pressure banner when `selectPlanRepair.pressure_detected`
- Coach prompt references memory + portfolio (visible in chat replies as "I noticed…", "you already finished…")
- Path renders `selectPathProof` output
- Forge proposes artifacts from `fragile_topics` + `review_queue`
- Constellation distinguishes entry types
- Every `MomentSignal.type` has at least one consumer surface; lint check or comment-audit confirms this
- Build passes, existing routes still work, no preserved-architecture files deleted

---

## Technical notes

- Reference shapes live in `/tmp/mexport2/src/lib/{signals,memory,portfolio,decisions}/*` from the zip — copy these as the starting implementation, then adapt imports/types to match the live MomentState.
- Where the zip's types reference fields not present in current `src/lib/state/schema.ts` (`mission_history`, `block.status` vs `block_status`, `reflection.win`/`friction_tags`, `forge_signals.created_at`), prefer the existing field names and add optional new ones only when a consumer needs them.
- `learning-portfolio.ts` stays the AI-prompt portfolio renderer (Core memory rule); the new evidence-vault is its structural sibling for UI + decisions. They share data sources, not code.
- No DB schema changes required for Phase 1–8. The `moment_state.state` JSONB already persists everything we derive from. A migration is only needed if/when patterns/portfolio entries need server-side queries.

---

## Build order

1. Phases 1–4 (pure selectors, no UI changes) — landable independently, tested via existing pages.
2. Phase 5 (context packet) — single file, immediate AI quality lift.
3. Phase 6 (nav collapse) — visual reorg, no logic.
4. Phase 7 (Portfolio page) — the new primary surface.
5. Phase 8 (wire into Today/Plan/Coach/Path/Forge/Constellation) — surface by surface.
6. Phase 9 (extra patterns) — additive.

Ship after Phase 8. Phase 9 is a fast follow.
