/**
 * selectPlanRepair — deterministic overload detector for the day plan.
 * Reads schedule_state, memory, and feedback. Emits human-facing actions.
 */
import type { MomentState } from "@/lib/types";
import { buildMomentMemory } from "@/lib/memory/build-moment-memory";

export interface PlanRepairResult {
  pressure_detected: boolean;
  pressure_score: number; // 0-100
  pressure_message: string;
  actions: Array<"repair_today" | "make_lighter" | "move_one_task">;
  reasons: string[];
}

export function selectPlanRepair(state: MomentState | null): PlanRepairResult {
  if (!state) return { pressure_detected: false, pressure_score: 0, pressure_message: "", actions: [], reasons: [] };

  const memory = buildMomentMemory(state);
  const blocks = state.schedule_state?.day_plan ?? [];
  const target = state.constraints?.study_minutes_daily ?? 60;

  const upcoming = blocks.filter((b) => {
    const s = b.block_status ?? b.status;
    return s !== "done" && s !== "completed" && s !== "missed";
  });
  const upcomingMinutes = upcoming.reduce((acc, b) => acc + (b.duration_minutes ?? 0), 0);
  const missedToday = blocks.filter((b) => (b.block_status ?? b.status) === "missed").length;

  const overloadRatio = target > 0 ? upcomingMinutes / target : 1;
  const reliability = memory.time_profile.plan_reliability_score;
  const alignmentDrift = state.alignment?.status === "overwhelmed" || state.alignment?.status === "drifting";

  let score = 0;
  const reasons: string[] = [];
  if (overloadRatio > 1.3) { score += 35; reasons.push(`${Math.round(upcomingMinutes)} min left vs ${target} min target`); }
  if (missedToday >= 2) { score += 25; reasons.push(`${missedToday} blocks missed today`); }
  if (reliability && reliability < 50) { score += 20; reasons.push(`plan reliability ${reliability}%`); }
  if (alignmentDrift) { score += 15; reasons.push(`feeling ${state.alignment.status}`); }
  if (memory.emotional_execution_profile.rescue_triggers.length >= 2) { score += 5; reasons.push("recent rescues"); }

  score = Math.min(100, score);
  const pressure = score >= 40;

  const actions: PlanRepairResult["actions"] = [];
  if (pressure) {
    actions.push("make_lighter");
    if (upcoming.length > 1) actions.push("move_one_task");
    actions.push("repair_today");
  }

  let message = "";
  if (pressure) {
    if (overloadRatio > 1.5) message = `Today's plan is asking for ~${Math.round(upcomingMinutes)} min and you usually do ~${target}. Worth lightening.`;
    else if (missedToday >= 2) message = `${missedToday} blocks slipped today. Repair the rest — one block, one move.`;
    else message = `Plan pressure is up. Make today lighter so it can survive.`;
  }

  return { pressure_detected: pressure, pressure_score: score, pressure_message: message, actions, reasons };
}
