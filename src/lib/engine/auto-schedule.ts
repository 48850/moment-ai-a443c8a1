import type { MomentState, Task, WeekBlock, WeekCategory } from "@/lib/types";

const JS_TO_IDX = [6, 0, 1, 2, 3, 4, 5]; // JS Sun..Sat → Mon..Sun grid index

function dayIndexFromDueDate(due?: string): number {
  if (!due) {
    const todayJs = new Date().getDay();
    return JS_TO_IDX[todayJs];
  }
  // YYYY-MM-DD — parse as local date to avoid TZ drift on the weekday.
  const [y, m, d] = due.split("-").map(Number);
  if (!y || !m || !d) return JS_TO_IDX[new Date().getDay()];
  const date = new Date(y, m - 1, d);
  return JS_TO_IDX[date.getDay()];
}

function fmt(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function mapCategory(task: Task): WeekCategory {
  // Tasks live in the "goal" lane on the weekly grid by default.
  // Discovery / maintenance / bottleneck still ladder back to the goal.
  switch (task.category) {
    case "goal_direct":
    case "bottleneck_removal":
    case "discovery":
    case "maintenance":
    default:
      return "goal";
  }
}

/**
 * Find a free 15-min-aligned slot in the given day between 16:00 and 21:30,
 * skipping any existing week blocks (locked or otherwise).
 * Falls back to the latest viable slot when the day is fully packed.
 */
function findSlot(state: MomentState, dayIdx: number, durationMin: number): { start: number; end: number } {
  const duration = Math.max(15, Math.min(180, durationMin));
  const dayBlocks = (state.schedule_state.week_plan ?? [])
    .filter((b) => b.day_index === dayIdx)
    .map((b) => ({ start: toMin(b.start_time), end: toMin(b.end_time) }))
    .sort((a, b) => a.start - b.start);

  const dayStart = 16 * 60;
  const latestStart = 21 * 60 + 30 - duration;
  let start = dayStart;
  for (let probe = dayStart; probe <= latestStart; probe += 15) {
    const end = probe + duration;
    const overlaps = dayBlocks.some((b) => probe < b.end && end > b.start);
    if (!overlaps) {
      start = probe;
      return { start, end };
    }
  }
  // Nothing fit — return the latest possible slot (may overlap, the user can drag it).
  start = Math.max(dayStart, latestStart);
  return { start, end: start + duration };
}

/**
 * Build a WeekBlock that represents this task on the weekly grid.
 * Returns null when the task is already scheduled or shouldn't be (done/skipped).
 */
export function scheduleTaskInWeek(state: MomentState, task: Task): WeekBlock | null {
  if (task.status === "done" || task.status === "skipped") return null;
  const existing = (state.schedule_state.week_plan ?? []).find((b) => b.task_id === task.id);
  if (existing) return null;

  const dayIdx = dayIndexFromDueDate(task.due_date);
  const { start, end } = findSlot(state, dayIdx, task.estimated_minutes ?? 30);
  return {
    id: `wb_${Math.random().toString(36).slice(2, 10)}`,
    day_index: dayIdx,
    start_time: fmt(start),
    end_time: fmt(end),
    title: task.title,
    category: mapCategory(task),
    notes: task.why_now ?? "",
    is_locked: false,
    task_id: task.id,
  };
}

/** Remove any week blocks linked to the given task id(s). */
export function removeBlocksForTask(blocks: WeekBlock[], taskId: string): WeekBlock[] {
  return blocks.filter((b) => b.task_id !== taskId);
}
