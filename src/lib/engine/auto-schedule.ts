import type { MomentState, Task, WeekBlock, WeekCategory } from "@/lib/types";

const JS_TO_IDX = [6, 0, 1, 2, 3, 4, 5]; // JS Sun..Sat → Mon..Sun grid index

export function dayIndexFromDueDate(due?: string): number {
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
function findSlot(
  state: MomentState,
  dayIdx: number,
  durationMin: number,
): { dayIdx: number; start: number; end: number } | null {
  const duration = Math.max(15, Math.min(180, durationMin));
  const preferredStart = 16 * 60;
  const dayEnd = 22 * 60;
  const earliest = 8 * 60;
  const MAX_FLEX_PER_DAY = 4; // hard cap on non-school/non-commitment auto-scheduled blocks

  for (let offset = 0; offset < 7; offset++) {
    const day = (dayIdx + offset) % 7;
    const dayBlocksAll = (state.schedule_state.week_plan ?? []).filter((b) => b.day_index === day);
    const flexCount = dayBlocksAll.filter(
      (b) => b.category !== "school" && b.category !== "commitment",
    ).length;
    if (flexCount >= MAX_FLEX_PER_DAY) continue; // day is full — try the next day

    const dayBlocks = dayBlocksAll
      .map((b) => ({ start: toMin(b.start_time), end: toMin(b.end_time) }))
      .sort((a, b) => a.start - b.start);

    for (const windowStart of [preferredStart, earliest]) {
      const latestStart = dayEnd - duration;
      for (let probe = windowStart; probe <= latestStart; probe += 15) {
        const end = probe + duration;
        const overlaps = dayBlocks.some((b) => probe < b.end && end > b.start);
        if (!overlaps) return { dayIdx: day, start: probe, end };
      }
    }
  }

  // Every day is full to the cap — refuse to schedule rather than pile up.
  return null;
}

/**
 * Build a WeekBlock that represents this task on the weekly grid.
 * Returns null when the task is already scheduled or shouldn't be (done/skipped).
 */
export function scheduleTaskInWeek(state: MomentState, task: Task): WeekBlock | null {
  if (task.status === "done" || task.status === "skipped") return null;
  const existing = (state.schedule_state.week_plan ?? []).find((b) => b.task_id === task.id);
  if (existing) return null;

  const preferredDay = dayIndexFromDueDate(task.due_date);
  const { dayIdx, start, end } = findSlot(state, preferredDay, task.estimated_minutes ?? 30);
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
