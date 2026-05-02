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
  const home = { active_plan: state.home?.active_plan ?? ("plan_a" as const) };
  const sched = {
    day_plan: (state.schedule_state.day_plan ?? []) as ScheduleBlock[],
    day_plan_a_snapshot: (state.schedule_state.day_plan_a_snapshot ?? []) as ScheduleBlock[],
    reform_note: state.schedule_state.reform_note ?? "",
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
