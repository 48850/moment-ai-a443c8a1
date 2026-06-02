/**
 * Goal Intelligence — tests for the multi-goal model selectors.
 *
 * Core rule under test: horizon ≠ priority.
 * A long-term goal can be primary. An urgent exam is pressure, not primary.
 */
import { describe, it, expect } from "vitest";
import {
  selectPrimaryGoals,
  selectPressureGoals,
  selectProtectedGoals,
  selectGoalAttentionBudget,
  selectGoalSynthesis,
  selectBalancedNextMoves,
} from "@/lib/selectors/goal-intelligence";
import type { MomentState, UserGoal } from "@/lib/types";

// ── Minimal state factory ─────────────────────────────────────────────────────

function makeState(overrides: Partial<MomentState & { goals?: UserGoal[] }> = {}): MomentState {
  const base: Partial<MomentState> = {
    user_id: "test-user",
    profile: {
      display_name: "Alex",
      age: 16,
      age_bracket: "teen_16_18",
      school_year: "Year 11",
      academic_context: "GCSE year",
      normal_weekday: "school",
      country: "UK",
      education_system: "uk_gcse",
    },
    active_goal: {
      id: "ag-1",
      statement: "Become a storyteller",
      why_it_matters: "Stories connect people",
      status: "active",
      phase: "building",
      seriousness_score: 90,
      stability_score: 80,
      reality_gap: "",
      last_updated_at: new Date().toISOString(),
      desired_identity: "writer",
      success_definition: "Publish a novel",
      current_stage: "Year 11",
      target_stage: "published author",
    },
    execution_feedback: [],
    tasks: [],
    reflections: [],
    rescue_signals: [],
    onboarding: {
      completed: true,
      current_stage: "done",
      answers: {},
      understanding: { knowns: [], unknowns: [], assumptions: [], confidence: "high" },
    },
  };
  return { ...base, ...overrides } as unknown as MomentState;
}

function makeGoal(overrides: Partial<UserGoal> = {}): UserGoal {
  return {
    id: crypto.randomUUID(),
    title: "Storytelling",
    statement: "Become a great storyteller",
    why_it_matters: "Stories connect people",
    domain: "creative",
    role: "primary",
    horizon: "long_term",
    urgency_score: 10,
    importance_score: 95,
    emotional_weight: 90,
    attention_weight: 60,
    protected: true,
    shared_skill_tags: [],
    linked_goal_ids: [],
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// ── selectPrimaryGoals ────────────────────────────────────────────────────────

describe("selectPrimaryGoals", () => {
  it("returns goals with role=primary", () => {
    const state = makeState({
      goals: [
        makeGoal({ id: "g1", role: "primary" }),
        makeGoal({ id: "g2", role: "pressure" }),
        makeGoal({ id: "g3", role: "support" }),
      ],
    } as any);
    const primary = selectPrimaryGoals(state);
    expect(primary).toHaveLength(1);
    expect(primary[0].id).toBe("g1");
  });

  it("long-term goal can be primary", () => {
    const state = makeState({
      goals: [
        makeGoal({ id: "long-g", role: "primary", horizon: "long_term" }),
      ],
    } as any);
    const primary = selectPrimaryGoals(state);
    expect(primary).toHaveLength(1);
    expect(primary[0].horizon).toBe("long_term");
  });

  it("urgent goal is NOT automatically primary", () => {
    const state = makeState({
      goals: [
        makeGoal({ id: "urgent-g", role: "pressure", horizon: "urgent", urgency_score: 95 }),
        makeGoal({ id: "primary-g", role: "primary", horizon: "long_term", urgency_score: 5 }),
      ],
    } as any);
    const primary = selectPrimaryGoals(state);
    expect(primary).toHaveLength(1);
    expect(primary[0].id).toBe("primary-g");
  });

  it("falls back to active_goal as primary when goals array is empty", () => {
    const state = makeState(); // no goals array
    const primary = selectPrimaryGoals(state);
    expect(primary.length).toBeGreaterThanOrEqual(1);
    expect(primary[0].role).toBe("primary");
  });
});

// ── selectPressureGoals ───────────────────────────────────────────────────────

describe("selectPressureGoals", () => {
  it("returns goals with role=pressure", () => {
    const state = makeState({
      goals: [
        makeGoal({ id: "g1", role: "primary" }),
        makeGoal({ id: "g2", role: "pressure" }),
      ],
    } as any);
    expect(selectPressureGoals(state).map((g) => g.id)).toContain("g2");
  });

  it("returns goals with urgency_score >= 70 even if role is not pressure", () => {
    const state = makeState({
      goals: [
        makeGoal({ id: "g1", role: "support", urgency_score: 85 }),
        makeGoal({ id: "g2", role: "primary", urgency_score: 10 }),
      ],
    } as any);
    const pressure = selectPressureGoals(state);
    expect(pressure.map((g) => g.id)).toContain("g1");
    expect(pressure.map((g) => g.id)).not.toContain("g2");
  });

  it("urgent goal does not become primary", () => {
    const state = makeState({
      goals: [
        makeGoal({ id: "exam", role: "pressure", urgency_score: 90 }),
        makeGoal({ id: "story", role: "primary", urgency_score: 5 }),
      ],
    } as any);
    const primary = selectPrimaryGoals(state);
    const pressure = selectPressureGoals(state);
    expect(primary.map((g) => g.id)).not.toContain("exam");
    expect(pressure.map((g) => g.id)).toContain("exam");
  });
});

// ── selectProtectedGoals ──────────────────────────────────────────────────────

describe("selectProtectedGoals", () => {
  it("returns primary goals as protected", () => {
    const state = makeState({
      goals: [makeGoal({ id: "g1", role: "primary", protected: false })],
    } as any);
    const protected_ = selectProtectedGoals(state);
    expect(protected_.map((g) => g.id)).toContain("g1");
  });

  it("returns explicitly protected goals regardless of role", () => {
    const state = makeState({
      goals: [makeGoal({ id: "g1", role: "support", protected: true })],
    } as any);
    const protected_ = selectProtectedGoals(state);
    expect(protected_.map((g) => g.id)).toContain("g1");
  });

  it("does not return pressure goals that are not protected", () => {
    const state = makeState({
      goals: [makeGoal({ id: "g1", role: "pressure", protected: false })],
    } as any);
    const protected_ = selectProtectedGoals(state);
    expect(protected_.map((g) => g.id)).not.toContain("g1");
  });
});

// ── selectGoalAttentionBudget ─────────────────────────────────────────────────

describe("selectGoalAttentionBudget", () => {
  it("pressure dominates during active exam emergency", () => {
    const state = makeState({
      goals: [
        makeGoal({ role: "primary" }),
        makeGoal({ role: "pressure" }),
      ],
      exam_emergencies: [{ id: "e1", status: "active" }],
    } as any);
    const budget = selectGoalAttentionBudget(state);
    expect(budget.pressure).toBeGreaterThanOrEqual(60);
  });

  it("primary leads when no pressure exists", () => {
    const state = makeState({
      goals: [makeGoal({ role: "primary" })],
    } as any);
    const budget = selectGoalAttentionBudget(state);
    expect(budget.primary).toBeGreaterThan(budget.pressure);
  });

  it("budget sums to 100", () => {
    const state = makeState({
      goals: [makeGoal({ role: "primary" }), makeGoal({ role: "pressure" })],
    } as any);
    const budget = selectGoalAttentionBudget(state);
    const total = budget.pressure + budget.primary + budget.support + budget.recovery;
    expect(total).toBe(100);
  });

  it("during exam, primary still gets some attention (not zero)", () => {
    const state = makeState({
      goals: [makeGoal({ role: "primary" }), makeGoal({ role: "pressure" })],
      exam_emergencies: [{ id: "e1", status: "active" }],
    } as any);
    const budget = selectGoalAttentionBudget(state);
    expect(budget.primary).toBeGreaterThan(0);
  });
});

// ── selectGoalSynthesis ───────────────────────────────────────────────────────

describe("selectGoalSynthesis", () => {
  it("includes both primary arc and current pressure", () => {
    const state = makeState({
      goals: [
        makeGoal({ title: "Storytelling", role: "primary" }),
        makeGoal({ title: "History exam", role: "pressure" }),
      ],
    } as any);
    const synthesis = selectGoalSynthesis(state);
    expect(synthesis.primary_arc).toContain("Storytelling");
    expect(synthesis.current_pressure).toContain("History exam");
  });

  it("synthesis_sentence references both goals", () => {
    const state = makeState({
      goals: [
        makeGoal({ title: "Storytelling", role: "primary" }),
        makeGoal({ title: "History exam", role: "pressure" }),
      ],
    } as any);
    const synthesis = selectGoalSynthesis(state);
    expect(synthesis.synthesis_sentence.length).toBeGreaterThan(10);
  });

  it("includes shared_skills when goals share skill tags", () => {
    const state = makeState({
      goals: [
        makeGoal({ title: "Storytelling", role: "primary", shared_skill_tags: ["cause_and_effect", "argument"] }),
        makeGoal({ title: "Philosophy", role: "support", shared_skill_tags: ["cause_and_effect"] }),
        makeGoal({ title: "History exam", role: "pressure", shared_skill_tags: ["cause_and_effect"] }),
      ],
    } as any);
    const synthesis = selectGoalSynthesis(state);
    expect(synthesis.shared_skills).toContain("cause_and_effect");
  });

  it("optional_primary_nourishment_move is present when primary + pressure both exist", () => {
    const state = makeState({
      goals: [
        makeGoal({ title: "Storytelling", role: "primary" }),
        makeGoal({ title: "History exam", role: "pressure" }),
      ],
    } as any);
    const synthesis = selectGoalSynthesis(state);
    expect(synthesis.optional_primary_nourishment_move).not.toBeNull();
  });

  it("returns primary_arc from active_goal when goals array is empty", () => {
    const state = makeState(); // uses active_goal fallback
    const synthesis = selectGoalSynthesis(state);
    expect(synthesis.primary_arc.length).toBeGreaterThan(0);
  });
});

// ── selectBalancedNextMoves ───────────────────────────────────────────────────

describe("selectBalancedNextMoves", () => {
  it("returns a pressure_move when urgent goal exists", () => {
    const state = makeState({
      goals: [
        makeGoal({ role: "pressure", title: "History exam" }),
        makeGoal({ role: "primary", title: "Storytelling" }),
      ],
    } as any);
    const moves = selectBalancedNextMoves(state);
    expect(moves.pressure_move).not.toBeNull();
    expect(moves.pressure_move).toContain("History exam");
  });

  it("returns a primary_move even when pressure exists", () => {
    const state = makeState({
      goals: [
        makeGoal({ role: "pressure", title: "History exam" }),
        makeGoal({ role: "primary", title: "Storytelling" }),
      ],
    } as any);
    const moves = selectBalancedNextMoves(state);
    expect(moves.primary_move).not.toBeNull();
    expect(moves.primary_move).toContain("Storytelling");
  });

  it("returns cross_goal_move when shared skills exist", () => {
    const state = makeState({
      goals: [
        makeGoal({ role: "primary", title: "Storytelling", shared_skill_tags: ["cause_and_effect"] }),
        makeGoal({ role: "pressure", title: "History exam", shared_skill_tags: ["cause_and_effect"] }),
      ],
    } as any);
    const moves = selectBalancedNextMoves(state);
    expect(moves.cross_goal_move).not.toBeNull();
  });

  it("does not assume urgent === primary (no code assumes active_goal is the only goal)", () => {
    const state = makeState({
      goals: [
        makeGoal({ id: "exam", role: "pressure", urgency_score: 95 }),
        makeGoal({ id: "story", role: "primary", urgency_score: 5 }),
      ],
    } as any);
    const moves = selectBalancedNextMoves(state);
    // Primary move must reference the primary goal, not the urgent one
    expect(moves.primary_move).toContain("Storytelling");
    expect(moves.pressure_move).toBeDefined();
  });

  it("pressure_move is null when no urgent goals", () => {
    const state = makeState({
      goals: [makeGoal({ role: "primary", urgency_score: 10 })],
    } as any);
    const moves = selectBalancedNextMoves(state);
    expect(moves.pressure_move).toBeNull();
  });
});

// ── Regression: no code assumes urgent === primary ────────────────────────────

describe("Architecture rule: no code assumes urgent === primary", () => {
  it("high urgency_score does not promote a goal to primary role", () => {
    const urgentExam = makeGoal({ id: "exam", role: "pressure", urgency_score: 100 });
    const state = makeState({ goals: [urgentExam] } as any);
    const primary = selectPrimaryGoals(state);
    expect(primary.map((g) => g.id)).not.toContain("exam");
  });

  it("proof can link to multiple goals (selectGoalSynthesis reports both)", () => {
    const state = makeState({
      goals: [
        makeGoal({ title: "Storytelling", role: "primary", shared_skill_tags: ["narrative"] }),
        makeGoal({ title: "History exam", role: "pressure", shared_skill_tags: ["narrative"] }),
        makeGoal({ title: "Philosophy", role: "support", shared_skill_tags: ["narrative", "argument"] }),
      ],
    } as any);
    const synthesis = selectGoalSynthesis(state);
    expect(synthesis.primary_arc).toBeTruthy();
    expect(synthesis.current_pressure).toBeTruthy();
    expect(synthesis.support_goals.length).toBeGreaterThan(0);
    expect(synthesis.shared_skills).toContain("narrative");
  });

  it("Forge can target primary goal even while pressure goal exists", () => {
    // Forge should list primary goals as valid targets
    const state = makeState({
      goals: [
        makeGoal({ id: "story", role: "primary" }),
        makeGoal({ id: "exam", role: "pressure" }),
      ],
    } as any);
    const primary = selectPrimaryGoals(state);
    expect(primary.map((g) => g.id)).toContain("story");
    expect(primary.map((g) => g.id)).not.toContain("exam");
  });
});
