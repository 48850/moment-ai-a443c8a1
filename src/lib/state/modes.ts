import type { MomentState, AppMode } from "@/lib/types";

// Valid mode transitions
export const MODE_TRANSITIONS: Record<AppMode, AppMode[]> = {
   lock_goal: ["gather_constraints"],
   gather_constraints: ["build_day_plan"],
   build_day_plan: ["adjust_day_plan", "update_after_action"],
   adjust_day_plan: ["build_day_plan", "update_after_action"],
   update_after_action: ["build_day_plan", "weekly_reset"],
   weekly_reset: ["build_day_plan"],
};

const ALL_WRITABLE: (keyof MomentState)[] = [
   "active_goal",
   "constraints",
   "pathway",
   "today_state",
   "schedule_state",
   "progress_state",
   "memory_state",
   "system_state",
   "tasks",
   "reflections",
   "alignment",
    "home",
    "execution_feedback",
];

/**
* Per-mode field whitelists.
* Now expanded to allow full control across all modes.
*/
export const MODE_WRITABLE_FIELDS: Record<AppMode, (keyof MomentState)[]> = {
   lock_goal: ALL_WRITABLE,
   gather_constraints: ALL_WRITABLE,
   build_day_plan: ALL_WRITABLE,
   adjust_day_plan: ALL_WRITABLE,
   update_after_action: ALL_WRITABLE,
   weekly_reset: ALL_WRITABLE,
};

/**
* Planning readiness check — the single source of truth for "do we have
* enough to build a day plan."
*/
export function isPlanningReady(state: MomentState): {
   ready: boolean;
   missing: string[];
} {
   const missing: string[] = [];
   const g = state.active_goal;
   const c = state.constraints;

   const isAnswered = (value: any) => {
     if (value === null || value === undefined) return false;
     if (typeof value === "number") return value >= 0;
     if (typeof value === "string") return value.trim() !== "" && value !== "unknown";
     return !!value;
  };

  // Goal - must have content and be locked
  if (!g.statement || g.statement.trim() === "") missing.push("active_goal.statement");
  if (!g.why_it_matters || g.why_it_matters.trim() === "") {
     missing.push("active_goal.why_it_matters");
  }
  if (g.status === "forming" || g.status === "unstable") {
     missing.push("active_goal.goal_lock");
  }

  // Constraints
  if (!isAnswered(c.school_end_time)) {
     missing.push("constraints.school_end_time");
  }
  if (!isAnswered(c.commute_minutes)) {
     missing.push("constraints.commute_minutes");
  }
  if (
     !isAnswered(c.sleep_floor_time) &&
     !isAnswered(c.sleep_target_time)
  ) {
     missing.push("constraints.sleep_time");
  }
  if (!isAnswered(c.study_minutes_daily)) {
     missing.push("constraints.study_minutes_daily");
  }
  if (!isAnswered(c.exercise_minutes_daily)) {
     missing.push("constraints.exercise_minutes_daily");
  }

  const hasWorkWindow =
     (c.preferred_work_window && c.preferred_work_window.trim() !== "") ||
     (c.energy_pattern && c.energy_pattern !== "unknown");
  if (!hasWorkWindow) missing.push("constraints.energy_pattern");

  if (!c.fixed_commitments_checked && (c.fixed_commitments || []).length === 0) {
     missing.push("constraints.fixed_commitments");
  }

  return { ready: missing.length === 0, missing };
}

/**
* Today's date in YYYY-MM-DD (local). Used to detect stale plans.
*/
export function getTodayDateString(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
* Deterministic mode resolution from state.
*/
export function resolveMode(state: MomentState): AppMode {
  const g = state.active_goal;

  // 1. Goal not usable - strictly need statement and why_it_matters
  if (!g.statement || !g.why_it_matters || g.status === "forming" || g.status === "unstable") {
    return "lock_goal";
  }

  const stored = state.system_state.current_mode;
  if (stored === "weekly_reset") {
    return "weekly_reset";
  }

  // 2. Planning ready but no usable plan for today
  // We check if a plan exists and is for today.
  // If it exists, we are in a post-planning mode.
  const hasPlan =
    state.schedule_state.day_plan.length > 0 &&
    state.today_state.decisive_move.trim() !== "" &&
    state.today_state.date === getTodayDateString();

  if (hasPlan) {
    const stored = state.system_state.current_mode;
    if (
      stored === "adjust_day_plan" ||
      stored === "update_after_action" ||
      stored === "weekly_reset"
    ) {
      return stored;
    }
    return "build_day_plan";
  }

  // 3. Planning not ready
  const { ready } = isPlanningReady(state);
  if (!ready) return "gather_constraints";

  // 4. Default
  return "build_day_plan";
}

/**
* Filter a state patch to only include fields allowed by the current mode.
*/
export function filterPatchByMode(
  patch: Partial<MomentState>,
  mode: AppMode
): Partial<MomentState> {
  const allowed = MODE_WRITABLE_FIELDS[mode] || ALL_WRITABLE;
  const filtered: Partial<MomentState> = {};
  for (const key of allowed) {
    if (key in patch) {
      (filtered as any)[key] = (patch as any)[key];
    }
  }
  return filtered;
}
