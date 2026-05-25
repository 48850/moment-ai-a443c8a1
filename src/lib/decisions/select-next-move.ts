/**
 * selectNextMove — wraps selectNextBestTask with deterministic memory adaptations.
 * No AI call. Pure.
 */
import type { MomentState, Task } from "@/lib/types";
import { selectNextBestTask } from "@/lib/engine/next-best-task";
import { buildMomentMemory } from "@/lib/memory/build-moment-memory";

export interface NextMoveResult {
  task: Task | null;
  why_it_matters: string;
  estimated_minutes: number;
  adaptation_applied: boolean;
  adaptation_note: string;
  confidence: number;
  proof_link?: string;
}

export function selectNextMove(state: MomentState | null): NextMoveResult {
  if (!state) {
    return {
      task: null,
      why_it_matters: "",
      estimated_minutes: 0,
      adaptation_applied: false,
      adaptation_note: "",
      confidence: 0,
    };
  }

  const { best } = selectNextBestTask(state);
  if (!best) {
    return {
      task: null,
      why_it_matters: "Nothing scheduled. Add one move or finish the day.",
      estimated_minutes: 0,
      adaptation_applied: false,
      adaptation_note: "",
      confidence: 0,
    };
  }

  const memory = buildMomentMemory(state);
  let task: Task = { ...best };
  let adapted = false;
  const notes: string[] = [];

  // Rule 1: shrink task if it exceeds preferred_minutes + 15 and "too_big" is a top rejection
  const preferred = memory.task_profile.preferred_minutes;
  const tooBigIsCommon = memory.task_profile.common_rejection_reasons.some((r) => r.includes("too big"));
  if (task.estimated_minutes > preferred + 15 && (tooBigIsCommon || preferred < 30)) {
    const next = Math.max(preferred, 15);
    notes.push(`Sized for ~${next} min (your usual).`);
    task = { ...task, estimated_minutes: next };
    adapted = true;
  }

  // Rule 2: if the task's window is a weak window, note it
  if (memory.time_profile.weak_work_windows.length && memory.time_profile.plan_reliability_score < 60) {
    notes.push(`Plan reliability ${memory.time_profile.plan_reliability_score}% — kept light.`);
    adapted = true;
  }

  // Rule 3: if "hard_to_start" or "feels_unrealistic" is a top reason → reframe as first step
  if (
    memory.task_profile.common_rejection_reasons.includes("feels unrealistic") ||
    memory.emotional_execution_profile.common_friction.includes("hard to start")
  ) {
    if (!task.title.startsWith("First 10 min:")) {
      task = { ...task, title: `First 10 min: ${task.title}` };
      notes.push("Reframed as a 10-min starter.");
      adapted = true;
    }
  }

  const why =
    memory.goal_profile.next_proof
      ? `Builds toward: ${memory.goal_profile.next_proof}`
      : task.goal_id
        ? "Direct goal work."
        : "Keeps momentum.";

  return {
    task,
    why_it_matters: why,
    estimated_minutes: task.estimated_minutes,
    adaptation_applied: adapted,
    adaptation_note: notes.join(" "),
    confidence: Math.min(1, ((best as any).score ?? 10) / 30),
    proof_link: memory.goal_profile.next_proof || undefined,
  };
}
