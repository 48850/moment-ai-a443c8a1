import type { MomentState } from "@/lib/types";
import { COACH_SCENARIOS, type CoachScenario } from "./scenarios";

export interface MatchedScenario {
  scenario: CoachScenario;
  score: number;
  reasons: string[];
}

/**
 * Score every scenario against the live state. Higher score = stronger pattern
 * match. Returned sorted, top first. Used to feed AI calls with the 1–2
 * scenarios most relevant to the user right now.
 */
export function matchScenarios(state: MomentState | null, limit = 2): MatchedScenario[] {
  if (!state) return [];

  const goalText = `${state.active_goal?.statement ?? ""} ${state.active_goal?.why_it_matters ?? ""}`.toLowerCase();
  const hasGoal = (state.active_goal?.statement ?? "").trim().length > 0;
  const recentFeedback = (state.execution_feedback ?? []).slice(-25).map((f) => f.feedback);
  const recentRescue = (state.rescue_signals ?? []).some((r) => {
    const ts = new Date(r.created_at).getTime();
    return Date.now() - ts < 7 * 86_400_000;
  });
  const overload = recentFeedback.filter((f) => ["too_much_today", "overwhelmed", "tired"].includes(f)).length >= 3;
  const lowVelocity = (() => {
    const done = (state.tasks ?? []).filter((t) => t.status === "done" && t.completed_at);
    const last7 = done.filter((t) => Date.now() - new Date(t.completed_at).getTime() < 7 * 86_400_000).length;
    const total = (state.tasks ?? []).length;
    return total >= 5 && last7 <= 1;
  })();

  const matches: MatchedScenario[] = COACH_SCENARIOS.map((s) => {
    let score = 0;
    const reasons: string[] = [];

    if (s.triggers.goal_keywords) {
      const hit = s.triggers.goal_keywords.find((k) => goalText.includes(k));
      if (hit) { score += 40; reasons.push(`goal mentions "${hit}"`); }
    }
    if (s.triggers.feedback_signals) {
      const overlap = s.triggers.feedback_signals.filter((f) => (recentFeedback as string[]).includes(f));
      if (overlap.length > 0) { score += overlap.length * 12; reasons.push(`recent feedback: ${overlap.join(", ")}`); }
    }
    if (s.triggers.needs_recent_rescue && recentRescue) { score += 25; reasons.push("rescue used in last 7d"); }
    if (s.triggers.needs_high_overload && overload) { score += 20; reasons.push("overload signals stacking"); }
    if (s.triggers.needs_low_velocity && lowVelocity) { score += 18; reasons.push("low task velocity"); }
    if (s.triggers.needs_no_goal && !hasGoal) { score += 30; reasons.push("no clear goal yet"); }

    return { scenario: s, score, reasons };
  })
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score);

  return matches.slice(0, limit);
}

/**
 * Compact JSON-friendly summary suitable for stuffing into AI prompts.
 */
export function scenarioBrief(matched: MatchedScenario[]) {
  return matched.map((m) => ({
    label: m.scenario.label,
    inferred_bottleneck: m.scenario.inferred_bottleneck,
    probe: m.scenario.probe,
    correct_behaviour: m.scenario.correct_behaviour,
    forge_features: m.scenario.forge_features,
    why_matched: m.reasons,
  }));
}
