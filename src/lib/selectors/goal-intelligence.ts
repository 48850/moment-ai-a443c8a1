/**
 * Goal Intelligence — pure selectors for the multi-goal model.
 *
 * Core doctrine: horizon ≠ priority.
 * A medium/long-term goal can be primary.
 * Urgency selects the pressure goal, not the primary goal.
 *
 * Primary decides what the app is really serving.
 * Pressure decides what needs attention today.
 */
import type { MomentState, UserGoal, GoalRole } from "@/lib/types";

// ── Private helpers ───────────────────────────────────────────────────────────

function getGoals(state: MomentState): UserGoal[] {
  return (state as any).goals ?? [];
}

/**
 * If the goals array is empty but active_goal has a statement,
 * derive a synthetic primary UserGoal from active_goal.
 * This ensures backward compat without data migration.
 */
function resolveGoals(state: MomentState): UserGoal[] {
  const goals = getGoals(state);
  if (goals.length > 0) return goals;

  const ag = state.active_goal;
  if (!ag?.statement?.trim()) return [];

  const answers = (state.onboarding?.answers ?? {}) as Record<string, string>;

  // Synthesise up to 3 goals from onboarding answers
  const derived: UserGoal[] = [];
  const now = new Date().toISOString();

  if (answers.long_term_goal?.trim()) {
    derived.push({
      id: "derived_long",
      title: answers.long_term_goal.slice(0, 80),
      statement: answers.long_term_goal,
      why_it_matters: answers.why_it_matters ?? ag.why_it_matters ?? "",
      domain: "",
      role: "primary",
      horizon: "long_term",
      urgency_score: 10,
      importance_score: 90,
      emotional_weight: 80,
      attention_weight: 60,
      protected: true,
      shared_skill_tags: [],
      linked_goal_ids: [],
      created_at: now,
    });
  }

  if (answers.medium_term_goal?.trim()) {
    derived.push({
      id: "derived_medium",
      title: answers.medium_term_goal.slice(0, 80),
      statement: answers.medium_term_goal,
      why_it_matters: "",
      domain: "",
      role: "support",
      horizon: "medium_term",
      urgency_score: 30,
      importance_score: 70,
      emotional_weight: 60,
      attention_weight: 25,
      protected: false,
      shared_skill_tags: [],
      linked_goal_ids: derived.length > 0 ? ["derived_long"] : [],
      created_at: now,
    });
  }

  if (answers.short_term_goal?.trim()) {
    derived.push({
      id: "derived_short",
      title: answers.short_term_goal.slice(0, 80),
      statement: answers.short_term_goal,
      why_it_matters: "",
      domain: "",
      role: "pressure",
      horizon: "short_term",
      urgency_score: 70,
      importance_score: 60,
      emotional_weight: 40,
      attention_weight: 15,
      protected: false,
      shared_skill_tags: [],
      linked_goal_ids: [],
      created_at: now,
    });
  }

  // If nothing from onboarding answers, use active_goal as primary
  if (derived.length === 0) {
    derived.push({
      id: "derived_primary",
      title: ag.statement.slice(0, 80),
      statement: ag.statement,
      why_it_matters: ag.why_it_matters ?? "",
      domain: "",
      role: "primary",
      horizon: "long_term",
      urgency_score: 10,
      importance_score: 90,
      emotional_weight: 80,
      attention_weight: 60,
      protected: true,
      shared_skill_tags: [],
      linked_goal_ids: [],
      created_at: now,
    });
  }

  return derived;
}

// ── Public selectors ──────────────────────────────────────────────────────────

/**
 * Goals with role="primary".
 * Independent of horizon — a long-term goal can be primary.
 */
export function selectPrimaryGoals(state: MomentState): UserGoal[] {
  return resolveGoals(state).filter((g) => g.role === "primary");
}

/**
 * Urgent goals — role="pressure" or urgency_score >= 70.
 * An exam due tomorrow is pressure, not primary.
 */
export function selectPressureGoals(state: MomentState): UserGoal[] {
  return resolveGoals(state).filter(
    (g) => g.role === "pressure" || g.urgency_score >= 70,
  );
}

/**
 * Goals that must remain visible even during high-pressure periods.
 * Primary goals + goals explicitly marked protected.
 */
export function selectProtectedGoals(state: MomentState): UserGoal[] {
  return resolveGoals(state).filter(
    (g) => g.role === "primary" || g.protected,
  );
}

export interface GoalAttentionBudget {
  pressure: number;   // % of attention for urgent goals
  primary: number;    // % for what matters most
  support: number;    // % for supporting goals
  recovery: number;   // % reserved for rest / recovery
}

/**
 * Suggested attention split based on current goal roles and urgency.
 * During exam emergency: pressure dominates but primary is preserved.
 * Normal week: primary leads.
 */
export function selectGoalAttentionBudget(state: MomentState): GoalAttentionBudget {
  const goals = resolveGoals(state);
  const hasPressure = goals.some((g) => g.role === "pressure" || g.urgency_score >= 70);
  const hasPrimary = goals.some((g) => g.role === "primary");
  const hasSupport = goals.some((g) => g.role === "support");

  // Active exam emergency boosts pressure further
  const activeExam = ((state as any).exam_emergencies ?? []).some(
    (e: any) => e.status === "active",
  );

  if (activeExam) {
    return { pressure: 70, primary: 20, support: 5, recovery: 5 };
  }
  if (hasPressure) {
    return { pressure: 50, primary: 30, support: 15, recovery: 5 };
  }
  if (hasPrimary && hasSupport) {
    return { pressure: 10, primary: 60, support: 25, recovery: 5 };
  }
  if (hasPrimary) {
    return { pressure: 5, primary: 75, support: 10, recovery: 10 };
  }
  return { pressure: 20, primary: 50, support: 20, recovery: 10 };
}

export interface GoalSynthesis {
  primary_arc: string;
  current_pressure: string | null;
  support_goals: string[];
  shared_skills: string[];
  synthesis_sentence: string;
  today_main_move: string | null;
  optional_primary_nourishment_move: string | null;
}

/**
 * Cross-goal synthesis. The key insight: pressure goals often share skills
 * with primary goals. Working on History trains cause/effect — the same
 * skill storytelling needs. Moment surfaces this connection.
 */
export function selectGoalSynthesis(state: MomentState): GoalSynthesis {
  const goals = resolveGoals(state);
  const primary = goals.find((g) => g.role === "primary");
  const pressure = goals.find((g) => g.role === "pressure" || g.urgency_score >= 70);
  const support = goals.filter((g) => g.role === "support");

  const primaryArc = primary?.title ?? primary?.statement?.slice(0, 80) ?? state.active_goal?.statement?.slice(0, 80) ?? "";
  const pressureTitle = pressure?.title ?? pressure?.statement?.slice(0, 80) ?? null;

  // Collect shared skill tags across all goals
  const allSkillTags = goals.flatMap((g) => g.shared_skill_tags ?? []);
  const uniqueSkills = [...new Set(allSkillTags)];

  // Derive a synthesis sentence
  let synthesisSentence = "";
  if (primary && pressure && uniqueSkills.length > 0) {
    synthesisSentence = `${pressureTitle} trains ${uniqueSkills.slice(0, 2).join(" and ")} — the same skills your ${primaryArc} needs.`;
  } else if (primary && pressure) {
    synthesisSentence = `${pressureTitle} is the pressure today. ${primaryArc} is still the arc.`;
  } else if (primary) {
    synthesisSentence = `Building towards: ${primaryArc}.`;
  } else {
    synthesisSentence = "";
  }

  // Today's main move comes from pressure goal, or primary if no pressure
  const nextBestTask = state.today_state?.decisive_move ?? null;
  const todayMainMove = nextBestTask
    ? nextBestTask
    : pressure
      ? `Focus on ${pressureTitle} today.`
      : primary
        ? `Make one move towards ${primaryArc}.`
        : null;

  // Optional primary nourishment — small move to keep primary arc alive during pressure
  const nurturePrimary = pressure && primary
    ? `5–15 min: turn one ${pressureTitle?.split(" ").slice(0, 2).join(" ") ?? "idea"} into a story beat or question for your ${primaryArc} work.`
    : null;

  return {
    primary_arc: primaryArc,
    current_pressure: pressureTitle,
    support_goals: support.map((g) => g.title || g.statement.slice(0, 60)),
    shared_skills: uniqueSkills,
    synthesis_sentence: synthesisSentence,
    today_main_move: todayMainMove,
    optional_primary_nourishment_move: nurturePrimary,
  };
}

export interface BalancedNextMoves {
  pressure_move: string | null;
  primary_move: string | null;
  cross_goal_move: string | null;
  synthesis_sentence: string;
}

/**
 * Returns one move per category: pressure, primary, cross-goal (shared skill).
 * All three can be present. The pressure move is not the only move.
 */
export function selectBalancedNextMoves(state: MomentState): BalancedNextMoves {
  const synthesis = selectGoalSynthesis(state);
  const goals = resolveGoals(state);
  const pressure = goals.find((g) => g.role === "pressure" || g.urgency_score >= 70);
  const primary = goals.find((g) => g.role === "primary");

  const pressureMove = pressure
    ? `Focus on ${pressure.title || pressure.statement.slice(0, 60)} — it needs attention now.`
    : null;

  const primaryMove = primary
    ? `Keep building: ${primary.title || primary.statement.slice(0, 60)}.`
    : null;

  const crossGoalMove =
    synthesis.shared_skills.length > 0 && pressure && primary
      ? `${pressure.title?.split(" ").slice(0, 3).join(" ") ?? "This work"} also trains ${synthesis.shared_skills[0]} — a skill your ${primary.title ?? primary.statement.slice(0, 40)} needs.`
      : null;

  return {
    pressure_move: pressureMove,
    primary_move: primaryMove,
    cross_goal_move: crossGoalMove,
    synthesis_sentence: synthesis.synthesis_sentence,
  };
}

/**
 * Compact prompt-ready block for the coach system prompt.
 * Replaces the flat "active_goal" reference.
 */
export function renderGoalSynthesisForPrompt(state: MomentState): string {
  const synthesis = selectGoalSynthesis(state);
  const budget = selectGoalAttentionBudget(state);
  const lines: string[] = [];

  if (synthesis.primary_arc) lines.push(`PRIMARY ARC: ${synthesis.primary_arc}`);
  if (synthesis.current_pressure) lines.push(`CURRENT PRESSURE: ${synthesis.current_pressure}`);
  if (synthesis.support_goals.length) lines.push(`SUPPORT: ${synthesis.support_goals.join(" | ")}`);
  if (synthesis.shared_skills.length) lines.push(`SHARED SKILLS: ${synthesis.shared_skills.join(", ")}`);
  if (synthesis.synthesis_sentence) lines.push(`SYNTHESIS: ${synthesis.synthesis_sentence}`);
  lines.push(`ATTENTION BUDGET: pressure ${budget.pressure}% · primary ${budget.primary}% · support ${budget.support}%`);
  lines.push("RULE: Never speak as if the pressure goal is the whole user. Keep the primary arc alive.");

  return lines.join("\n");
}
