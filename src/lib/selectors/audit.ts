/**
 * Audit-derived metrics. ALL fields come from the unified MomentState — never
 * hardcoded constants. This is what makes Audit a real instrument.
 */
import type { MomentState } from "@/lib/types";

// ─── Stall detection ──────────────────────────────────────────────────────────

export type StallType =
  | "task_too_vague"
  | "task_too_large"
  | "low_energy"
  | "needs_clarity"
  | "fear_of_failure"
  | "capacity_threshold"
  | "wrong_conditions"
  | "unclear";

export interface StallPattern {
  stall_type: StallType;
  label: string;
  evidence_chips: string[];
  confidence: "high" | "medium" | "low";
}

export function computeStallPattern(state: MomentState): StallPattern {
  const fb = state.execution_feedback ?? [];
  const bd: Record<string, number> = {};
  fb.forEach((f) => { bd[f.feedback] = (bd[f.feedback] ?? 0) + 1; });

  const rescue = state.rescue_signals ?? [];
  const rescueRecent = rescue.filter((r) => Date.now() - new Date(r.created_at).getTime() <= 7 * 86400_000).length;

  const tooVague = bd.too_vague ?? 0;
  const tooBig = bd.too_big ?? 0;
  const tired = (bd.tired ?? 0) + (bd.overwhelmed ?? 0);
  const needHelp = (bd.need_help ?? 0) + (bd.dont_understand ?? 0);
  const fearful = bd.feels_unrealistic ?? 0;
  const wrongTime = bd.wrong_time ?? 0;

  if (rescueRecent >= 2) {
    return {
      stall_type: "capacity_threshold",
      label: "Capacity threshold hit",
      evidence_chips: [
        `${rescueRecent} rescue calls this week`,
        ...(tired > 0 ? [`${tired}× tired/overwhelmed`] : []),
      ],
      confidence: rescueRecent >= 3 ? "high" : "medium",
    };
  }
  if (tooVague >= 2) {
    return {
      stall_type: "task_too_vague",
      label: "Tasks are too vague to start",
      evidence_chips: [`${tooVague}× too vague`, "first step not defined"],
      confidence: tooVague >= 3 ? "high" : "medium",
    };
  }
  if (tooBig >= 2) {
    return {
      stall_type: "task_too_large",
      label: "Tasks are too large to start",
      evidence_chips: [`${tooBig}× too big`, "plan over-scoped"],
      confidence: tooBig >= 3 ? "high" : "medium",
    };
  }
  if (tired >= 2) {
    return {
      stall_type: "low_energy",
      label: "Energy is consistently low",
      evidence_chips: [`${tired}× tired/overwhelmed`],
      confidence: tired >= 3 ? "high" : "medium",
    };
  }
  if (needHelp >= 2) {
    return {
      stall_type: "needs_clarity",
      label: "Stuck on understanding",
      evidence_chips: [`${needHelp}× need help / don't understand`],
      confidence: needHelp >= 3 ? "high" : "medium",
    };
  }
  if (fearful >= 2) {
    return {
      stall_type: "fear_of_failure",
      label: "Fear of failure is blocking action",
      evidence_chips: [`${fearful}× feels unrealistic`],
      confidence: "medium",
    };
  }
  if (wrongTime >= 1) {
    return {
      stall_type: "wrong_conditions",
      label: "Wrong time or conditions",
      evidence_chips: [`${wrongTime}× wrong time`],
      confidence: wrongTime >= 2 ? "medium" : "low",
    };
  }
  return {
    stall_type: "unclear",
    label: "No clear stall pattern yet",
    evidence_chips: [],
    confidence: "low",
  };
}

export interface AuditMetrics {
  // Tasks
  tasks_total: number;
  tasks_done: number;
  tasks_done_today: number;
  tasks_skipped: number;
  task_completion_pct: number;
  // Reflections
  reflections_7d: number;
  avg_energy_7d: number; // 0 when no data
  // Plan
  active_plan: "plan_a" | "plan_b";
  plan_b_active: boolean;
  // Rescue
  rescue_signals_total: number;
  rescue_signals_7d: number;
  most_recent_rescue: string | null;
  // Feedback
  feedback_total: number;
  most_common_feedback: string | null;
  most_common_feedback_count: number;
  feedback_breakdown: Record<string, number>;
  // Forge
  forge_modules_active: number;
  forge_entries_total: number;
  forge_entries_7d: number;
  // Friction hypothesis derived from feedback
  bottleneck_hypothesis: string;
  recommended_adjustment: string;
}

const WEEK_MS = 7 * 86400_000;
const todayString = () => new Date().toISOString().slice(0, 10);

export function selectAuditMetrics(state: MomentState): AuditMetrics {
  const tasks = state.tasks ?? [];
  const today = todayString();
  const done = tasks.filter((t) => t.status === "done");
  const doneToday = done.filter((t) => (t.completed_at || "").slice(0, 10) === today).length;
  const skipped = tasks.filter((t) => t.status === "skipped").length;

  const reflections = state.reflections ?? [];
  const recentReflections = reflections.filter((r) => Date.now() - new Date(r.date).getTime() <= WEEK_MS);
  const avgEnergy = recentReflections.length
    ? Math.round((recentReflections.reduce((a, r) => a + r.energy_rating, 0) / recentReflections.length) * 10) / 10
    : 0;

  const fb = state.execution_feedback ?? [];
  const breakdown: Record<string, number> = {};
  fb.forEach((f) => {
    breakdown[f.feedback] = (breakdown[f.feedback] ?? 0) + 1;
  });
  const sortedFb = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
  const mostCommon = sortedFb[0];

  const rescue = state.rescue_signals ?? [];
  const rescueRecent = rescue.filter((r) => Date.now() - new Date(r.created_at).getTime() <= WEEK_MS).length;

  const modules = (state.forge_state?.generated_modules ?? []) as any[];
  const active = modules.filter((m) => m.status === "active");
  const allEntries = active.flatMap((m) => m.entries ?? []);
  const entries7d = allEntries.filter((e: any) => Date.now() - new Date(e.created_at).getTime() <= WEEK_MS).length;

  // Bottleneck hypothesis
  const bigCount = breakdown.too_big ?? 0;
  const vagueCount = breakdown.too_vague ?? 0;
  const tiredCount = (breakdown.tired ?? 0) + (breakdown.overwhelmed ?? 0);
  const wrongTime = breakdown.wrong_time ?? 0;
  let hypothesis = "Not enough signal yet — keep tapping Tune as you work.";
  let recommendation = "Try one task today and tap Tune honestly. Even one chip helps.";

  if (rescueRecent >= 2) {
    hypothesis = "Rescue keeps firing — capacity is the constraint, not commitment.";
    recommendation = "Cut today's plan to one meaningful move and protect sleep. Heavy work returns when energy does.";
  } else if (bigCount >= 2 && bigCount >= vagueCount) {
    hypothesis = "Tasks keep landing as too big. The plan is over-scoped, not the goal.";
    recommendation = "Halve every estimated time. Lead each task with a 10-minute first step.";
  } else if (vagueCount >= 2) {
    hypothesis = "Tasks keep landing as vague. The first physical step isn't defined.";
    recommendation = "In chat, ask Moment to turn each pending task into one concrete first action.";
  } else if (tiredCount >= 2) {
    hypothesis = "Energy is consistently low when the plan starts.";
    recommendation = "Move heavy work to your peak window. Use Rescue when you feel it slipping.";
  } else if (wrongTime >= 2) {
    hypothesis = "The placement of work, not the work itself, is the problem.";
    recommendation = "Stop scheduling deep work in this window. Reform the plan around your real energy curve.";
  } else if (done.length > 0 && fb.length === 0) {
    hypothesis = "You're shipping but not tuning. Moment is flying blind on what's working.";
    recommendation = "Tap Tune on the next 3 tasks — even one chip per task changes future picks.";
  }

  return {
    tasks_total: tasks.length,
    tasks_done: done.length,
    tasks_done_today: doneToday,
    tasks_skipped: skipped,
    task_completion_pct: tasks.length ? Math.round((done.length / tasks.length) * 100) : 0,
    reflections_7d: recentReflections.length,
    avg_energy_7d: avgEnergy,
    active_plan: state.home.active_plan,
    plan_b_active: state.home.active_plan === "plan_b",
    rescue_signals_total: rescue.length,
    rescue_signals_7d: rescueRecent,
    most_recent_rescue: rescue.length ? rescue[rescue.length - 1].reason : null,
    feedback_total: fb.length,
    most_common_feedback: mostCommon ? mostCommon[0] : null,
    most_common_feedback_count: mostCommon ? mostCommon[1] : 0,
    feedback_breakdown: breakdown,
    forge_modules_active: active.length,
    forge_entries_total: allEntries.length,
    forge_entries_7d: entries7d,
    bottleneck_hypothesis: hypothesis,
    recommended_adjustment: recommendation,
  };
}
