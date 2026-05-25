# Coach Centralization — Relational Intelligence Upgrade

Transform Chat from a tab-bound bot into **Moment Coach**: the warm, situationally-aware voice of the intelligence machine, accessible from every surface with real actions.

## What we're building

### 1. Coach Kernel (`src/lib/coach/`)
New files — pure, deterministic where possible:

- **`build-coach-context.ts`** — unified `CoachContext` packet (goal, today, plan, portfolio, feedback, emotional state, chat history, permissions). Wraps `buildContextPacket` + adds emotional inference + permissions.
- **`infer-execution-state.ts`** — derives practical state (`steady | stuck | overloaded | drifting | recovering | confused | low_confidence | avoidant | proud | frustrated`) from signals (missed tasks, rejections, feedback labels, rescue use, chat language, plan pressure). Returns `{state, confidence, evidence[]}`.
- **`select-coach-tone.ts`** — maps inferred state → tone rules (overloaded→simplify, stuck→shrink, drifting→reconnect, etc.).
- **`select-coach-actions.ts`** — picks max 3 contextual actions based on surface + state + task/plan signals. Returns typed `CoachAction[]`.
- **`coach-action-types.ts`** — discriminated union of executable actions: `task.create | task.update | task.split | task.mark_done | plan.repair_today | plan.reschedule_task | review.create_memory | forge.create_artifact | rescue.trigger`.
- **`coach-response-schema.ts`** — Zod schema for structured `CoachResponse` (mode, reply, inferred_state, evidence_used, next_move, suggested_actions, memory_to_save, follow_up_question).
- **`coach-system-prompt.ts`** — the relational doctrine: warmth + memory + logic + action, tone-by-state rules, friend-like behavior, ethical boundaries (no dependency-creating language, encourage real-world support when distressed), forbidden phrases, response shape (mirror → evidence → interpretation → next move → action).

### 2. Edge function upgrade (`supabase/functions/chat-coach/index.ts`)
- Accept full `CoachContext` from client.
- Use structured output (Lovable AI Gateway, `google/gemini-3-flash-preview`) with `CoachResponse` schema.
- System prompt = `coach-system-prompt.ts` + context-rendered packet (goal, state inference, evidence, recent chat).
- Guardrail: filter out repeated-onboarding questions if answer exists in context.

### 3. Coach action executor (`src/lib/coach/execute-coach-action.ts`)
- Client-side dispatcher. Maps `CoachAction` → state-store mutations (split task, shrink, mark done, repair plan, save review memory, etc.).
- Confirmation prompt for destructive actions.

### 4. Universal Coach surface
- **`src/components/app/coach/CoachLauncher.tsx`** — floating button/sheet, mountable from any page. Opens a compact Coach panel.
- **`src/components/app/coach/CoachPanel.tsx`** — context-header card (goal · next move · pattern · pressure) + chat thread + max-3 contextual action chips + composer.
- **`src/components/app/coach/CoachMessage.tsx`** — renders `CoachResponse` with action buttons inline.
- **`src/components/app/coach/CoachActionChip.tsx`** — pressable action that calls `executeCoachAction`.
- Mount `CoachLauncher` in `AppShell` so it appears on Today / Plan / Portfolio / Path / Forge.

### 5. Existing Chat page upgrade (`src/pages/app/Chat.tsx`)
Refactor to use `CoachPanel` as its body. The Chat tab becomes the full-screen Coach view; the floating launcher gives quick access elsewhere.

### 6. Surface-specific quick actions
Today / Plan / Portfolio / Path / Forge each pass a `surface` hint to Coach so action chips are contextual:
- Today: Help me start · Make smaller · Why this matters · Rescue
- Plan: Repair today · Make lighter · Move one task
- Portfolio: Save what I learned · Make a quiz · What to review
- Path: Why does this matter · Next proof · What stage
- Forge: Make this useful · Revision card · Exam scaffold

## What we are NOT doing this pass
- New database tables (Coach memory uses existing state)
- Voice / multimodal
- Real-time streaming refactor (keep current invoke pattern)
- Replacing existing chat history persistence

## Acceptance
- Coach references real state (goal, task titles, completion patterns)
- Coach never re-asks onboarding-known info
- Coach infers state and adapts tone
- Coach offers ≤3 real actions that mutate state when clicked
- Coach launcher accessible from every app surface
- No "As an AI" / generic motivation leaks
- Build passes

## File summary
**Create (10):** `src/lib/coach/{build-coach-context,infer-execution-state,select-coach-tone,select-coach-actions,coach-action-types,coach-response-schema,coach-system-prompt,execute-coach-action}.ts`, `src/components/app/coach/{CoachLauncher,CoachPanel,CoachMessage,CoachActionChip}.tsx`

**Edit (3):** `supabase/functions/chat-coach/index.ts`, `src/pages/app/Chat.tsx`, `src/components/app/AppShell.tsx`
