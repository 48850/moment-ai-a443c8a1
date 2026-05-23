import type { MomentState } from "@/lib/types";
import type { ForgeContextSnapshot } from "@/lib/types/forge-episode";

function timeToMinutes(t: string): number {
  if (!t) return 0;
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function isToday(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr.slice(0, 10) === today;
}

function isPast(dateStr: string | undefined): boolean {
  if (!dateStr) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateStr.slice(0, 10) < today;
}

export function selectForgeContextSnapshot(state: MomentState): ForgeContextSnapshot {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const today = now.toISOString().slice(0, 10);

  const tasks = state.tasks ?? [];
  const dayPlan = state.schedule_state?.day_plan ?? [];
  const feedback = state.execution_feedback ?? [];

  const pendingTasks = tasks.filter(
    (t) => t.status !== "done" && t.status !== "skipped",
  );

  const completedTasksToday = tasks.filter(
    (t) => t.status === "done" && isToday(t.completed_at),
  );

  const missedTasksRecently = tasks.filter(
    (t) =>
      (t.status === "skipped" || (t.status !== "done" && isPast(t.due_date))),
  ).slice(-6);

  // Tasks rescheduled 2+ times = 2+ execution_feedback entries
  const rescheduledTasksRecently = tasks
    .map((t) => {
      const taskFeedback = feedback.filter((f) => f.task_id === t.id);
      return { ...t, rescheduleCount: taskFeedback.length };
    })
    .filter((t) => t.rescheduleCount >= 2 && t.status !== "done")
    .slice(0, 5);

  const currentBlock =
    dayPlan.find((b) => {
      const start = timeToMinutes(b.start_time);
      const end = timeToMinutes(b.end_time);
      return currentMinutes >= start && currentMinutes < end;
    }) ?? null;

  const nextBlock =
    dayPlan.find((b) => timeToMinutes(b.start_time) > currentMinutes) ?? null;

  // Schedule pressure
  const totalPendingMinutes = pendingTasks.reduce(
    (sum, t) => sum + (t.estimated_minutes ?? 30),
    0,
  );
  const remainingMinutesToday = Math.max(0, 22 * 60 - currentMinutes);
  let schedulePressure: ForgeContextSnapshot["schedulePressure"] = "low";
  if (totalPendingMinutes > remainingMinutesToday * 1.5) schedulePressure = "critical";
  else if (totalPendingMinutes > remainingMinutesToday) schedulePressure = "high";
  else if (totalPendingMinutes > remainingMinutesToday * 0.7) schedulePressure = "moderate";

  const recentReflections = [...(state.reflections ?? [])]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  return {
    goal: state.active_goal?.statement
      ? {
          statement: state.active_goal.statement,
          why_it_matters: state.active_goal.why_it_matters ?? "",
        }
      : null,
    todaySchedule: dayPlan.map((b) => ({
      id: b.id,
      title: b.title,
      start_time: b.start_time,
      end_time: b.end_time,
      status: b.status,
    })),
    currentBlock: currentBlock
      ? { id: currentBlock.id, title: currentBlock.title, start_time: currentBlock.start_time, end_time: currentBlock.end_time }
      : null,
    nextBlock: nextBlock
      ? { id: nextBlock.id, title: nextBlock.title, start_time: nextBlock.start_time, end_time: nextBlock.end_time }
      : null,
    pendingTasks: pendingTasks.map((t) => ({
      id: t.id,
      title: t.title,
      estimated_minutes: t.estimated_minutes,
      priority: t.priority,
      due_date: t.due_date,
    })),
    completedTasksToday: completedTasksToday.map((t) => ({
      id: t.id,
      title: t.title,
      completed_at: t.completed_at ?? today,
    })),
    missedTasksRecently: missedTasksRecently.map((t) => ({ id: t.id, title: t.title })),
    rescheduledTasksRecently: rescheduledTasksRecently.map((t) => ({
      id: t.id,
      title: t.title,
      rescheduleCount: t.rescheduleCount,
    })),
    recentReflections: recentReflections.map((r) => ({
      id: r.id,
      date: r.date,
      content: typeof r.content === "string" ? r.content : undefined,
    })),
    schedulePressure,
    alignmentState: state.alignment
      ? { status: state.alignment.status, drift_score: state.alignment.drift_score ?? 0 }
      : null,
    constellationDay: state.today_state
      ? {
          decisive_move: state.today_state.decisive_move ?? "",
          current_bottleneck: state.today_state.current_bottleneck ?? "",
        }
      : null,
    constellationWeek: state.schedule_state?.week_plan ?? null,
    constellationMonth: null,
  };
}
