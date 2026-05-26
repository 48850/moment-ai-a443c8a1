/**
 * Operation Heartbeat — tests proving the shared intelligence layer
 * powers Plan, Mission, and Forge from the same ContextSnapshot.
 */
import { describe, it, expect } from "vitest";
import { buildContextSnapshot } from "@/lib/coach/context-snapshot";
import { buildContextualForgeSuggestions } from "@/components/app/HeartbeatBanner";
import type { MomentState } from "@/lib/types";

// ── Shared test state factory ────────────────────────────────────────────────

function makeState(overrides: Partial<MomentState> = {}): MomentState {
  const base = {
    user_id: "test-user",
    profile: {
      display_name: "Alex",
      age: 16,
      age_bracket: "16-17",
      school_year: "Year 11",
      academic_context: "GCSE",
      normal_weekday: "school",
      country: "UK",
      education_system: "uk_gcse",
    },
    active_goal: {
      id: "g1",
      statement: "Become a neurologist",
      why_it_matters: "Understand the brain",
      status: "active",
      phase: "building",
      seriousness_score: 80,
      stability_score: 70,
      reality_gap: "Years away",
      last_updated_at: new Date().toISOString(),
      desired_identity: "doctor",
      success_definition: "Medical school",
      current_stage: "Foundation",
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
    tasks: [],
    reflections: [],
    execution_feedback: [],
    rescue_signals: [],
    chat_messages: [],
    today_state: {
      date: new Date().toISOString().slice(0, 10),
      energy: "medium",
      stress: "low",
      alignment_signal: "aligned",
      current_bottleneck: "",
      decisive_move: "",
      decisive_move_reason: "",
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
    alignment: { status: "aligned", drift_score: 0, last_checked: new Date().toISOString() },
    home: { active_plan: "plan_a" },
    pathway: { domains: [], current_stage: "", next_milestone: "", path_integrity: 100 },
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
        medium_term_goal: "Get A-levels",
        short_term_goal: "Pass mock exams",
      },
      understanding: {
        knowns: ["user is Year 11"],
        unknowns: [],
        assumptions: [],
        confidence: 0.8,
      },
    },
  };
  return { ...base, ...overrides } as unknown as MomentState;
}

function makeTask(overrides: Partial<MomentState["tasks"][0]> = {}): MomentState["tasks"][0] {
  return {
    id: crypto.randomUUID(),
    title: "Biology revision",
    description: "",
    status: "pending",
    priority: "high",
    goal_id: "g1",
    domain_id: "",
    estimated_minutes: 45,
    category: "goal_direct",
    created_at: new Date().toISOString(),
    completed_at: "",
    due_date: "",
    created_by: "ai",
    why_now: "Core topic for exam",
    notes: [],
    ...overrides,
  };
}

// ── Plan: HeartbeatBanner reads ContextSnapshot ──────────────────────────────

describe("Plan: HeartbeatBanner reads from shared ContextSnapshot", () => {
  it("snapshot exposes next_best_task for Plan to display", () => {
    const task = makeTask({ title: "Read biology chapter 3", priority: "high" });
    const state = makeState({ tasks: [task] });
    const snap = buildContextSnapshot(state, "");

    expect(snap.next_best_task).not.toBeNull();
    expect(snap.next_best_task?.title).toBe("Read biology chapter 3");
  });

  it("snapshot exposes plan_pressure for Plan's pressure indicator", () => {
    // Create enough tasks to exceed time budget
    const tasks = Array.from({ length: 10 }, (_, i) =>
      makeTask({ id: `t${i}`, estimated_minutes: 120, priority: "high" }),
    );
    const state = makeState({ tasks });
    const snap = buildContextSnapshot(state, "");

    expect(["moderate", "high", "critical"]).toContain(snap.plan_pressure);
  });

  it("snapshot exposes overdue_task_count for Plan's overdue warning", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const overdueTask = makeTask({ due_date: yesterday });
    const state = makeState({ tasks: [overdueTask] });
    const snap = buildContextSnapshot(state, "");

    expect(snap.overdue_task_count).toBe(1);
  });

  it("plan_needs_repair is true when there are overdue tasks", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const overdueTask = makeTask({ due_date: yesterday });
    const state = makeState({ tasks: [overdueTask] });
    const snap = buildContextSnapshot(state, "");

    expect(snap.plan_needs_repair).toBe(true);
  });

  it("plan_needs_repair is false when everything is clean", () => {
    const state = makeState({ tasks: [] });
    const snap = buildContextSnapshot(state, "");

    expect(snap.plan_needs_repair).toBe(false);
    expect(snap.plan_pressure).toBe("low");
  });
});

// ── Mission: HeartbeatBanner exposes "why today matters" context ─────────────

describe("Mission: HeartbeatBanner exposes goal-meaning context", () => {
  it("snapshot exposes goal_phase for Mission's stage context", () => {
    const state = makeState();
    const snap = buildContextSnapshot(state, "");

    expect(snap.goal_phase).toBe("building");
    expect(snap.goal_current_stage).toBe("Foundation");
  });

  it("snapshot exposes long_term_goal from onboarding answers", () => {
    const state = makeState();
    const snap = buildContextSnapshot(state, "");

    expect(snap.long_term_goal).toBe("Become a neurologist");
  });

  it("snapshot exposes decisive_move for Mission's 'why today' section", () => {
    const state = makeState({
      today_state: {
        ...makeState().today_state!,
        decisive_move: "Complete the biology past paper",
        decisive_move_reason: "Highest leverage activity for mock exam",
      },
    });
    const snap = buildContextSnapshot(state, "");

    expect(snap.decisive_move).toBe("Complete the biology past paper");
  });

  it("snapshot exposes current_bottleneck for Mission's blocking section", () => {
    const state = makeState({
      today_state: {
        ...makeState().today_state!,
        current_bottleneck: "Haven't started biology revision",
      },
    });
    const snap = buildContextSnapshot(state, "");

    expect(snap.current_bottleneck).toBe("Haven't started biology revision");
  });

  it("inferred_situation is progressing when multiple tasks completed today", () => {
    const today = new Date().toISOString();
    const done1 = makeTask({ status: "done", completed_at: today });
    const done2 = makeTask({ status: "done", completed_at: today });
    const state = makeState({ tasks: [done1, done2] });
    const snap = buildContextSnapshot(state, "");

    expect(snap.inferred_situation).toBe("progressing");
  });

  it("state_evidence has entries when there's meaningful activity", () => {
    const today = new Date().toISOString();
    const done = makeTask({ status: "done", completed_at: today });
    const state = makeState({ tasks: [done] });
    const snap = buildContextSnapshot(state, "");

    expect(snap.state_evidence.length).toBeGreaterThan(0);
    expect(snap.state_evidence.some((e) => e.includes("completed"))).toBe(true);
  });
});

// ── Forge: contextual suggestions based on ContextSnapshot ───────────────────

describe("Forge: contextual suggestions powered by ContextSnapshot", () => {
  it("generates rescue suggestion when user has urgent deadline", () => {
    const state = makeState();
    const snap = buildContextSnapshot(
      state,
      "I have an essay due tomorrow and haven't started",
    );

    const existingTypes = new Set<string>();
    const suggestions = buildContextualForgeSuggestions(snap, existingTypes);

    const rescueSuggestion = suggestions.find((s) => s.feature_type === "control_room");
    expect(rescueSuggestion).toBeDefined();
    expect(rescueSuggestion?.urgency).toBe("high");
    expect(rescueSuggestion?.title.toLowerCase()).toContain("rescue");
  });

  it("does not duplicate a suggestion type already in active guidebooks", () => {
    const state = makeState();
    const snap = buildContextSnapshot(
      state,
      "I have an essay due tomorrow and haven't started",
    );

    // control_room is already active
    const existingTypes = new Set<string>(["control_room"]);
    const suggestions = buildContextualForgeSuggestions(snap, existingTypes);

    const dupes = suggestions.filter((s) => s.feature_type === "control_room");
    expect(dupes).toHaveLength(0);
  });

  it("generates triage planner when schedule pressure is high", () => {
    // Create many high-priority tasks
    const tasks = Array.from({ length: 8 }, (_, i) =>
      makeTask({ id: `t${i}`, estimated_minutes: 120, priority: "high" }),
    );
    const state = makeState({ tasks });
    const snap = buildContextSnapshot(state, "");

    const existingTypes = new Set<string>();
    const suggestions = buildContextualForgeSuggestions(snap, existingTypes);

    // With overwhelmed situation, should suggest planner or control_room
    const hasRelevant = suggestions.some((s) =>
      ["planner", "control_room"].includes(s.feature_type),
    );
    expect(hasRelevant).toBe(true);
  });

  it("generates reconnect tool when user is drifting", () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    // Multiple overdue tasks = drifting
    const tasks = Array.from({ length: 3 }, (_, i) =>
      makeTask({ id: `t${i}`, due_date: yesterday }),
    );
    const state = makeState({ tasks });
    const snap = buildContextSnapshot(state, "");

    // Verify drifting is inferred
    expect(snap.inferred_situation).toBe("drifting");

    const existingTypes = new Set<string>();
    const suggestions = buildContextualForgeSuggestions(snap, existingTypes);

    // Should suggest coach_lens for drifting
    const hasDriftTool = suggestions.some((s) => s.feature_type === "coach_lens");
    expect(hasDriftTool).toBe(true);
  });

  it("generates breakdown protocol when too_big friction is repeated", () => {
    const now = new Date().toISOString();
    const feedback = Array.from({ length: 4 }, (_, i) => ({
      id: `fb-${i}`,
      task_id: "t1",
      task_title: "Biology",
      feedback: "too_big",
      source: "chat",
      created_at: now,
    }));
    const state = makeState({ execution_feedback: feedback as any });
    const snap = buildContextSnapshot(state, "");

    const existingTypes = new Set<string>();
    const suggestions = buildContextualForgeSuggestions(snap, existingTypes);

    const hasSplit = suggestions.some((s) => s.feature_type === "protocol");
    expect(hasSplit).toBe(true);
  });

  it("returns at most 3 suggestions", () => {
    // Create a state with multiple triggers
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const tasks = Array.from({ length: 5 }, (_, i) =>
      makeTask({ id: `t${i}`, due_date: yesterday, estimated_minutes: 120 }),
    );
    const now = new Date().toISOString();
    const feedback = Array.from({ length: 4 }, (_, i) => ({
      id: `fb-${i}`,
      task_id: "t1",
      task_title: "Task",
      feedback: "too_big",
      source: "chat",
      created_at: now,
    }));
    const state = makeState({ tasks, execution_feedback: feedback as any });
    const snap = buildContextSnapshot(state, "I have an essay due tomorrow");

    const existingTypes = new Set<string>();
    const suggestions = buildContextualForgeSuggestions(snap, existingTypes);

    expect(suggestions.length).toBeLessThanOrEqual(3);
  });

  it("all suggestions have required fields", () => {
    const state = makeState({ tasks: [makeTask()] });
    const snap = buildContextSnapshot(state, "I'm overwhelmed and behind on everything");

    const existingTypes = new Set<string>();
    const suggestions = buildContextualForgeSuggestions(snap, existingTypes);

    for (const s of suggestions) {
      expect(typeof s.title).toBe("string");
      expect(s.title.length).toBeGreaterThan(0);
      expect(typeof s.why).toBe("string");
      expect(typeof s.feature_type).toBe("string");
      expect(typeof s.description_hint).toBe("string");
      expect(["high", "normal"]).toContain(s.urgency);
    }
  });
});

// ── Cross-tab consistency ─────────────────────────────────────────────────────

describe("Cross-tab consistency: all tabs read from same ContextSnapshot", () => {
  it("the same state produces the same next_best_task across Plan and Mission", () => {
    const task = makeTask({ title: "Shared task", priority: "high" });
    const state = makeState({ tasks: [task] });

    // Both Plan and Mission use buildContextSnapshot with no user text
    const snapForPlan = buildContextSnapshot(state, "");
    const snapForMission = buildContextSnapshot(state, "");

    expect(snapForPlan.next_best_task?.title).toBe(snapForMission.next_best_task?.title);
    expect(snapForPlan.inferred_situation).toBe(snapForMission.inferred_situation);
    expect(snapForPlan.plan_pressure).toBe(snapForMission.plan_pressure);
  });

  it("the same state produces the same goal data across Plan, Mission, and Forge", () => {
    const state = makeState();

    const snap1 = buildContextSnapshot(state, "");
    const snap2 = buildContextSnapshot(state, "");
    const snap3 = buildContextSnapshot(state, "");

    expect(snap1.long_term_goal).toBe(snap2.long_term_goal);
    expect(snap2.long_term_goal).toBe(snap3.long_term_goal);
    expect(snap1.why_it_matters).toBe(snap3.why_it_matters);
  });

  it("all tabs use is_rescue_situation to surface rescue alerts consistently", () => {
    const state = makeState();
    const urgentText = "I have a chemistry test due tomorrow and I haven't started";

    const snapPlan = buildContextSnapshot(state, urgentText);
    const snapMission = buildContextSnapshot(state, urgentText);
    const snapForge = buildContextSnapshot(state, urgentText);

    // All three would receive the same rescue detection
    expect(snapPlan.is_rescue_situation).toBe(true);
    expect(snapMission.is_rescue_situation).toBe(true);
    expect(snapForge.is_rescue_situation).toBe(true);
  });
});
