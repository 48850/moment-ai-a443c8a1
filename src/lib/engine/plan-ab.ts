/**
 * Pure, synchronous Plan A/B bookkeeping.
 *
 * Invariants:
 *   - Plan A snapshot is written ONCE (on the first reform) and never overwritten.
 *   - A "reform" replaces day_plan with the caller-supplied blocks and flips
 *     home.active_plan to "plan_b".
 *   - Switching back to Plan A restores the snapshot into day_plan.
 *   - A fresh day-plan generation (no prior snapshot) clears any existing
 *     snapshot so the new plan becomes the new Plan A baseline.
 */
import type { ScheduleBlock } from "@/lib/types";

export interface ScheduleStateSlice {
  day_plan: ScheduleBlock[];
  day_plan_a_snapshot: ScheduleBlock[];
  week_plan: unknown[];
  assumptions: string[];
  confidence: number;
  last_plan_generated_at: string;
  reform_note?: string;
  relationships: unknown[];
}

export interface HomeStateSlice {
  active_plan: "plan_a" | "plan_b";
}

export interface ReformResult {
  schedule_state: ScheduleStateSlice;
  home: HomeStateSlice;
}

export function applyReform(
  scheduleState: ScheduleStateSlice,
  home: HomeStateSlice,
  reformedPlan: ScheduleBlock[],
  reformNote = "",
): ReformResult {
  const hasSnapshot = scheduleState.day_plan_a_snapshot.length > 0;
  return {
    schedule_state: {
      ...scheduleState,
      day_plan_a_snapshot: hasSnapshot ? scheduleState.day_plan_a_snapshot : scheduleState.day_plan,
      day_plan: reformedPlan,
      reform_note: reformNote,
    },
    home: { ...home, active_plan: "plan_b" },
  };
}

export function selectActivePlanBlocks(
  scheduleState: ScheduleStateSlice,
  home: HomeStateSlice,
): ScheduleBlock[] {
  if (home.active_plan === "plan_a" && scheduleState.day_plan_a_snapshot.length > 0) {
    return scheduleState.day_plan_a_snapshot;
  }
  return scheduleState.day_plan;
}

export function hasPlanB(scheduleState: ScheduleStateSlice): boolean {
  return scheduleState.day_plan_a_snapshot.length > 0;
}
