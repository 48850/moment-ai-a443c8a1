# DECISIVE MEGA AUDIT — MOMENT LEARNING COPILOT, FORGE, EXAM, TRIALS, SIGNALS, PORTFOLIO, GOAL SYNTHESIS

> Audit date: 2026-06-02
> Branch: claude/lucid-johnson-dd305
> Evidence: 3 parallel Explore agents across full codebase; exact file paths and line numbers cited throughout.
> Status: Pre-build audit — no code changed.

---

## 1. EXECUTIVE VERDICT

**B — Working Moment-native system with critical surface rendering gaps.**

The state and logic layer is production-quality. All Zod schemas are real (`examQuestionSchema`, `momentTrialSchema`, `mistakeCardSchema`, `userGoalSchema` with role/horizon, `learningToolResultSchema`). All action types exist. The 1,500-line Zustand store has working handlers for every Trial, MistakeCard, and ExamQuestion action. Eleven selector files — including `goal-intelligence.ts` (7 functions, 27 tests), `feedback-intelligence.ts` (5 pure selectors + `buildEmotionalSnapshot`), and `question-helpers.ts` (`selectVisibleQuestionFields`) — are fully implemented and tested.

The critical failure: every piece of intelligence is computed but invisible to the user. `selectGoalSynthesis` runs inside `buildContextSnapshot()` but `synthesis_sentence` is never rendered in any JSX. `buildEmotionalSnapshot` is computed and sent to the AI but `CoachPanel` never shows the user any indication that tone has adapted. `SURFACE_CHIP_GROUPS` is defined in `labels.ts` (lines 75–107) but `FeedbackChips.tsx` has no `surface` prop — it uses `FEEDBACK_GROUPS` regardless of context. `DrillQuestion` correctly hides answers using `selectVisibleQuestionFields` but ends silently after rating with no Save/Repair/Next choices. `Learning Copilot` does not exist as a scoped inline model — zero files.

The remaining gap: `ForgeFeature.tsx` is a free AI text runner (`AIOutputDisplay` renders structured JSON) and is not Trial-aware. It dispatches no `trial/create`, no `trial/save_result`, no attempt gate.

This is not a broken system. It is an invisible one. The intelligence exists. The proof mechanisms exist. The user cannot reach them.

---

## 2. SYSTEM SCORECARD

| System | Score | Classification | Evidence files | Main risk | Decisive next action |
|--------|-------|----------------|----------------|-----------|----------------------|
| Coach (global) | 5/7 | KEEP | `CoachPanel.tsx` line 153: `chat-coach` function; `context-snapshot.ts` line 345: `buildEmotionalSnapshot` + line 346: `selectGoalSynthesis` | AI adapts tone silently; user never sees why | Phase 3: show 1-line tone note in CoachPanel |
| Learning Copilot (inline) | 0/7 | REBUILD SMALL | Zero files. No `LearningCopilotSession`, no session schema, no message model. Grep: no matches for `LearningCopilotSession` or `learning_copilot` in `src/` | Users routed to global Coach instead of scoped tutor | ExamMode Test Me IS the scoped flow — wire it; build session model only as smallest slice after |
| Forge (builder) | 5/7 | KEEP | `Forge.tsx` 1070 lines: `trial_brief` step (line 479), `trial/create` dispatch (line 491), `TrialBrief.tsx` (104 lines), `GuidebookPreview` step — real builder | ForgeFeature renders raw AI output, not structured modules | Phase 5: layer Trial runtime on ForgeFeature |
| Forge (feature runtime) | 2/7 | REBUILD SMALL | `ForgeFeature.tsx`: `useAI("forge_feature_ai")` (line 513); `AIOutputDisplay` (lines 271–300); no `trial/save_result` dispatch; no `selectVisibleQuestionFields` call | Free AI text, not a Trial experience | Layer Trial Brief → attempt gate → rating → MistakeCard (Phase 5) |
| Exam Copilot | 5/7 | PATCH | `ExamMode.tsx` lines 728–746: Test Me/Rate tabs with local React state; line 771: `DrillQuestion` rendered; lines 550–607: `exam_generate_questions` AI; lines 610–640: `exam_rate_answer` AI | `exam/set_copilot_mode` action unused — local state only | Wire dispatch instead of local state; low-priority polish |
| Trials | 6/7 | KEEP | `state-store.ts` lines 1420–1470: `trial/create` + `trial/save_result` handlers with attempt guard and MistakeCard idempotency; `trial-helpers.ts`: 5 exported functions | ForgeFeature bypasses Trial runtime | ForgeFeature Phase 5 |
| Answer hiding | 6/7 | KEEP | `question-helpers.ts` lines 23–42: `selectVisibleQuestionFields`; `DrillQuestion.tsx` line 33: uses it; `correct_answer` only rendered when `answered` (line 186) | ForgeFeature renders raw AI output without attempt gate | ForgeFeature Phase 5 |
| Feedback / Signals | 4/7 | PATCH | `labels.ts` lines 75–107: `SURFACE_CHIP_GROUPS` (4 surfaces defined); `FeedbackChips.tsx` props lines 16–27: no `surface` prop; uses `FEEDBACK_GROUPS` (line 52) | Context chips never appear; every surface shows generic fit/value/energy/tone chips | Phase 2: add `surface?` prop |
| EmotionalSnapshot | 5/7 | PATCH | `feedback-intelligence.ts`: `buildEmotionalSnapshot` exported; `context-snapshot.ts` line 345: called; 19 tests pass | Computed, sent to AI, never shown to user | Phase 3: 1-line italic note in CoachPanel |
| Goal synthesis | 4/7 | PATCH | `goal-intelligence.ts` lines 204–253: `selectGoalSynthesis` returns `GoalSynthesis` with `synthesis_sentence`; 27 tests pass; `context-snapshot.ts` line 346: called; `Dashboard.tsx` line 7: imports only `selectHomeViewModel` | `synthesis_sentence` never rendered in any JSX | Phase 1: 3 lines in Dashboard.tsx |
| Portfolio | 5/7 | PATCH | `Portfolio.tsx` lines 34–44: reads `moment_trials` + `mistake_cards`; `build-evidence-vault.ts` lines 180–207: both integrated; Best Proof + Before/After sections added | No smoke test; "Forge Trials" stat wired correctly | Verify with `npm run test`; no new code |
| Mistake Vault | 5/7 | KEEP | `state-store.ts` lines 1474–1498: `mistake/add` + `mistake/mark_reviewed` + `mistake/repair`; idempotency guard in `trial/save_result`; `build-evidence-vault.ts` lines 196–207 | No review-due surface; mistakes don't resurface | Due-date UI is next (not Phase 1–5) |
| Fun layer | 2/7 | PATCH | `StreakFlame.tsx` exists with `COMPLIMENTS` array and `streak:burst` event; no boss mode; no post-Trial completion events; no XP/unlock | No completion feedback after Trial | Phase 4: post-Trial CTA buttons (Save / Repair / Next) |
| AI reliability | 5/7 | KEEP | `safeParse` used throughout; `app-intelligence` function confirmed (`useAI.ts` line 36); `exam_generate_questions` + `exam_rate_answer` intents already wired; `AIOutputDisplay` renders structured output | ForgeFeature renders structured JSON — not raw markdown crash risk but not attempt-gated | Confirmed: no crash risk from malformed AI output |
| Tests | 7/7 | KEEP | 194 tests: goal-intelligence 27, feedback-intelligence 19, answer-hiding 21, trial-system 24, context-intelligence 35, exam-emergency 46, heartbeat 21, example 1 | Pre-existing failure: `exam-emergency.test.ts:527` `priority: "high"` receives `"medium"` — not introduced here | Do not regress |

---

## 3. SHELL RISK REGISTER

| # | Feature | Why it is shell | Exact evidence | Risk | Minimum fix |
|---|---------|----------------|----------------|------|-------------|
| 1 | Goal synthesis in UI | `selectGoalSynthesis` runs inside context-snapshot but never renders | `Dashboard.tsx` line 7: `import { selectHomeViewModel }` — zero imports from `goal-intelligence`; line 144: renders `vm.goalSnippet`. `context-snapshot.ts` line 346: `selectGoalSynthesis(state)` called but result only goes to AI system prompt | Student with 2 goals sees single goal snippet — no synthesis, no pressure badge, no primary arc | 3 lines in `Dashboard.tsx`: import + render `synthesis.synthesis_sentence` + render `synthesis.current_pressure` badge |
| 2 | SURFACE_CHIP_GROUPS | Defined correctly but never consumed | `labels.ts` lines 75–107: 4 surfaces (today_move, exam_question, forge_trial, coach_reply) — correct chip sets defined. `FeedbackChips.tsx` props lines 16–27: no `surface` prop; line 52: reads `FEEDBACK_GROUPS` only | Every feedback chip is generic fit/value/energy/tone regardless of context | Add `surface?: keyof typeof SURFACE_CHIP_GROUPS` to FeedbackChips; 10 lines |
| 3 | DrillQuestion ends silently | Rating appears, then nothing | `DrillQuestion.tsx` 219 lines: renders rating with `practice_estimate_label`, `missing_points`, `next_fix` — correct. Zero post-rating action buttons anywhere in file | Session dead-ends; user has no Save/Repair/Next choice | Add 3 optional callbacks: `onSaveProof`, `onRepair`, `onNext`; render 3 buttons after rating |
| 4 | EmotionalSnapshot invisible | Computed, sent to AI, never shown | `context-snapshot.ts` line 345: `buildEmotionalSnapshot(feedback)` runs; `CoachPanel.tsx` line 153: context sent to `chat-coach`; no JSX renders `inferred_state` or `support_style` anywhere in CoachPanel (505 lines) | AI adapts tone silently; user never sees why or builds trust in the system | `buildEmotionalSnapshot` call in CoachPanel component; 1-line italic note when `confidence >= 0.5` |
| 5 | Learning Copilot doesn't exist | Zero implementation | Grep: no `LearningCopilotSession`, `learning_copilot`, or session-scoped learning model in `src/`. No session schema, no message model, no inline copilot routing | Users always route to global Coach chat — no scoped tutor for exam topics, forge targets, path steps | ExamMode Test Me tab IS the scoped flow and already works; build session model only as smallest vertical slice when needed |
| 6 | ForgeFeature not Trial-aware | Free AI text runner | `ForgeFeature.tsx` line 513: `useAI("forge_feature_ai")`; lines 271–300: `AIOutputDisplay` renders structured JSON directly; no `trial/create` dispatch; no `trial/save_result`; no `selectVisibleQuestionFields` call | Every Forge run is a free AI exchange, not an attempt-gated Trial with proof | Layer Trial runtime: show target → gate answer reveal → dispatch `trial/save_result` on submit |
| 7 | `exam/set_copilot_mode` action unused | Local state used instead | `ExamMode.tsx` line 445: `const [copilotMode, setCopilotMode] = useState("plan")` — local React state. Action `exam/set_copilot_mode` exists in `actions.ts` and has a store handler in `state-store.ts` but is never dispatched from ExamMode | `copilot_mode` on `ExamEmergency` is always `undefined` in persisted state | Replace `setCopilotMode(id)` with `dispatch({ type: "exam/set_copilot_mode", ... })` — low-priority polish |

---

## 4. DUPLICATE ARCHITECTURE REGISTER

**Verdict: No accidental duplicates introduced. Single sources of truth confirmed.**

| Concept | Source of truth | What NOT to create |
|---------|----------------|-------------------|
| User-facing feedback | `state.execution_feedback` (array of `ExecutionFeedbackItem`) — `feedback/add` action — 27 FEEDBACK_OPTIONS | `moment_signals`, `MomentSignal` state field, `moment_signal/add` action. `signals/types.ts` is internal system telemetry — **DO NOT TOUCH** |
| Goals model | `state.goals[]` + `resolveGoals()` fallback to `active_goal` — `goal/add`, `goal/set_primary` actions | Parallel goal array, `GoalV2`, separate goal shape outside `userGoalSchema` |
| Exam questions | `examEmergencySchema.questions[]` using `examQuestionSchema` (`schema.ts` lines 392–405, 511) | Parallel question model outside emergencies |
| Forge outputs | `ForgeGuidebook` in `state.forge_guidebooks[]` | `GeneratedModuleManifest` / `ForgeModule` — legacy; `ForgeFeature.tsx` still references them and needs cleanup |
| Trial records | `state.moment_trials[]` — `momentTrialSchema` | No parallel trial field |
| AI edge function | `app-intelligence` (`useAI.ts` line 36) + `chat-coach` (CoachPanel line 153) | New Supabase endpoint — add intent strings only |
| Learning session model | **Does not exist yet** — ExamMode uses local React state for `copilotMode` | Full `LearningCopilotSession` with message/module arrays until ExamMode Test Me is working as vertical slice |

---

## 5. BENCHMARK TRANSLATION TABLE

| Feature | Benchmark pattern | Moment translation | Current code evidence | Missing architecture | Anti-shell test |
|---------|-------------------|-------------------|----------------------|---------------------|-----------------|
| **Proof Drill** | Anki: active recall — retrieve info before seeing answer | Hidden question → attempt → rating → MistakeCard → proof | `DrillQuestion.tsx` + `selectVisibleQuestionFields` + `examQuestionSchema.attempt` + `questionRatingSchema` | Post-Trial CTAs (Save/Repair/Next) | User submits answer; `correct_answer` not visible before; rating appears after; 3 action buttons shown |
| **Resource Forge** | NotebookLM: source → study material transformation | ForgeFeature: resource + guidebook → Trial Brief → structured modules | `ForgeFeature.tsx` + `ForgeGuidebook` + `TrialBrief.tsx` | Attempt gate; `trial/save_result` dispatch; answer hiding; module structure | User opens ForgeFeature; sees prompt target; submits attempt; rating dispatched to state |
| **Learning Copilot** | Khanmigo: guide don't give — scope to topic/exam | Inline scoped copilot for topic/exam/trial target; summary first, drill offered | ExamMode Test Me tab (lines 728–771) — closest working instance | Formal `LearningCopilotSession` model; non-Exam surfaces (Path step, Forge topic) | Student opens Exam → Test Me; scoped question appears; no route to global Chat |
| **Answer Upgrade** | Brilliant: attempt first, then explanation | Paste answer → AI rates → missing points → next fix | `ExamMode.tsx` line 613: `exam_rate_answer` intent; Rate tab wired | Rate tab UI polish; `exam/save_question_rating` dispatch | Student pastes answer in Rate tab; rating dispatched to state; practice estimate shown |
| **Oral Trial** | Roleplay simulation: turn-based scenario | AI scenario → user response → AI follow-up → final rating → proof | `momentTrialSchema.mode = "oral_trial"` exists; no UI | Turn-based conversation component; oral trial store handler | Not testable until scoped session component built |
| **Skill Simulation** | Applied skill practice: interview, debate, oral exam | Applied scenario → attempt → coaching → rating | `momentTrialSchema.mode = "skill_simulation"` exists; no UI | Same as Oral Trial | Same as Oral Trial |
| **Mistake Vault** | Anki spaced repetition: resurface weak knowledge over time | `MistakeCard.review_due_at` + `mistake/mark_reviewed` + repair loop | `state-store.ts` lines 1474–1498; `build-evidence-vault.ts` lines 196–207; 24 trial-system tests | Review-due surface (no UI shows due cards); repair flow | Repaired card appears in Portfolio Before/After; `status === "repaired"` confirmed |
| **Portfolio Proof Vault** | Codecademy project portfolio: show what you built | `buildEvidenceVault()` → proof receipts from tasks, exams, trials, repairs | `Portfolio.tsx` lines 34–44; `build-evidence-vault.ts` lines 180–207 | Smoke test; no automated end-to-end test for this path | `proof_saved` trial appears in Portfolio stat; repaired mistake appears in Before/After |
| **Fun layer** | Duolingo habit (Moment-native): real proof = real celebration | Post-Trial choices: Save Proof / Repair this / Next question; StreakFlame fires on completion | `StreakFlame.tsx` exists; `streak:burst` event; COMPLIMENTS array | Post-Trial CTA buttons; Trial completion → streak event | After rating appears, 3 action buttons visible; `streak:burst` fires on Save Proof |
| **Goal Synthesis** | Moment-native: primary arc + pressure = shared skill bridge | `synthesis_sentence`: "Maths exam trains structured argument — the same skill your Storytelling needs." | `goal-intelligence.ts` lines 204–253; 27 tests; `context-snapshot.ts` line 346 | Dashboard never imports it; no JSX renders it | Dashboard renders `synthesis.synthesis_sentence` when user has primary + pressure goals |

---

## 6. USER FLOW AUDIT

**Flow A: User says "I want to learn WWII"**
- Status: **BROKEN**
- Current: routes to global Coach chat (`CoachPanel.tsx` line 153: `chat-coach`)
- Broken step: no scoped Learning Copilot inline; no session opens for "WWII" topic; no summary → Trial offered
- Files: `CoachPanel.tsx`; no `LearningCopilotSession` model exists
- Minimum fix: ExamMode Test Me tab already covers this for exam topics — scope it there first. Full Learning Copilot session model is a larger build (after Phase 1–4).

**Flow B: User says "I have difficulty reading, summarise WWII"**
- Status: **PARTIAL**
- Current: Coach responds with full context-snapshot (goals, pressure, emotional state passed to AI) — AI may handle well
- Broken step: no explicit "direct need first" routing; AI may over-synthesise goals before helping
- Files: `CoachPanel.tsx`; `coach-response-schema.ts` (mode: "explain" exists); `context-snapshot.ts`
- Fix: coach response schema already supports `mode: "explain"` — ensure system prompt prioritises direct help over goal synthesis when user requests simplification

**Flow C: Forge creates exam tool**
- Status: **PARTIAL**
- Current: `Forge.tsx` line 479: `trial_brief` step shows `TrialBrief.tsx` before launch; `trial/create` dispatched (line 491); `TrialBrief.tsx` shows proof target + weakness hypothesis
- Broken step: after "Begin Trial" and guidebook activates, `ForgeFeature.tsx` opens — this is a free AI text runner; no attempt gate, no hidden-answer question cards, no `trial/save_result`
- Files: `ForgeFeature.tsx` lines 271–300 (AIOutputDisplay); `Forge.tsx` lines 479–491
- Fix: Phase 5 — layer attempt gate and `trial/save_result` dispatch into ForgeFeature

**Flow D: Exam Test Me**
- Status: **WORKING** (partially)
- Current: `ExamMode.tsx` line 728: Test Me tab exists; line 771: `DrillQuestion` rendered; `selectVisibleQuestionFields` enforces answer hiding; `correct_answer` guarded (line 186); question generation via AI (line 550)
- Incomplete: after rating appears, session ends silently — no Save/Repair/Next buttons; `exam/set_copilot_mode` not dispatched to state
- Files: `DrillQuestion.tsx` (no post-rating CTAs); `ExamMode.tsx` line 445 (local state only)
- Fix: add post-rating buttons to `DrillQuestion.tsx` (Phase 4)

**Flow E: User taps "confusing"**
- Status: **PARTIAL**
- Current: `feedback/add` fires; `execution_feedback` updated; `buildEmotionalSnapshot` computed on next context build; AI receives adapted instructions
- Broken steps: (1) chip shown is generic FEEDBACK_GROUPS, not `today_move` group (Easy/Hard/Avoided/Confusing); (2) CoachPanel doesn't show user any tone adaptation indicator; (3) next move doesn't visibly shrink — adaptation is invisible
- Files: `FeedbackChips.tsx` props (no `surface` prop); `labels.ts` SURFACE_CHIP_GROUPS line 75; `CoachPanel.tsx` (no `inferred_state` render)
- Fix: Phase 2 (surface prop) + Phase 3 (CoachPanel note)

**Flow F: History exam pressure + storytelling primary goal**
- Status: **BROKEN in UI** (working in logic)
- Current: `selectGoalSynthesis` returns correct synthesis: "History exam trains cause/effect — the same skills your Storytelling needs." This is computed in `buildContextSnapshot()` and sent to AI.
- Broken step: no JSX anywhere renders `synthesis.synthesis_sentence`, `synthesis.current_pressure`, or `synthesis.primary_arc` — user never sees the bridge
- Files: `Dashboard.tsx` line 7 (no goal-intelligence import); `goal-intelligence.ts` line 204 (working selector)
- Fix: Phase 1 (3 lines in Dashboard.tsx)

**Flow G: Portfolio after completed Trial**
- Status: **WORKING** (needs smoke test)
- Current: `Portfolio.tsx` lines 34–44 reads `moment_trials` (proof_saved) and `mistake_cards` (repaired); `build-evidence-vault.ts` lines 180–207 integrates both; Best Proof section + Before/After section present
- Incomplete: no automated end-to-end test for this path; "Forge Trials" stat wired correctly
- Files: `Portfolio.tsx`; `build-evidence-vault.ts`
- Fix: `npm run test` smoke test; no new code needed

---

## 7. DECISIVE BUILD PLAN

**Ordered by user-facing impact. All required logic already exists — these are wiring tasks.**

### Phase 1: Surface Goal Synthesis in Dashboard (1–2h)
**Only file to edit**: `src/pages/app/Dashboard.tsx`
**Do not touch**: `goal-intelligence.ts`, `state-store.ts`, any schema

Add after line 36 (`selectHomeViewModel` call):
```typescript
import { selectGoalSynthesis } from "@/lib/selectors/goal-intelligence";
const synthesis = selectGoalSynthesis(state);
```

In JSX, below existing goalSnippet render (line 144):
```tsx
{synthesis.synthesis_sentence && (
  <p className="text-sm text-muted-foreground mt-1">{synthesis.synthesis_sentence}</p>
)}
{synthesis.current_pressure && (
  <Badge variant="outline" className="mt-1">Pressure: {synthesis.current_pressure}</Badge>
)}
```

Acceptance: User with `goals[]` containing primary + pressure sees `synthesis_sentence` in Dashboard.

### Phase 2: Wire SURFACE_CHIP_GROUPS to FeedbackChips (1h)
**Only file to edit**: `src/components/app/FeedbackChips.tsx`
**Do not touch**: `labels.ts` (SURFACE_CHIP_GROUPS already correct)

Add to props interface: `surface?: keyof typeof SURFACE_CHIP_GROUPS`
When `surface` provided, chips = `SURFACE_CHIP_GROUPS[surface]`; otherwise fall back to existing `FEEDBACK_GROUPS` logic.

Callers to update: task completion UI → `surface="today_move"`; `DrillQuestion.tsx` after attempt → `surface="exam_question"`; `CoachPanel.tsx` after AI reply → `surface="coach_reply"`; `ForgeFeature.tsx` after AI → `surface="forge_trial"`.

Acceptance: After completing a task, chips show Easy / Hard / Avoided / Confusing / Felt good / Too long.

### Phase 3: EmotionalSnapshot tone note in CoachPanel (45 min)
**Only file to edit**: `src/components/app/coach/CoachPanel.tsx`
**Do not touch**: `feedback-intelligence.ts`, `context-snapshot.ts`

```typescript
import { buildEmotionalSnapshot } from "@/lib/selectors/feedback-intelligence";
const snapshot = buildEmotionalSnapshot(state.execution_feedback ?? []);
const toneNotes = {
  direct: "No fluff. Let's go.",
  gentle: "Keeping it calm today.",
  tiny_step: "One small thing.",
  celebrate_then_next: "Something worked. Keep going.",
};
const toneNote = snapshot.inferred_state !== "steady" && snapshot.confidence >= 0.5
  ? toneNotes[snapshot.support_style] : null;
```

In JSX before input: `{toneNote && <p className="text-xs italic text-muted-foreground">{toneNote}</p>}`

Acceptance: After 2+ "confusing" task feedback signals in 48h, CoachPanel shows "One small thing."

### Phase 4: Post-Trial CTAs in DrillQuestion (1h)
**Only file to edit**: `src/components/exam/DrillQuestion.tsx`
**Do not touch**: `selectVisibleQuestionFields` (correct), answer-hiding logic

Add optional callbacks to props: `onSaveProof?: () => void; onRepair?: () => void; onNext?: () => void;`

After rating renders (when `answered && visible.attempt?.rating`):
```tsx
<div className="flex gap-2 mt-4">
  <Button onClick={onSaveProof}>Save proof</Button>
  <Button variant="outline" onClick={onRepair}>I need to repair this</Button>
  <Button variant="ghost" onClick={onNext}>Next question</Button>
</div>
```

Language: "Practice estimate: Developing" — never "You scored X/Y".

Acceptance: After submitting answer and rating appears, 3 action buttons are visible.

### Phase 5: ForgeFeature Trial runtime (3–4h — defer until 1–4 confirmed)
**File to edit**: `src/pages/app/ForgeFeature.tsx`
**Risk**: Still references legacy `GeneratedModuleManifest`/`ForgeModule` — resolve naming first

- Read full file before touching
- Gate model output behind user attempt (like DrillQuestion gates `correct_answer`)
- On submit: dispatch `trial/save_result`; show `FeedbackChips surface="forge_trial"`
- Import `createTrialFromForge` from `src/lib/trial/trial-helpers.ts`

**Do not start Phase 5 until Phases 1–4 are browser-verified.**

### Phase 6: Regression tests for new wiring (1h)
**New file**: `src/test/ui-wiring.test.ts` — pure selector tests, no DOM renderer:
- `selectGoalSynthesis([primary, pressure])` → `synthesis_sentence` contains both titles
- `SURFACE_CHIP_GROUPS["today_move"]` includes "Easy" / "Hard" / "Avoided" / "Confusing"
- `buildEmotionalSnapshot([])` → `inferred_state: "steady"`, `confidence < 0.5`
- `buildEmotionalSnapshot([{feedback: "confusing"} x3 in 48h])` → `inferred_state !== "steady"`

---

## 8. STOP LIST

Do not build any of these during Phases 1–5:

1. **No `LearningCopilotSession` model** — ExamMode Test Me IS the scoped flow; wire it before any session model
2. **No `moment_signals` field** — `execution_feedback` is the source of truth; `signals/types.ts` is internal telemetry (DO NOT TOUCH)
3. **No Forge full rewrite** — ForgeFeature gets Trial runtime layered on top; builder (`Forge.tsx`) works
4. **No new Supabase function** — `app-intelligence` already has `exam_generate_questions` + `exam_rate_answer`; `chat-coach` handles Coach — add intent strings only
5. **No goal editor CRUD screen** — goals managed via `goal/add`, `goal/set_primary` dispatch; no UI editor needed yet
6. **No pursuit model changes** — `CompiledPursuitModel` / workstreams / capabilities are separate from the multi-goal model; do not merge
7. **No Portfolio redesign** — slot sections into existing layout; reading `moment_trials` + `mistake_cards` already wired
8. **No `active_goal` removal** — `resolveGoals()` bridges `active_goal` and `goals[]`; backward compat stays
9. **No Oral Trial or Skill Simulation UI** — `momentTrialSchema.mode` enum exists; UI waits until Phases 1–4 complete
10. **No manipulative gamification** — `StreakFlame.tsx` acceptable; no XP, badges, streak pressure, or boss mode until post-Trial CTAs work

---

## 9. TEST PLAN

### New file: `src/test/ui-wiring.test.ts`
Proves Phase 1 and Phase 2 at selector level (no DOM rendering required):
```
- selectGoalSynthesis with [primary, pressure] goals → synthesis_sentence contains both titles
- selectGoalAttentionBudget with active exam emergency → pressure >= 60
- SURFACE_CHIP_GROUPS["today_move"] keys match Easy/Hard/Avoided/Confusing/Felt good/Too long
- buildEmotionalSnapshot([]) → inferred_state: "steady", confidence < 0.5
- buildEmotionalSnapshot([confusing x3 within 48h]) → inferred_state !== "steady"
- buildEmotionalSnapshot([confusing x3]) → support_style "tiny_step" or "gentle"
```

### Existing files — do not regress:

| File | Tests | Pre-existing issues |
|------|-------|---------------------|
| `goal-intelligence.test.ts` | 27 | None — all passing |
| `feedback-intelligence.test.ts` | 19 | None |
| `answer-hiding.test.ts` | 21 | None |
| `trial-system.test.ts` | 24 | None |
| `context-intelligence.test.ts` | 35 | None |
| `exam-emergency.test.ts` | 46 | Line 527: `priority: "high"` receives `"medium"` — pre-existing; do not fix unless asked |
| `heartbeat.test.ts` | 21 | None |

**Total: 193 passing, 1 pre-existing failure.**

```bash
npx tsc --noEmit     # 0 errors required
npm run test         # 193+ passing; exam-emergency:527 is pre-existing
```

---

## 10. FINAL RECOMMENDATION

**B — Implement Phases 1–4 immediately.**

**Phase 1 (Dashboard goal synthesis)** is 5 lines of JSX. Zero new logic. All selectors have 27 passing tests. A student with "GCSE Maths exam" (pressure) + "Write a novel" (primary) will see "Maths exam trains structured argument — the same skill your Storytelling needs." instead of a single goal snippet. This is the most impactful single change in the codebase.

**Phase 2 (FeedbackChips surface prop)** is a 10-line prop addition. `SURFACE_CHIP_GROUPS` is already correct and defined. After completing a task, chips will show Easy / Hard / Avoided / Confusing / Felt good / Too long instead of generic fit/value/energy/tone groups. This makes the entire feedback intelligence system contextually meaningful.

**Phase 3 (CoachPanel tone note)** is 45 minutes. `buildEmotionalSnapshot` is fully implemented with 19 passing tests. After 2+ confusing task signals, the user will see "One small thing." before the coach input — the first visible sign that Moment is paying attention.

**Phase 4 (DrillQuestion post-Trial CTAs)** closes the Trial loop. DrillQuestion correctly hides answers and shows ratings. Adding 3 action buttons (Save proof / Repair this / Next question) turns a dead-ending component into a complete learning cycle.

**Phase 5 (ForgeFeature Trial runtime)** is the only high-effort phase (3–4h). It requires reading the full ForgeFeature file before touching and resolving the legacy `ForgeModule` naming. Defer until Phases 1–4 are browser-verified.

**Do not start Phase 5 until Phases 1–4 are confirmed working in the browser.**

---

## ARCHITECTURE RULES (NON-NEGOTIABLE)

- No new `moment_signals` field — `execution_feedback` is source of truth
- No Trial reaching `proof_saved` without `LearningToolResult` with non-empty `attempt_summary`
- No duplicate MistakeCards from same `source_trial_id` + `missing_points[0]`
- Answer hiding enforced by `selectVisibleQuestionFields` — not only by UI conditionals
- All AI output parsed with `safeParse`; malformed → local fallback; never crash
- No Portfolio proof from active/intake exams
- No user-facing bot/dev language (artifacts, signals, logs, AI summary, telemetry)
- Ratings always "Practice estimate" — never official marks
- TypeScript clean throughout
- `resolveGoals()` bridges `active_goal` and `goals[]` — no data migration needed
- `app-intelligence` is the only Supabase function for learning/forge/exam flows — add intent strings, never a new endpoint
