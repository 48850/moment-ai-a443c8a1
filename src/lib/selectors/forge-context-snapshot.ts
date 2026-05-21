import type { MomentState } from "@/lib/types";
import type { ForgeContextSnapshot } from "@/lib/types/forge-episode";

function isToday(dateStr: string): boolean {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr.slice(0, 10) === today;
}

function isPast(dateStr: string): boolean {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr.slice(0, 10) < today;
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function selectForgeContextSnapshot(state: MomentState): ForgeContextSnapshot {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const dayPlan = state.schedule_state?.day_plan ?? [];

  const currentBlock =
    dayPlan.find((b) => {
      const start = timeToMinutes(b.start_time);
      const end = timeToMinutes(b.end_time);
      return currentMinutes >= start && currentMinutes < end;
    }) ?? null;

  const nextBlock =
    dayPlan.find((b) => timeToMinutes(b.start_time) > currentMinutes) ?? null;

  const tasks = state.tasks ?? [];
  const feedback = state.execution_feedback ?? [];

  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const completedTasksToday = tasks.filter(
    (t) => t.status === "done" && isToday(t.completed_at)
  );
  const missedTasksRecently = tasks.filter(
    (t) => t.status === "pending" && t.due_date && isPast(t.due_date)
  );

  // Tasks with 2+ feedback entries are considered "repeatedly problematic"
  const feedbackCounts: Record<string, number> = {};
  for (const f of feedback) {
    if (f.task_id) feedbackCounts[f.task_id] = (feedbackCounts[f.task_id] ?? 0) + 1;
  }
  const rescheduledTasksRecently = tasks.filter(
    (t) => (feedbackCounts[t.id] ?? 0) >= 2
  );

  // Schedule pressure: pending task minutes vs remaining minutes today
  const remainingMinutesToday = Math.max(0, (22 * 60) - currentMinutes); // assume day ends at 22:00
  const totalPendingMinutes = pendingTasks.reduce(
    (sum, t) => sum + (t.estimated_minutes ?? 30),
    0
  );
  let schedulePressure: ForgeContextSnapshot["schedulePressure"] = "low";
  if (totalPendingMinutes > remainingMinutesToday * 1.5) schedulePressure = "critical";
  else if (totalPendingMinutes > remainingMinutesToday) schedulePressure = "high";
  else if (totalPendingMinutes > remainingMinutesToday * 0.7) schedulePressure = "moderate";

  return {
    goal: state.active_goal
      ? {
          statement: state.active_goal.statement,
          phase: state.active_goal.phase,
          status: state.active_goal.status,
        }
      : null,
    todaySchedule: dayPlan,
    currentBlock,
    nextBlock,
    pendingTasks,
    completedTasksToday,
    missedTasksRecently,
    rescheduledTasksRecently,
    recentReflections: (state.reflections ?? []).slice(-3),
    schedulePressure,
    alignmentState: state.alignment ?? null,
    constellationDay: state.today_state ?? null,
    constellationWeek: state.schedule_state?.week_plan ?? [],
    constellationMonth: null,
  };
}
