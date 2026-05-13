/**
 * Single source of truth for the chat-coach context.
 * Every Chat call should pass this — it is what keeps Moment from asking
 * for things it already knows or losing the thread of execution.
 */
import type { MomentState } from "@/lib/types";
import { selectNextBestTask } from "@/lib/engine/next-best-task";

export interface ChatSnapshot {
  display_name: string;
  active_goal: { statement: string; why_it_matters: string; status: string };
  constraints_known: Record<string, string | number | boolean>;
  missing_schedule_info: string[];
  todays_plan: Array<{ time: string; title: string; status: string }>;
  next_move: { id: string; title: string; estimated_minutes: number } | null;
  recent_completed: Array<{ title: string; at: string }>;
  pending_count: number;
  recent_feedback: Array<{ feedback: string; task_title: string; at: string }>;
  recent_rescue: { reason: string; at: string } | null;
  latest_reflection: { date: string; energy: number; win: string; struggle: string } | null;
  active_plan: "plan_a" | "plan_b";
  forge_modules: Array<{ name: string; type: string; runs: number; last_entry?: string }>;
  tone_preference: string;
  // ─── Extended context: prevents redundant questions ────────────────────────
  user_age_bracket: string;
  user_school_year: string;
  user_academic_context: string;
  user_normal_weekday: string;
  onboarding_knowns: string[];
  onboarding_unknowns: string[];
  goal_current_stage: string;
  goal_target_stage: string;
  goal_reality_gap: string;
  goal_phase: string;
  goal_appropriate_focus: string[];
  goal_premature_tasks: string[];
  goal_risk: string;
  top_workstream: { name: string; status: string; bottleneck: string } | null;
  completed_tasks_count: number;
}

const SCHEDULE_FIELD_MAP: Array<[keyof MomentState["constraints"], string]> = [
  ["school_end_time", "school_end_time"],
  ["commute_minutes", "commute_minutes"],
  ["sleep_floor_time", "sleep_floor_time"],
  ["sleep_target_time", "sleep_target_time"],
  ["study_minutes_daily", "study_minutes_daily"],
  ["exercise_minutes_daily", "exercise_minutes_daily"],
];

function isAnswered(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === "number") return value > 0;
  if (typeof value === "string") return value.trim() !== "" && value !== "unknown";
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}

export function selectChatSnapshot(state: MomentState): ChatSnapshot {
  const c = state.constraints;
  const known: Record<string, string | number | boolean> = {};
  const missing: string[] = [];

  for (const [field] of SCHEDULE_FIELD_MAP) {
    const v = c[field] as unknown;
    if (isAnswered(v)) known[field as string] = v as string | number;
    else missing.push(field as string);
  }
  if (c.fixed_commitments_checked || (c.fixed_commitments?.length ?? 0) > 0) {
    known.fixed_commitments = c.fixed_commitments?.length ?? 0;
  } else {
    missing.push("fixed_commitments");
  }
  if (c.energy_pattern && c.energy_pattern !== "unknown") known.energy_pattern = c.energy_pattern;
  else missing.push("energy_pattern");

  const next = selectNextBestTask(state).best;
  const allDone = (state.tasks ?? []).filter((t) => t.status === "done" && t.completed_at);
  const completed = allDone
    .sort((a, b) => b.completed_at.localeCompare(a.completed_at))
    .slice(0, 5)
    .map((t) => ({ title: t.title, at: t.completed_at }));

  const pending = (state.tasks ?? []).filter((t) => t.status !== "done" && t.status !== "skipped").length;

  const fb = (state.execution_feedback ?? [])
    .slice(-10)
    .map((f) => ({ feedback: f.feedback, task_title: f.task_title || "", at: f.created_at }));

  const lastRescue = (state.rescue_signals ?? []).slice(-1)[0];
  const latestRefl = [...(state.reflections ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];

  const todays = (state.schedule_state?.day_plan ?? []).slice(0, 8).map((b) => ({
    time: `${b.start_time}–${b.end_time}`,
    title: b.title,
    status: b.status ?? "upcoming",
  }));

  const modules = (state.forge_state?.generated_modules ?? [])
    .filter((m: any) => m.status === "active")
    .map((m: any) => {
      const entries = m.entries ?? [];
      return {
        name: m.title || m.name,
        type: m.module_type,
        runs: entries.length,
        last_entry: entries.length ? entries[entries.length - 1].created_at : undefined,
      };
    });

  // ─── Extended context ──────────────────────────────────────────────────────
  const feasibility = state.active_goal?.feasibility;
  const pm = state.pursuit_model;
  const topWs = pm?.workstreams
    ?.filter((w) => w.status !== "complete")
    .sort((a, b) => {
      const p = { critical: 0, high: 1, medium: 2, low: 3 } as const;
      return (p[a.priority] ?? 4) - (p[b.priority] ?? 4);
    })[0];

  return {
    display_name: state.profile.display_name,
    active_goal: {
      statement: state.active_goal.statement,
      why_it_matters: state.active_goal.why_it_matters,
      status: state.active_goal.status,
    },
    constraints_known: known,
    missing_schedule_info: missing,
    todays_plan: todays,
    next_move: next ? { id: next.id, title: next.title, estimated_minutes: next.estimated_minutes } : null,
    recent_completed: completed,
    pending_count: pending,
    recent_feedback: fb,
    recent_rescue: lastRescue ? { reason: lastRescue.reason, at: lastRescue.created_at } : null,
    latest_reflection: latestRefl
      ? {
          date: latestRefl.date,
          energy: latestRefl.energy_rating,
          win: latestRefl.accomplishment || latestRefl.win || "",
          struggle: latestRefl.struggle || "",
        }
      : null,
    active_plan: state.home.active_plan,
    forge_modules: modules,
    tone_preference: state.chat_preferences?.tone ?? "default",
    // ─── Extended ────────────────────────────────────────────────────────────
    user_age_bracket: state.profile.age_bracket ?? "unknown",
    user_school_year: state.profile.school_year ?? "",
    user_academic_context: state.profile.academic_context ?? "",
    user_normal_weekday: state.profile.normal_weekday ?? "",
    onboarding_knowns: state.onboarding?.understanding?.knowns ?? [],
    onboarding_unknowns: state.onboarding?.understanding?.unknowns ?? [],
    goal_current_stage: state.active_goal.current_stage ?? "",
    goal_target_stage: state.active_goal.target_stage ?? "",
    goal_reality_gap: state.active_goal.reality_gap ?? "",
    goal_phase: state.active_goal.phase ?? "clarifying",
    goal_appropriate_focus: feasibility?.appropriate_focus_now ?? [],
    goal_premature_tasks: feasibility?.premature_recommendations ?? [],
    goal_risk: feasibility?.risk_of_bad_advice ?? "low",
    top_workstream: topWs
      ? { name: topWs.name, status: topWs.status, bottleneck: topWs.bottleneck ?? "" }
      : null,
    completed_tasks_count: allDone.length,
  };
}
