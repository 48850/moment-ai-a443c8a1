/**
 * Single source of truth for the chat-coach context.
 * Every Chat call should pass this — it is what keeps Moment from asking
 * for things it already knows or losing the thread of execution.
 */
import type { MomentState, ChatMessage } from "@/lib/types";
import { selectNextBestTask } from "@/lib/engine/next-best-task";
import { buildLearningPortfolio } from "@/lib/ai/learning-portfolio";

function horizonFromState(state: MomentState, key: "long" | "medium" | "short") {
  const answers = state.onboarding?.answers ?? {};
  const answerKey = key === "long" ? "long_term_goal" : key === "medium" ? "medium_term_goal" : "short_term_goal";
  const direct = answers[answerKey];
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const source = [state.active_goal.statement, state.active_goal.success_definition].filter(Boolean).join("\n");
  const label = key === "long" ? "Long-term" : key === "medium" ? "Medium-term" : "Short-term";
  const match = source.match(new RegExp(`${label}:\\s*([^\\n|·]+?)(?=\\s*\\||$)`, "i"));
  if (match?.[1]?.trim()) return match[1].trim();
  return key === "long" ? state.active_goal.statement : "";
}

export interface ChatSnapshot {
  display_name: string;
  profile: {
    age: number;
    age_bracket: string;
    school_year: string;
    academic_context: string;
    normal_weekday: string;
    onboarded: boolean;
  };
  active_goal: { statement: string; long_term_goal: string; medium_term_goal: string; short_term_goal: string; why_it_matters: string; status: string };
  task_notes_context?: Array<{
    task_id: string;
    task_title: string;
    notes: Array<{ content: string; created_at: string }>;
    latest_review?: unknown;
  }>;
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
  onboarding_answers: Record<string, string>;
  goal_current_stage: string;
  goal_target_stage: string;
  goal_reality_gap: string;
  goal_phase: string;
  goal_appropriate_focus: string[];
  goal_premature_tasks: string[];
  goal_risk: string;
  top_workstream: { name: string; status: string; bottleneck: string } | null;
  completed_tasks_count: number;
  recent_chat: Array<{ role: "user" | "assistant"; content: string }>;
  country: string;
  education_system: string;
  // ─── Omnipotent chat: lets the model target real entities ─────────────────
  pending_tasks: Array<{ id: string; title: string; minutes: number; priority: string }>;
  week_blocks: Array<{ id: string; day_index: number; start_time: string; end_time: string; title: string; category: string; is_locked: boolean }>;
  learning_portfolio: ReturnType<typeof buildLearningPortfolio>;
  // ─── Portfolio snapshot: state-aware coaching context ─────────────────────
  portfolio: {
    completed_today: Array<{ id: string; title: string; at: string }>;
    completed_today_count: number;
    pending_today_count: number;
    overdue_tasks: Array<{ id: string; title: string; due_date: string; minutes: number }>;
    missed_tasks_recent: Array<{ id: string; title: string }>;
    current_block: { id: string; title: string; start_time: string; end_time: string; status: string } | null;
    next_block: { id: string; title: string; start_time: string; end_time: string } | null;
    schedule_pressure: "low" | "moderate" | "high" | "critical";
    pressure_reason: string;
    top_pressure_task: { id: string; title: string; minutes: number; priority: string } | null;
    repeated_friction_tags: Array<{ tag: string; count: number }>;
    alignment_status: string;
    drift_score: number;
    constellation_status: { current_bottleneck: string; decisive_move: string } | null;
    recommended_next_move: { id: string; title: string; minutes: number } | null;
  };
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

function timeToMinutes(hhmm: string): number {
  if (!hhmm || !hhmm.includes(":")) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function selectChatSnapshot(state: MomentState): ChatSnapshot {
  const c = state.constraints;
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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

  const pendingTodayTasks = (state.tasks ?? []).filter(
    (t) => t.status !== "done" && t.status !== "skipped" && (!t.due_date || t.due_date === today),
  );
  const pending = pendingTodayTasks.length;

  const fb = (state.execution_feedback ?? [])
    .slice(-10)
    .map((f) => ({ feedback: f.feedback, task_title: f.task_title || "", at: f.created_at }));

  const lastRescue = (state.rescue_signals ?? []).slice(-1)[0];
  const latestRefl = [...(state.reflections ?? [])].sort((a, b) => b.date.localeCompare(a.date))[0];

  const todays = (state.schedule_state?.day_plan ?? []).slice(0, 3).map((b) => ({
    time: `${b.start_time}–${b.end_time}`,
    title: b.title,
    status: b.status ?? "upcoming",
  }));

  const modules = (state.forge_state?.generated_modules ?? [])
    .filter((m) => (m as { status?: string }).status === "active")
    .map((m) => {
      const mod = m as { title?: string; name?: string; module_type?: string; entries?: Array<{ created_at: string }> };
      const entries = mod.entries ?? [];
      return {
        name: mod.title || mod.name || "",
        type: mod.module_type || "",
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
    profile: {
      age: state.profile.age ?? 0,
      age_bracket: state.profile.age_bracket ?? "unknown",
      school_year: state.profile.school_year ?? "",
      academic_context: state.profile.academic_context ?? "",
      normal_weekday: state.profile.normal_weekday ?? "",
      onboarded: !!state.onboarding?.completed,
    },
    active_goal: {
      statement: state.active_goal.statement,
      long_term_goal: horizonFromState(state, "long"),
      medium_term_goal: horizonFromState(state, "medium"),
      short_term_goal: horizonFromState(state, "short"),
      why_it_matters: state.active_goal.why_it_matters,
      status: state.active_goal.status,
    },
    task_notes_context: (state.tasks ?? [])
      .filter((t) => (t.notes?.length ?? 0) > 0 || t.note_review)
      .slice(-10)
      .map((t) => ({
        task_id: t.id,
        task_title: t.title,
        notes: (t.notes ?? []).slice(-4).map((n) => ({ content: n.content, created_at: n.created_at })),
        latest_review: t.note_review,
      })),
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
    onboarding_answers: (state.onboarding?.answers ?? {}) as Record<string, string>,
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
    recent_chat: (state.chat_messages ?? [])
      .slice(-10)
      .filter((m): m is ChatMessage & { role: "user" | "assistant" } => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content })),
    country: state.profile.country ?? "",
    education_system: state.profile.education_system ?? "unknown",
    pending_tasks: pendingTodayTasks
      .slice(0, 30)
      .map((t) => ({
        id: t.id,
        title: t.title,
        minutes: t.estimated_minutes ?? 30,
        priority: t.priority ?? "medium",
      })),
    week_blocks: (state.schedule_state?.week_plan ?? []).map((b) => ({
      id: b.id,
      day_index: b.day_index,
      start_time: b.start_time,
      end_time: b.end_time,
      title: b.title,
      category: b.category,
      is_locked: !!b.is_locked,
    })),
    learning_portfolio: buildLearningPortfolio(state),
    portfolio: buildPortfolioSnapshot(state, today, next),
  };
}

// ─── Portfolio snapshot: state-aware coaching context ────────────────────────
function buildPortfolioSnapshot(
  state: MomentState,
  today: string,
  nextMove: ReturnType<typeof selectNextBestTask>["best"],
): ChatSnapshot["portfolio"] {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const tasks = state.tasks ?? [];
  const feedback = state.execution_feedback ?? [];
  const dayPlan = state.schedule_state?.day_plan ?? [];

  // Completed today
  const completedTodayList = tasks
    .filter((t) => t.status === "done" && t.completed_at && t.completed_at.slice(0, 10) === today)
    .map((t) => ({ id: t.id, title: t.title, at: t.completed_at }));

  // Pending today
  const pendingToday = tasks.filter(
    (t) => t.status !== "done" && t.status !== "skipped" && (!t.due_date || t.due_date.slice(0, 10) === today),
  );

  // Overdue tasks (pending with due_date in past)
  const overdue = tasks
    .filter(
      (t) =>
        t.status !== "done" &&
        t.status !== "skipped" &&
        t.due_date &&
        t.due_date.slice(0, 10) < today,
    )
    .slice(0, 8)
    .map((t) => ({
      id: t.id,
      title: t.title,
      due_date: t.due_date,
      minutes: t.estimated_minutes ?? 30,
    }));

  // Missed-recent: prior days that have been skipped or expired without completion
  const missedRecent = tasks
    .filter((t) => t.status === "skipped" || (t.status !== "done" && t.due_date && t.due_date.slice(0, 10) < today))
    .slice(-6)
    .map((t) => ({ id: t.id, title: t.title }));

  // Current and next block
  const currentBlock =
    dayPlan.find((b) => {
      const start = timeToMinutes(b.start_time);
      const end = timeToMinutes(b.end_time);
      return currentMinutes >= start && currentMinutes < end;
    }) ?? null;
  const nextBlock = dayPlan.find((b) => timeToMinutes(b.start_time) > currentMinutes) ?? null;

  // Schedule pressure
  const totalPendingMinutes = pendingToday.reduce(
    (sum, t) => sum + (t.estimated_minutes ?? 30),
    0,
  );
  const remainingMinutesToday = Math.max(0, 22 * 60 - currentMinutes);
  let pressure: ChatSnapshot["portfolio"]["schedule_pressure"] = "low";
  if (totalPendingMinutes > remainingMinutesToday * 1.5) pressure = "critical";
  else if (totalPendingMinutes > remainingMinutesToday) pressure = "high";
  else if (totalPendingMinutes > remainingMinutesToday * 0.7) pressure = "moderate";

  const pressureReason =
    pressure === "low"
      ? "plan fits in remaining time"
      : `${pendingToday.length} pending · ~${totalPendingMinutes}m work vs ~${remainingMinutesToday}m left`;

  // Top pressure task: highest priority + closest deadline
  const priorityRank: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const topPressure = [...pendingToday]
    .sort((a, b) => {
      const pa = priorityRank[a.priority] ?? 3;
      const pb = priorityRank[b.priority] ?? 3;
      if (pa !== pb) return pa - pb;
      return (a.due_date || "9999").localeCompare(b.due_date || "9999");
    })[0];
  const topPressureTask = topPressure
    ? {
        id: topPressure.id,
        title: topPressure.title,
        minutes: topPressure.estimated_minutes ?? 30,
        priority: topPressure.priority ?? "medium",
      }
    : null;

  // Repeated friction tags (aggregate execution_feedback)
  const tagCounts: Record<string, number> = {};
  for (const f of feedback) {
    if (!f.feedback) continue;
    tagCounts[f.feedback] = (tagCounts[f.feedback] ?? 0) + 1;
  }
  const repeatedFrictionTags = Object.entries(tagCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));

  return {
    completed_today: completedTodayList,
    completed_today_count: completedTodayList.length,
    pending_today_count: pendingToday.length,
    overdue_tasks: overdue,
    missed_tasks_recent: missedRecent,
    current_block: currentBlock
      ? {
          id: currentBlock.id,
          title: currentBlock.title,
          start_time: currentBlock.start_time,
          end_time: currentBlock.end_time,
          status: currentBlock.status ?? "active",
        }
      : null,
    next_block: nextBlock
      ? {
          id: nextBlock.id,
          title: nextBlock.title,
          start_time: nextBlock.start_time,
          end_time: nextBlock.end_time,
        }
      : null,
    schedule_pressure: pressure,
    pressure_reason: pressureReason,
    top_pressure_task: topPressureTask,
    repeated_friction_tags: repeatedFrictionTags,
    alignment_status: state.alignment?.status ?? "unknown",
    drift_score: state.alignment?.drift_score ?? 0,
    constellation_status: state.today_state
      ? {
          current_bottleneck: state.today_state.current_bottleneck ?? "",
          decisive_move: state.today_state.decisive_move ?? "",
        }
      : null,
    recommended_next_move: nextMove
      ? {
          id: nextMove.id,
          title: nextMove.title,
          minutes: nextMove.estimated_minutes,
        }
      : null,
  };
}