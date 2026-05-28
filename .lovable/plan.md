## Exam Copilot — build plan

You laid out a 6-step path. I'll respect that sequence rather than cram it all into one drop. Each step ships standalone, is tested, and unlocks the next.

### Scope decision needed

You said *"Step 1: Finish V2.1 gap close"* first — but I don't have an explicit V2.1 checklist in the repo. The closest live gaps I can see:

- HeartbeatBanner doesn't link to Exam Mode when an `ExamEmergency` is active
- Dashboard/Rescue have no explicit "I have an exam" entry point
- `adaptPlanAfterFeedback` exists but isn't wired to the `exam/add_feedback` dispatch in `state-store`
- `ExamEmergency` doesn't emit Portfolio proof on block completion

**Question for you before I start:** do you want me to (a) treat those four bullets as V2.1 and close them in Step 1, or (b) skip ahead and start with Step 2 (Task Profile + Resources) since that's where the new product promise lives?

### Phased path (assuming you confirm)

```text
Step 1  V2.1 gap close          → Heartbeat link, Dashboard entry, feedback adaptation wired, Portfolio proof on block done
Step 2  Task Profile + Resources → ExamTaskProfile + ExamResource state, intake questions, resource map UI
Step 3  Questioner mode          → question generation tool in app-intelligence, /app/exam Copilot panel
Step 4  Work Rating mode         → rate-answer tool, structured score schema, save to state
Step 5  Adaptive plan from scores → weak-topic feedback loop influences next block + next question
Step 6  Portfolio proof from attempts → answer + rating attempts become evidence vault entries
```

### Step 2 (first real shipment) — what changes

**State additions** (in `state-store.ts` reducer + `schema.ts`):
- `ExamTaskProfile`: `{ format, sections[], rubric_text?, has_topic_list, has_past_papers, teacher_emphasis?, target_mark? }`
- `ExamResource[]`: `{ id, kind: 'notes'|'textbook'|'slides'|'past_paper'|'rubric'|'study_guide'|'teacher_feedback'|'practice_q', label, helps_with[], priority, how_to_use }`
- Both attached to `ExamEmergency` (non-breaking, optional)

**New actions:** `exam/set_task_profile`, `exam/add_resource`, `exam/remove_resource`, `exam/update_resource`

**Intake (chat-coach):** extend the existing `exam_intake` payload with two new optional sub-flows the coach can return — `task_profile_update` and `resource_update`. The router asks the right next question based on what's missing.

**UI (`/app/exam`):** add an "Exam Copilot" panel under the existing plan:
- Task profile card (with "Edit" → opens chat or inline editor)
- Resource map (chips grouped by priority, "Add resource" button)
- Empty state with one-tap buttons that dispatch coach prompts: "Tell Moment about your exam structure" / "Add your resources"

**Tests:** task profile saves, resources add/remove, intake routes to next missing field, existing exam-emergency tests still pass.

### Why phased

Steps 3–5 (Questioner/Rating/Adaptive) all depend on Step 2 data — the questioner needs `topics + task_profile + resources` to generate non-generic questions, and rating needs `target_mark` from the profile. Building them on top of an empty profile would just produce generic output, which is exactly what you're trying to escape.

### Naming

Confirm: **"Exam Copilot"** as the user-facing surface label, **"Exam Emergency"** kept only as the panic entry-point copy on Dashboard/Rescue. I'll rename `/app/exam` page header to "Exam Copilot" and keep the route URL unchanged.

---

**Reply with:**
1. Skip Step 1 or do it first? (the four V2.1 bullets above)
2. Go ahead with Step 2 as scoped?
3. Anything to add/remove from the Step 2 surface area?
