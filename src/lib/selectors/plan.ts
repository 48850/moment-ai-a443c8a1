import type { MomentState, ScheduleBlock, Task } from "@/lib/types";
import { selectActivePlanBlocks, hasPlanB } from "@/lib/engine/plan-ab";

export interface PlanViewModel {
  scheduleBlocks: ScheduleBlock[];
  unscheduledTasks: Task[];
  assumptions: string[];
  activePlan: "plan_a" | "plan_b";
  hasPlanB: boolean;
  reformNote: string;
}

export function selectPlanViewModel(state: MomentState): PlanViewModel {
  const home = state.home ?? { active_plan: "plan_a" as const };
  const sched = {
    ...state.schedule_state,
    day_plan_a_snapshot: state.schedule_state.day_plan_a_snapshot ?? [],
    week_plan: state.schedule_state.week_plan ?? [],
    relationships: state.schedule_state.relationships ?? [],
  };

  const blocks = selectActivePlanBlocks(sched, home);
  const scheduledIds = new Set(
    blocks.flatMap((b) => b.linked_task_ids ?? []),
  );

  const unscheduled = (state.tasks ?? []).filter(
    (t) => t.status !== "done" && t.status !== "skipped" && !scheduledIds.has(t.id),
  );

  return {
    scheduleBlocks: blocks,
    unscheduledTasks: unscheduled,
    assumptions: state.schedule_state.assumptions ?? [],
    activePlan: home.active_plan,
    hasPlanB: hasPlanB(sched),
    reformNote: state.schedule_state.reform_note ?? "",
  };
}
