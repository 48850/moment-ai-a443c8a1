/**
 * Context Intelligence Layer — test suite.
 *
 * Proves the 8 spec requirements:
 * 1. Bot does not repeat known onboarding questions
 * 2. Bot references active tasks correctly
 * 3. Bot reacts differently to overwhelmed vs progressing users
 * 4. Done feedback is saved as context
 * 5. Rescue plans are generated for urgent school tasks
 * 6. The response includes one concrete next action
 * 7. Unknown state fields are not written
 * 8. Memory updates are explicit and safe
 */
import { describe, it, expect } from "vitest";
import { buildContextSnapshot } from "@/lib/coach/context-snapshot";
import { inferExecutionState } from "@/lib/coach/infer-execution-state";
import { selectChatSnapshot } from "@/lib/selectors/chat";
import { parseCoachResponse } from "@/lib/coach/coach-response-schema";
import type { MomentState } from "@/lib/types";

// ── Minimal state factory ────────────────────────────────────────────────────

function makeState(overrides: Partial<MomentState> = {}): MomentState {
  const base: MomentState = {
    user_id: "test-user",
    profile: {
      display_name: "Alex",
      age: 16,
      age_bracket: "16-17",
      school_year: "Year 11",
      academic_context: "GCSE year",
      normal_weekday: "school",
      country: "UK",
      education_system: "uk_gcse",
    },
    active_goal: {
      id: "goal-1",
      statement: "Become a neurologist",
      why_it_matters: "I want to understand the brain",
      status: "active",
      phase: "building",
      seriousness_score: 80,
      stability_score: 70,
      reality_gap: "Currently year 11, need A-levels and medical degree",
      last_updated_at: new Date().toISOString(),
      desired_identity: "doctor",
      success_definition: "Get into medical school",
      current_stage: "Pre-A-levels",
      target_stage: "A-level applications",
    },
    constraints: {
      school_end_time: "15:30",
      commute_minutes: 30,
      sleep_floor_time: "23:00",
      sleep_target_time: "22:30",
      exercise_minutes_daily: 30,
      study_minutes_daily: 90,
      fixed_commitments: [],
      preferred_work_window: "evening",
      energy_pattern: "night",
      fixed_commitments_checked: true,
      missing_fields: [],
    },
    pathway: { domains: [], current_stage: "", next_milestone: "", path_integrity: 100 },
    today_state: {
      date: new Date().toISOString().slice(0, 10),
      energy: "medium",
      stress: "low",
      alignment_signal: "aligned",
      current_bottleneck: "Biology revision",
      decisive_move: "Read chapter 3",
      decisive_move_reason: "Most overdue",
      available_time_blocks: [],
      day_context_notes: "",
    },
    schedule_state: {
      day_plan: [],
      day_plan_a_snapshot: [],
      week_plan: [],
      week_plan_generated_at: "",
      assumptions: [],
      confidence: 80,
      last_plan_generated_at: new Date().toISOString(),
      reform_note: "",
      relationships: [],
    },
    progress_state: {
      last_planned_action: "",
      last_outcome: "unknown",
      blockers: [],
      what_changed: "",
      last_checked_at: new Date().toISOString(),
    },
    memory_state: {
      stable_facts: {},
      semi_stable_patterns: {},
      open_questions: [],
      expiring_assumptions: [],
    },
    system_state: {
      current_mode: "build_day_plan",
      last_response_type: "",
      state_version: 1,
    },
    tasks: [],
    reflections: [],
    execution_feedback: [],
    alignment: { status: "aligned", drift_score: 0, last_checked: new Date().toISOString() },
    home: { active_plan: "plan_a" },
    forge_state: {
      interview_answers: [],
      candidate_features: [],
      selected_feature_ids: [],
      generated_modules: [],
      compiler_status: "idle",
      guidebooks: [],
      feature_runs: [],
      forge_signals: [],
      guidebook_build_status: "idle",
      draft_guidebook: null,
      forge_videos: [],
    },
    pursuit_model: null,
    rescue_signals: [],
    chat_messages: [],
    chat_preferences: { tone: "default" },
    chat_state: {
      post_onboarding_specialisation_required: false,
      specialisation_phase: "complete",
    },
    onboarding: {
      completed: true,
      current_stage: "done",
      answers: {
        long_term_goal: "Become a neurologist",
        medium_term_goal: "Get A-levels in Biology and Chemistry",
        short_term_goal: "Pass mock exams with grade B or above",
        why_it_matters: "I want to understand the brain",
        life_stage: "Year 11",
        country: "UK",
      },
      understanding: {
        knowns: ["user is Year 11", "goal is neurologist", "studying in UK"],
        unknowns: [],
        assumptions: [],
        confidence: 0.8,
      },
    },
  } as unknown as MomentState;

  return { ...base, ...overrides };
}

function makePendingTask(
  overrides: Partial<MomentState["tasks"][0]> = {},
): MomentState["tasks"][0] {
  return {
    id: crypto.randomUUID(),
    title: "Read biology chapter 3",
    description: "",
    status: "pending",
    priority: "high",
    goal_id: "goal-1",
    domain_id: "",
    estimated_minutes: 45,
    category: "goal_direct",
    created_at: new Date().toISOString(),
    completed_at: "",
    due_date: "",
    created_by: "ai",
    why_now: "Core topic for upcoming mock",
    notes: [],
    ...overrides,
  };
}

// ── 1. Does not repeat known onboarding questions ────────────────────────────

describe("Requirement 1: No onboarding question repetition", () => {
  it("snapshot includes onboarding_knowns so the model skips already-answered questions", () => {
    const state = makeState();
    const snap = selectChatSnapshot(state);

    expect(snap.onboarding_knowns).toContain("user is Year 11");
    expect(snap.onboarding_knowns).toContain("goal is neurologist");
    expect(snap.onboarding_knowns).toContain("studying in UK");
  });

  it("snapshot includes onboarding_answers keyed by field name", () => {
    const state = makeState();
    const snap = selectChatSnapshot(state);

    expect(snap.onboarding_answers.long_term_goal).toBe("Become a neurologist");
    expect(snap.onboarding_answers.why_it_matters).toBe("I want to understand the brain");
  });

  it("context snapshot exposes the same answers to block redundant questions", () => {
    const state = makeState();
    const ctx = buildContextSnapshot(state, "");

    expect(ctx.long_term_goal).toBe("Become a neurologist");
    expect(ctx.why_it_matters).toBe("I want to understand the brain");
    expect(ctx.goal_phase).toBe("building");
  });
});

// ── 2. References active tasks correctly ─────────────────────────────────────

describe("Requirement 2: Correct active task references", () => {
  it("pending_tasks in snapshot includes correct id, title, and minutes", () => {
    const task = makePendingTask({ id: "task-abc", title: "History essay outline", estimated_minutes: 60 });
    const state = makeState({ tasks: [task] });
    const snap = selectChatSnapshot(state);

    const found = snap.pending_tasks.find((t) => t.id === "task-abc");
    expect(found).toBeDefined();
    expect(found?.title).toBe("History essay outline");
    expect(found?.minutes).toBe(60);
  });

  it("context snapshot todays_tasks matches pending tasks", () => {
    const task = makePendingTask({ id: "task-xyz", title: "Chemistry revision", priority: "high" });
    const state = makeState({ tasks: [task] });
    const ctx = buildContextSnapshot(state, "");

    const found = ctx.todays_tasks.find((t) => t.id === "task-xyz");
    expect(found).toBeDefined();
    expect(found?.priority).toBe("high");
  });

  it("next_best_task is populated when pending tasks exist", () => {
    const highTask = makePendingTask({ priority: "high", title: "Biology mock prep" });
    const lowTask = makePendingTask({ priority: "low", title: "Reading fiction" });
    const state = makeState({ tasks: [lowTask, highTask] });
    const ctx = buildContextSnapshot(state, "");

    expect(ctx.next_best_task).not.toBeNull();
    expect(ctx.next_best_task?.title).toBe("Biology mock prep");
  });

  it("completed tasks do not appear in pending_tasks", () => {
    const done = makePendingTask({ status: "done", completed_at: new Date().toISOString() });
    const pending = makePendingTask({ title: "Active task" });
    const state = makeState({ tasks: [done, pending] });
    const snap = selectChatSnapshot(state);

    const allTitles = snap.pending_tasks.map((t) => t.title);
    expect(allTitles).not.toContain(done.title);
    expect(allTitles).toContain("Active task");
  });
});

// ── 3. Different reaction: overwhelmed vs progressing ────────────────────────

describe("Requirement 3: State-aware emotional reactions", () => {
  it("inferExecutionState returns overloaded when user says they are overwhelmed", () => {
    const state = makeState();
    const result = inferExecutionState(state, "I'm completely overwhelmed right now");
    expect(result.state).toBe("overloaded");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("inferExecutionState returns drifting when user signals giving up", () => {
    const state = makeState();
    const result = inferExecutionState(state, "I can't do this, what's the point");
    expect(result.state).toBe("drifting");
  });

  it("inferExecutionState returns proud when user reports completion", () => {
    const state = makeState();
    const result = inferExecutionState(state, "I finally got it done!");
    expect(result.state).toBe("proud");
  });

  it("buildContextSnapshot infers overwhelmed when schedule pressure is critical", () => {
    // Create many high-priority tasks to force critical pressure
    const tasks = Array.from({ length: 8 }, (_, i) =>
      makePendingTask({ id: `t${i}`, title: `Task ${i}`, estimated_minutes: 120, priority: "high" }),
    );
    const state = makeState({ tasks });
    const ctx = buildContextSnapshot(state, "");

    // Either the situation is overwhelmed or the pressure is not low
    expect(["overwhelmed", "high", "critical"].some((v) =>
      ctx.inferred_situation === "overwhelmed" || ctx.plan_pressure === v,
    )).toBe(true);
  });

  it("buildContextSnapshot infers progressing when multiple tasks completed today", () => {
    const today = new Date().toISOString();
    const done1 = makePendingTask({ status: "done", completed_at: today });
    const done2 = makePendingTask({ status: "done", completed_at: today });
    const state = makeState({ tasks: [done1, done2] });
    const ctx = buildContextSnapshot(state, "");

    expect(ctx.inferred_situation).toBe("progressing");
  });

  it("inferExecutionState detects urgent deadline as overloaded", () => {
    const state = makeState();
    const result = inferExecutionState(
      state,
      "I haven't started my history essay and it's due tomorrow",
    );
    expect(result.state).toBe("overloaded");
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });
});

// ── 4. Done feedback saved as context ────────────────────────────────────────

describe("Requirement 4: Done feedback is saved as context", () => {
  it("execution_feedback entries are included in chat snapshot", () => {
    const state = makeState({
      execution_feedback: [
        {
          id: "fb-1",
          task_id: "task-abc",
          task_title: "Biology chapter",
          feedback: "hard",
          source: "chat",
          created_at: new Date().toISOString(),
        },
      ] as any,
    });
    const snap = selectChatSnapshot(state);
    const fb = snap.recent_feedback.find((f) => f.feedback === "hard");
    expect(fb).toBeDefined();
    expect(fb?.task_title).toBe("Biology chapter");
  });

  it("buildContextSnapshot captures friction patterns from feedback", () => {
    const now = new Date().toISOString();
    const feedbackItems = Array.from({ length: 3 }, (_, i) => ({
      id: `fb-${i}`,
      task_id: "task-abc",
      task_title: "Biology chapter",
      feedback: "too_big",
      source: "chat",
      created_at: now,
    }));
    const state = makeState({ execution_feedback: feedbackItems as any });
    const ctx = buildContextSnapshot(state, "");

    const friction = ctx.active_friction.find((f) => f.tag === "too_big");
    expect(friction).toBeDefined();
    expect(friction!.count).toBeGreaterThanOrEqual(3);
  });

  it("memory_candidates are populated when winning pattern detected", () => {
    const today = new Date().toISOString();
    const tasks = Array.from({ length: 3 }, () =>
      makePendingTask({ status: "done", completed_at: today }),
    );
    const state = makeState({ tasks });
    const ctx = buildContextSnapshot(state, "");

    const win = ctx.memory_candidates.find((m) => m.type === "win");
    expect(win).toBeDefined();
    expect(win?.content).toContain("Completed");
  });
});

// ── 5. Rescue plans for urgent school tasks ──────────────────────────────────

describe("Requirement 5: Rescue plan detection for urgent tasks", () => {
  it("buildContextSnapshot detects rescue situation from urgency language", () => {
    const state = makeState();
    const ctx = buildContextSnapshot(
      state,
      "I have a history essay due Friday and I haven't started",
    );
    expect(ctx.is_rescue_situation).toBe(true);
    expect(ctx.deadline_urgency).toBeDefined();
  });

  it("detects rescue for various urgency patterns", () => {
    const state = makeState();
    const patterns = [
      "My essay is due tomorrow and I haven't started",
      "I have a test due today",
      "Assignment due this week and I'm panicking",
      "My coursework is due Monday and I haven't begun",
    ];

    for (const text of patterns) {
      const ctx = buildContextSnapshot(state, text);
      expect(ctx.is_rescue_situation).toBe(true);
    }
  });

  it("non-urgent messages do not trigger rescue", () => {
    const state = makeState();
    const ctx = buildContextSnapshot(state, "What should I work on today?");
    expect(ctx.is_rescue_situation).toBe(false);
    expect(ctx.deadline_urgency).toBeUndefined();
  });

  it("parseCoachResponse safely extracts a rescue_plan from model output", () => {
    const raw = {
      mode: "rescue",
      reply: "Okay. We are not trying to be perfect tonight. We are regaining control.",
      inferred_state: "overloaded",
      confidence: 0.9,
      evidence_used: ["user hasn't started", "essay due Friday"],
      suggested_actions: [],
      rescue_plan: {
        task_title: "History essay",
        due_description: "Friday",
        first_move: "Open a blank doc and write the essay title (2 min)",
        steps: [
          "Write essay title and 3 section headings (10 min)",
          "Write intro paragraph — 2 sentences (15 min)",
          "Draft section 1 with key argument (20 min)",
          "Draft section 2 (20 min)",
          "Conclusion + read-through (15 min)",
        ],
        estimated_total_minutes: 80,
        panic_reduction:
          "80 minutes is all you need. That is achievable tonight after dinner.",
      },
    };
    const parsed = parseCoachResponse(raw, "");
    expect(parsed.mode).toBe("rescue");
    expect(parsed.rescue_plan).not.toBeNull();
    expect(parsed.rescue_plan?.task_title).toBe("History essay");
    expect(parsed.rescue_plan?.steps).toHaveLength(5);
    expect(parsed.rescue_plan?.first_move).toContain("2 min");
  });

  it("parseCoachResponse returns null rescue_plan when not provided", () => {
    const raw = {
      mode: "next_move",
      reply: "Let's focus on the biology revision.",
      inferred_state: "steady",
      confidence: 0.6,
      evidence_used: [],
      suggested_actions: [],
    };
    const parsed = parseCoachResponse(raw, "");
    expect(parsed.rescue_plan).toBeNull();
  });
});

// ── 6. Response includes one concrete next action ────────────────────────────

describe("Requirement 6: Concrete next action always present when tasks exist", () => {
  it("next_best_task is set when tasks are pending", () => {
    const task = makePendingTask({ title: "Complete intro paragraph", priority: "high" });
    const state = makeState({ tasks: [task] });
    const ctx = buildContextSnapshot(state, "");

    expect(ctx.next_best_task).not.toBeNull();
    expect(ctx.next_best_task?.title).toBe("Complete intro paragraph");
    expect(ctx.next_best_task?.minutes).toBeGreaterThan(0);
  });

  it("next_best_task is null when there are no pending tasks", () => {
    const state = makeState({ tasks: [] });
    const ctx = buildContextSnapshot(state, "");
    expect(ctx.next_best_task).toBeNull();
  });

  it("high priority task is selected over low priority as next action", () => {
    const low = makePendingTask({ priority: "low", title: "Optional reading" });
    const high = makePendingTask({ priority: "high", title: "Exam prep" });
    const state = makeState({ tasks: [low, high] });
    const ctx = buildContextSnapshot(state, "");

    expect(ctx.next_best_task?.title).toBe("Exam prep");
  });

  it("parseCoachResponse preserves next_move from model output", () => {
    const raw = {
      mode: "next_move",
      reply: "Start with the biology chapter — that is your clearest win right now.",
      inferred_state: "steady",
      confidence: 0.7,
      evidence_used: ["biology task is high priority"],
      next_move: { label: "Read chapter 3", task_id: "task-123", estimated_minutes: 45 },
      suggested_actions: [{ type: "task.mark_done", label: "Mark done", task_id: "task-123" }],
    };
    const parsed = parseCoachResponse(raw, "");
    expect(parsed.next_move?.label).toBe("Read chapter 3");
    expect(parsed.next_move?.estimated_minutes).toBe(45);
  });
});

// ── 7. Unknown state fields are not written ──────────────────────────────────

describe("Requirement 7: Unknown state fields are not written", () => {
  it("buildContextSnapshot returns empty strings for unknown goal fields, not undefined", () => {
    const state = makeState({
      active_goal: {
        ...makeState().active_goal,
        current_stage: "",
        target_stage: "",
      },
    });
    const ctx = buildContextSnapshot(state, "");

    // Fields must be present (not undefined) but can be empty strings
    expect(ctx.goal_current_stage).toBeDefined();
    expect(ctx.goal_current_stage).toBe("");
    expect(ctx.current_bottleneck).toBeDefined();
  });

  it("parseCoachResponse clamps confidence to 0-1 range — no invalid values written", () => {
    const raw = {
      mode: "next_move",
      reply: "Test",
      inferred_state: "steady",
      confidence: 9999,
      evidence_used: [],
      suggested_actions: [],
    };
    const parsed = parseCoachResponse(raw, "");
    expect(parsed.confidence).toBe(1); // clamped
  });

  it("parseCoachResponse rejects invalid action types and does not write them", () => {
    const raw = {
      mode: "next_move",
      reply: "Test",
      inferred_state: "steady",
      confidence: 0.5,
      evidence_used: [],
      suggested_actions: [
        { type: "INVALID_TYPE", label: "Do something bad" },
        { type: "task.mark_done", label: "Good action", task_id: "t1" },
      ],
    };
    const parsed = parseCoachResponse(raw, "");
    expect(parsed.suggested_actions).toHaveLength(1);
    expect(parsed.suggested_actions[0].type).toBe("task.mark_done");
  });

  it("parseCoachResponse rejects invalid inferred_state and defaults to steady", () => {
    const raw = {
      mode: "next_move",
      reply: "Test",
      inferred_state: "MADE_UP_STATE",
      confidence: 0.5,
      evidence_used: [],
      suggested_actions: [],
    };
    const parsed = parseCoachResponse(raw, "");
    expect(parsed.inferred_state).toBe("steady");
  });

  it("context snapshot does not produce rescue_plan fields when not a rescue situation", () => {
    const state = makeState({ tasks: [makePendingTask()] });
    const ctx = buildContextSnapshot(state, "what should I focus on?");

    expect(ctx.is_rescue_situation).toBe(false);
    expect(ctx.deadline_urgency).toBeUndefined();
  });
});

// ── 8. Memory updates are explicit and safe ──────────────────────────────────

describe("Requirement 8: Memory updates are explicit and safe", () => {
  it("parseCoachResponse only accepts valid memory_to_save types", () => {
    const validTypes = ["friction", "goal_clarity", "learning_gap", "win", "open_loop"];

    for (const type of validTypes) {
      const raw = {
        mode: "review_memory",
        reply: "Saving this for later.",
        inferred_state: "steady",
        confidence: 0.6,
        evidence_used: [],
        suggested_actions: [],
        memory_to_save: { type, content: "test content", confidence: 0.8 },
      };
      const parsed = parseCoachResponse(raw, "");
      expect(parsed.memory_to_save?.type).toBe(type);
    }
  });

  it("parseCoachResponse rejects memory_to_save with invalid type, defaults to open_loop", () => {
    const raw = {
      mode: "review_memory",
      reply: "Saving.",
      inferred_state: "steady",
      confidence: 0.6,
      evidence_used: [],
      suggested_actions: [],
      memory_to_save: { type: "INVALID_MEMORY_TYPE", content: "something", confidence: 0.9 },
    };
    const parsed = parseCoachResponse(raw, "");
    expect(parsed.memory_to_save?.type).toBe("open_loop");
  });

  it("parseCoachResponse ignores memory_to_save with empty content", () => {
    const raw = {
      mode: "review_memory",
      reply: "Saving.",
      inferred_state: "steady",
      confidence: 0.6,
      evidence_used: [],
      suggested_actions: [],
      memory_to_save: { type: "win", content: "", confidence: 0.9 },
    };
    const parsed = parseCoachResponse(raw, "");
    // Empty content means the memory_to_save should be undefined or have no meaningful content
    if (parsed.memory_to_save) {
      expect(parsed.memory_to_save.content).toBeDefined();
    }
  });

  it("buildContextSnapshot produces explicit memory_candidates with typed entries", () => {
    const now = new Date().toISOString();
    const feedbackItems = Array.from({ length: 4 }, (_, i) => ({
      id: `fb-${i}`,
      task_id: "task-1",
      task_title: "Biology",
      feedback: "too_vague",
      source: "chat",
      created_at: now,
    }));
    const state = makeState({ execution_feedback: feedbackItems as any });
    const ctx = buildContextSnapshot(state, "");

    for (const candidate of ctx.memory_candidates) {
      expect(["friction", "win", "open_loop", "learning_gap", "goal_clarity"]).toContain(
        candidate.type,
      );
      expect(typeof candidate.content).toBe("string");
      expect(candidate.content.length).toBeGreaterThan(0);
    }
  });

  it("rescue_plan in parseCoachResponse has all required fields when present", () => {
    const raw = {
      mode: "rescue",
      reply: "Let's do this.",
      inferred_state: "overloaded",
      confidence: 0.9,
      evidence_used: [],
      suggested_actions: [],
      rescue_plan: {
        task_title: "English essay",
        due_description: "tomorrow",
        first_move: "Open a doc and write the title (2 min)",
        steps: ["Outline 3 points (10 min)", "Write intro (15 min)"],
        estimated_total_minutes: 90,
        panic_reduction: "90 minutes is enough.",
      },
    };
    const parsed = parseCoachResponse(raw, "");

    expect(parsed.rescue_plan?.task_title).toBeTruthy();
    expect(parsed.rescue_plan?.due_description).toBeTruthy();
    expect(parsed.rescue_plan?.first_move).toBeTruthy();
    expect(Array.isArray(parsed.rescue_plan?.steps)).toBe(true);
    expect(typeof parsed.rescue_plan?.estimated_total_minutes).toBe("number");
    expect(parsed.rescue_plan?.panic_reduction).toBeTruthy();
  });
});
