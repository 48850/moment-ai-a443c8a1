/**
 * Audit-derived metrics. ALL fields come from the unified MomentState — never
 * hardcoded constants. This is what makes Audit a real instrument.
 */
import type { MomentState } from "@/lib/types";

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
