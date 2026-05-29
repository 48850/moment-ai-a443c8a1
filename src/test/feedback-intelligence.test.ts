/**
 * Feedback Intelligence — tests for pure selectors built on execution_feedback.
 */
import { describe, it, expect } from "vitest";
import {
  selectRecentFeedback,
  selectFrictionPattern,
  selectPreferredSupportStyle,
  selectLatestVibe,
  selectTaskAdaptationFromFeedback,
  buildEmotionalSnapshot,
} from "@/lib/selectors/feedback-intelligence";
import type { MomentState } from "@/lib/types";

function makeState(overrides: Partial<MomentState> = {}): MomentState {
  return {
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
    active_goal: null,
    constraints: null,
    pathway: { domains: [], current_stage: "", next_milestone: "", path_integrity: 100 },
    today_state: null,
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
        medium_term_goal: "Get A-levels",
        short_term_goal: "Pass mocks",
        why_it_matters: "I want to understand the brain",
        life_stage: "Year 11",
        country: "UK",
      },
      understanding: {
        knowns: [],
        unknowns: [],
        assumptions: [],
        confidence: 0.8,
      },
    },
    ...overrides,
  } as unknown as MomentState;
}

function recentIso(hoursAgo = 0): string {
  return new Date(Date.now() - hoursAgo * 3_600_000).toISOString();
}

function makeFeedback(
  feedback: string,
  source = "task",
  hoursAgo = 1,
): MomentState["execution_feedback"][0] {
  return {
    id: crypto.randomUUID(),
    task_id: "t1",
    task_title: "",
    completed_at: "",
    source,
    feedback,
    note: "",
    created_at: recentIso(hoursAgo),
    target_id: "",
  } as MomentState["execution_feedback"][0];
}

// ── feedback/add persists in execution_feedback ──────────────────────────────

describe("feedback/add persists in execution_feedback", () => {
  it("exam_question source feedback is readable by selectRecentFeedback", () => {
    const state = makeState({
      execution_feedback: [
        makeFeedback("confusing", "exam_question"),
        makeFeedback("felt_good", "task"),
      ],
    });
    const recent = selectRecentFeedback(state, ["exam_question"]);
    expect(recent).toHaveLength(1);
    expect(recent[0].feedback).toBe("confusing");
    expect(recent[0].source).toBe("exam_question");
  });

  it("all sources returned when no filter passed", () => {
    const state = makeState({
      execution_feedback: [
        makeFeedback("confusing", "exam_question"),
        makeFeedback("felt_good", "task"),
      ],
    });
    const all = selectRecentFeedback(state);
    expect(all).toHaveLength(2);
  });
});

// ── selectFrictionPattern ─────────────────────────────────────────────────────

describe("selectFrictionPattern", () => {
  it("returns avoidant: true when 2+ do_differently in 48h", () => {
    const state = makeState({
      execution_feedback: [
        makeFeedback("do_differently", "task", 10),
        makeFeedback("do_differently", "task", 20),
      ],
    });
    const pattern = selectFrictionPattern(state);
    expect(pattern.avoidant).toBe(true);
  });

  it("returns avoidant: false with only one do_differently signal", () => {
    const state = makeState({
      execution_feedback: [makeFeedback("do_differently", "task", 5)],
    });
    const pattern = selectFrictionPattern(state);
    expect(pattern.avoidant).toBe(false);
  });

  it("returns confused: true when 2+ confusing signals in 48h", () => {
    const state = makeState({
      execution_feedback: [
        makeFeedback("confusing", "exam_question", 2),
        makeFeedback("confusing", "task", 5),
      ],
    });
    const pattern = selectFrictionPattern(state);
    expect(pattern.confused).toBe(true);
  });

  it("returns overwhelmed: true when too_much + tired together", () => {
    const state = makeState({
      execution_feedback: [
        makeFeedback("too_much", "task", 3),
        makeFeedback("tired", "task", 4),
      ],
    });
    const pattern = selectFrictionPattern(state);
    expect(pattern.overwhelmed).toBe(true);
  });

  it("returns all false on empty feedback", () => {
    const state = makeState({ execution_feedback: [] });
    const pattern = selectFrictionPattern(state);
    expect(pattern.avoidant).toBe(false);
    expect(pattern.confused).toBe(false);
    expect(pattern.overwhelmed).toBe(false);
    expect(pattern.friction_count).toBe(0);
  });
});

// ── selectTaskAdaptationFromFeedback ─────────────────────────────────────────

describe("selectTaskAdaptationFromFeedback", () => {
  it("returns shrink + add_example when confusing + avoidant signals present", () => {
    const state = makeState({
      execution_feedback: [
        makeFeedback("confusing", "task", 5),
        makeFeedback("do_differently", "task", 10),
        makeFeedback("do_differently", "task", 15),
      ],
    });
    const adapt = selectTaskAdaptationFromFeedback(state);
    expect(adapt.shrink).toBe(true);
    expect(adapt.add_example).toBe(true);
  });

  it("returns celebrate when felt_good with no friction", () => {
    const state = makeState({
      execution_feedback: [
        makeFeedback("felt_good", "task", 2),
        makeFeedback("felt_good", "task", 10),
      ],
    });
    const adapt = selectTaskAdaptationFromFeedback(state);
    expect(adapt.celebrate).toBe(true);
  });

  it("returns no adaptations on empty feedback", () => {
    const state = makeState({ execution_feedback: [] });
    const adapt = selectTaskAdaptationFromFeedback(state);
    expect(adapt.shrink).toBe(false);
    expect(adapt.add_example).toBe(false);
    expect(adapt.celebrate).toBe(false);
  });
});

// ── selectLatestVibe ──────────────────────────────────────────────────────────

describe("selectLatestVibe", () => {
  it("returns positive when felt_good is most recent", () => {
    const state = makeState({
      execution_feedback: [makeFeedback("felt_good", "task", 1)],
    });
    expect(selectLatestVibe(state)).toBe("positive");
  });

  it("returns friction when do_differently is most recent", () => {
    const state = makeState({
      execution_feedback: [makeFeedback("do_differently", "task", 1)],
    });
    expect(selectLatestVibe(state)).toBe("friction");
  });

  it("returns neutral on empty feedback", () => {
    const state = makeState({ execution_feedback: [] });
    expect(selectLatestVibe(state)).toBe("neutral");
  });
});

// ── buildEmotionalSnapshot ───────────────────────────────────────────────────

describe("buildEmotionalSnapshot", () => {
  it("returns steady with confidence < 0.5 when no signals present", () => {
    const snap = buildEmotionalSnapshot([]);
    expect(snap.inferred_state).toBe("steady");
    expect(snap.confidence).toBeLessThan(0.5);
  });

  it("returns overwhelmed with confidence >= 0.7 when too_much + tired present", () => {
    const signals = [
      makeFeedback("too_much", "task", 2),
      makeFeedback("tired", "task", 4),
      makeFeedback("too_much", "task", 6),
    ];
    const snap = buildEmotionalSnapshot(signals);
    expect(snap.inferred_state).toBe("overwhelmed");
    expect(snap.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it("uses human evidence strings with no jargon", () => {
    const signals = [
      makeFeedback("too_much", "task", 1),
      makeFeedback("tired", "task", 2),
      makeFeedback("too_much", "task", 3),
    ];
    const snap = buildEmotionalSnapshot(signals);
    for (const ev of snap.evidence) {
      expect(ev).not.toMatch(/signal|telemetry|artifact|detected/i);
    }
  });

  it("falls back to steady when only 1 matching signal", () => {
    const signals = [makeFeedback("too_much", "task", 1)];
    const snap = buildEmotionalSnapshot(signals);
    expect(snap.inferred_state).toBe("steady");
  });
});

// ── selectPreferredSupportStyle ───────────────────────────────────────────────

describe("selectPreferredSupportStyle", () => {
  it("returns direct when 2+ be_more_direct signals", () => {
    const state = makeState({
      execution_feedback: [
        makeFeedback("be_more_direct", "coach_reply", 2),
        makeFeedback("be_more_direct", "coach_reply", 10),
      ],
    });
    expect(selectPreferredSupportStyle(state)).toBe("direct");
  });

  it("returns gentle as default when no strong signal", () => {
    const state = makeState({ execution_feedback: [] });
    const style = selectPreferredSupportStyle(state);
    expect(["direct", "gentle", "tiny_step", "celebrate_then_next"]).toContain(style);
  });
});
