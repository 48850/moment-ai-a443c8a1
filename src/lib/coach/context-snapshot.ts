/**
 * ContextSnapshot — the situational intelligence spine of Moment.
 *
 * Answers 7 questions before every coach response so replies are grounded
 * in the user's real situation, not generic AI output.
 *
 * Q1: What does the user want long term?
 * Q2: What is the user supposed to be doing today?
 * Q3: What is emotionally happening right now?
 * Q4: What friction is blocking action?
 * Q5: What is the smallest useful next move?
 * Q6: What should Moment remember from this exchange?
 * Q7: How should the plan change because of this?
 */
import type { MomentState } from "@/lib/types";
import type { ExecutionState } from "./coach-action-types";

export type UserSituation =
  | "aligned"     // on track, making progress
  | "drifting"    // losing connection to goal
  | "overwhelmed" // too much, shutting down
  | "recovering"  // coming back after a miss
  | "progressing"; // active momentum

export interface RescuePlan {
  task_title: string;
  due_description: string;
  first_move: string;
  steps: string[];
  estimated_total_minutes: number;
  panic_reduction: string;
}

export interface ContextSnapshot {
  /** Q1: What does the user want long term? */
  long_term_goal: string;
  medium_term_goal: string;
  short_term_goal: string;
  why_it_matters: string;
  goal_phase: string;
  goal_current_stage: string;

  /** Q2: What is the user supposed to be doing today? */
  todays_tasks: Array<{ id: string; title: string; minutes: number; priority: string; due_date?: string }>;
  todays_blocks: Array<{ title: string; start_time: string; end_time: string; status: string }>;
  current_day: string;
  current_time: string;
  is_school_day: boolean;

  /** Q3: What is emotionally happening right now? */
  inferred_situation: UserSituation;
  execution_state: ExecutionState;
  state_confidence: number;
  state_evidence: string[];

  /** Q4: What friction is blocking action? */
  active_friction: Array<{ tag: string; count: number; description: string }>;
  recent_rescue: { reason: string; at: string } | null;
  overdue_task_count: number;
  missed_tasks_recent: number;
  plan_pressure: "low" | "moderate" | "high" | "critical";

  /** Q5: What is the smallest useful next move? */
  next_best_task: { id: string; title: string; minutes: number; why_now: string } | null;
  current_bottleneck: string;
  decisive_move: string;

  /** Q6: What should be saved from this exchange? */
  memory_candidates: Array<{ type: "friction" | "win" | "open_loop" | "learning_gap" | "goal_clarity"; content: string }>;

  /** Q7: How should the plan change? */
  plan_needs_repair: boolean;

  /** Rescue: is this an urgent deadline situation? */
  is_rescue_situation: boolean;
  deadline_urgency?: string;
}

const URGENCY_PATTERNS = [
  /due (today|tomorrow|tonight|friday|thursday|wednesday|tuesday|monday|this week)/i,
  /haven'?t (started|begun|done any)/i,
  /(essay|assignment|project|homework|test|exam|coursework|report) due/i,
  /panick?ing|freaking out|stressed about/i,
  /need to finish|gotta finish|must finish/i,
  /in (\d+) (hours?|days?)/i,
];

const FRICTION_DESCRIPTIONS: Record<string, string> = {
  too_big: "tasks feel too large to start",
  too_vague: "tasks lack clear steps",
  too_much_today: "too many tasks scheduled",
  overwhelmed: "general overload signal",
  tired: "low energy pattern",
  hard: "work is objectively difficult",
  avoided: "user is avoiding this type of work",
  not_relevant: "tasks feel disconnected from goal",
  make_simpler: "user repeatedly asks to simplify",
  too_small: "tasks feel too trivial",
};

export function buildContextSnapshot(
  state: MomentState | null,
  latestUserText = "",
): ContextSnapshot {
  if (!state) return emptySnapshot();

  const now = new Date();
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const currentDay = DAYS[now.getDay()];
  const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  const today = now.toISOString().slice(0, 10);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const tasks = state.tasks ?? [];
  const pendingToday = tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.status !== "skipped" &&
      (!t.due_date || t.due_date.slice(0, 10) >= today),
  );
  const overdue = tasks.filter(
    (t) =>
      t.status !== "done" &&
      t.status !== "skipped" &&
      t.due_date &&
      t.due_date.slice(0, 10) < today,
  );
  const recentlyMissed = tasks.filter(
    (t) =>
      t.status === "skipped" ||
      (t.status !== "done" && t.due_date && t.due_date.slice(0, 10) < today),
  );
  const doneToday = tasks.filter(
    (t) =>
      t.status === "done" &&
      t.completed_at &&
      t.completed_at.slice(0, 10) === today,
  );

  // Friction aggregation (last 30 days)
  const feedback = state.execution_feedback ?? [];
  const tagCounts: Record<string, number> = {};
  const thirtyDaysAgo = Date.now() - 30 * 86_400_000;
  for (const f of feedback) {
    if (!f.feedback) continue;
    if (f.created_at && new Date(f.created_at).getTime() < thirtyDaysAgo) continue;
    tagCounts[f.feedback] = (tagCounts[f.feedback] ?? 0) + 1;
  }
  const activeFriction = Object.entries(tagCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tag, count]) => ({
      tag,
      count,
      description: FRICTION_DESCRIPTIONS[tag] ?? tag.replace(/_/g, " "),
    }));

  // Schedule pressure
  const totalPendingMinutes = pendingToday.reduce(
    (s, t) => s + (t.estimated_minutes ?? 30),
    0,
  );
  const remainingMinutes = Math.max(0, 22 * 60 - currentMinutes);
  let planPressure: ContextSnapshot["plan_pressure"] = "low";
  if (totalPendingMinutes > remainingMinutes * 1.5) planPressure = "critical";
  else if (totalPendingMinutes > remainingMinutes) planPressure = "high";
  else if (totalPendingMinutes > remainingMinutes * 0.7) planPressure = "moderate";

  // Today's blocks
  const dayPlan = state.schedule_state?.day_plan ?? [];
  const todaysBlocks = dayPlan.map((b) => ({
    title: b.title,
    start_time: b.start_time,
    end_time: b.end_time,
    status: (b as unknown as { status?: string }).status ?? "upcoming",
  }));

  // Situation inference
  const rescue7d = (state.rescue_signals ?? []).filter(
    (r) => Date.now() - new Date(r.created_at).getTime() < 7 * 86_400_000,
  ).length;

  let inferredSituation: UserSituation = "aligned";
  if (
    planPressure === "critical" ||
    activeFriction.some((f) => ["overwhelmed", "too_much_today", "tired"].includes(f.tag) && f.count >= 3)
  ) {
    inferredSituation = "overwhelmed";
  } else if (overdue.length >= 2 || recentlyMissed.length >= 4) {
    inferredSituation = "drifting";
  } else if (rescue7d > 0 && doneToday.length > 0) {
    inferredSituation = "recovering";
  } else if (doneToday.length >= 2 || (doneToday.length >= 1 && activeFriction.length === 0)) {
    inferredSituation = "progressing";
  }

  const executionState = inferStateFromText(latestUserText, inferredSituation);

  // Next best task (simple priority sort — avoids full engine import)
  const nextBestTask = pickNextTask(pendingToday);

  // Rescue detection
  const isRescue = URGENCY_PATTERNS.some((p) => p.test(latestUserText));
  const deadlineMatch = latestUserText.match(
    /(?:due|by|before|until)\s+([a-z0-9 ]+?)(?:[.,;!?]|$)/i,
  );

  // Memory candidates from friction patterns
  const memoryCandidates: ContextSnapshot["memory_candidates"] = [];
  if (activeFriction.length >= 2) {
    memoryCandidates.push({
      type: "friction",
      content: `Recurring friction: ${activeFriction.slice(0, 2).map((f) => f.tag).join(", ")}`,
    });
  }
  if (doneToday.length >= 2) {
    memoryCandidates.push({
      type: "win",
      content: `Completed ${doneToday.length} tasks today`,
    });
  }

  // Goal horizon extraction
  const answers = (state.onboarding?.answers ?? {}) as Record<string, string>;
  const goal = state.active_goal;

  const lastRescue = (state.rescue_signals ?? []).slice(-1)[0];

  return {
    long_term_goal:
      (answers.long_term_goal) ||
      extractHorizon(goal.statement, "Long-term") ||
      goal.statement ||
      "",
    medium_term_goal:
      (answers.medium_term_goal) ||
      extractHorizon(goal.statement, "Medium-term") ||
      "",
    short_term_goal:
      (answers.short_term_goal) ||
      extractHorizon(goal.statement, "Short-term") ||
      "",
    why_it_matters: goal.why_it_matters || (answers.why_it_matters) || "",
    goal_phase: goal.phase ?? "clarifying",
    goal_current_stage: goal.current_stage ?? "",

    todays_tasks: pendingToday.slice(0, 12).map((t) => ({
      id: t.id,
      title: t.title,
      minutes: t.estimated_minutes ?? 30,
      priority: t.priority ?? "medium",
      due_date: t.due_date || undefined,
    })),
    todays_blocks: todaysBlocks,
    current_day: currentDay,
    current_time: currentTime,
    is_school_day: isSchoolDay(currentDay, state),

    inferred_situation: inferredSituation,
    execution_state: executionState,
    state_confidence: confidenceFor(inferredSituation, latestUserText),
    state_evidence: buildEvidence(doneToday.length, overdue.length, activeFriction, planPressure),

    active_friction: activeFriction,
    recent_rescue: lastRescue
      ? { reason: lastRescue.reason, at: lastRescue.created_at }
      : null,
    overdue_task_count: overdue.length,
    missed_tasks_recent: recentlyMissed.length,
    plan_pressure: planPressure,

    next_best_task: nextBestTask
      ? {
          id: nextBestTask.id,
          title: nextBestTask.title,
          minutes: nextBestTask.estimated_minutes ?? 30,
          why_now: nextBestTask.why_now ?? "",
        }
      : null,
    current_bottleneck: state.today_state?.current_bottleneck ?? "",
    decisive_move: state.today_state?.decisive_move ?? "",

    memory_candidates: memoryCandidates,
    plan_needs_repair: planPressure !== "low" || overdue.length > 0,

    is_rescue_situation: isRescue,
    deadline_urgency: isRescue
      ? (deadlineMatch?.[1]?.trim() ?? latestUserText.slice(0, 100))
      : undefined,
  };
}

function extractHorizon(statement: string, label: string): string {
  if (!statement) return "";
  const match = statement.match(new RegExp(`${label}:\\s*([^\\n|·]+?)(?=\\s*\\||$)`, "i"));
  return match?.[1]?.trim() ?? "";
}

function isSchoolDay(day: string, state: MomentState): boolean {
  const schoolEndTime = state.constraints?.school_end_time;
  if (!schoolEndTime) return !["Saturday", "Sunday"].includes(day);
  return !["Saturday", "Sunday"].includes(day);
}

function pickNextTask(
  pending: MomentState["tasks"],
): MomentState["tasks"][0] | null {
  if (!pending?.length) return null;
  const PRIORITY: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return [...pending].sort((a, b) => {
    const pa = PRIORITY[a.priority] ?? 1;
    const pb = PRIORITY[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    return (a.due_date || "9999").localeCompare(b.due_date || "9999");
  })[0];
}

function inferStateFromText(text: string, situation: UserSituation): ExecutionState {
  const t = text.toLowerCase();
  if (/stuck|blank|don'?t know how|no idea where to start/.test(t)) return "stuck";
  if (/confused|don'?t get it|doesn'?t make sense/.test(t)) return "confused";
  if (/done|finished|smashed|completed|finally/.test(t)) return "proud";
  if (/frustrated|annoyed|pissed|angry/.test(t)) return "frustrated";
  if (/give up|pointless|what'?s the point|can'?t/.test(t)) return "drifting";
  if (/overwhelmed|drowning|too much|burnt? out/.test(t)) return "overloaded";
  switch (situation) {
    case "overwhelmed": return "overloaded";
    case "drifting": return "drifting";
    case "recovering": return "recovering";
    case "progressing": return "proud";
    default: return "steady";
  }
}

function confidenceFor(situation: UserSituation, text: string): number {
  if (text.length > 20) return 0.8;
  if (situation !== "aligned") return 0.65;
  return 0.5;
}

function buildEvidence(
  doneToday: number,
  overdueCount: number,
  friction: Array<{ tag: string; count: number }>,
  pressure: string,
): string[] {
  const e: string[] = [];
  if (doneToday > 0) e.push(`completed today: ${doneToday}`);
  if (overdueCount > 0) e.push(`overdue tasks: ${overdueCount}`);
  if (friction.length) {
    e.push(`friction signals: ${friction.slice(0, 3).map((f) => `${f.tag}×${f.count}`).join(", ")}`);
  }
  if (pressure !== "low") e.push(`schedule pressure: ${pressure}`);
  return e;
}

function emptySnapshot(): ContextSnapshot {
  return {
    long_term_goal: "",
    medium_term_goal: "",
    short_term_goal: "",
    why_it_matters: "",
    goal_phase: "clarifying",
    goal_current_stage: "",
    todays_tasks: [],
    todays_blocks: [],
    current_day: "Unknown",
    current_time: "00:00",
    is_school_day: true,
    inferred_situation: "aligned",
    execution_state: "steady",
    state_confidence: 0,
    state_evidence: [],
    active_friction: [],
    recent_rescue: null,
    overdue_task_count: 0,
    missed_tasks_recent: 0,
    plan_pressure: "low",
    next_best_task: null,
    current_bottleneck: "",
    decisive_move: "",
    memory_candidates: [],
    plan_needs_repair: false,
    is_rescue_situation: false,
  };
}
