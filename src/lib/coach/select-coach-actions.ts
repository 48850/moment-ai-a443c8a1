/**
 * Deterministic seed actions — picked from real state so the Coach always
 * has at least 1–3 real chips even before the model speaks. The model may
 * refine or replace them in its structured response.
 */
import type { MomentState } from "@/lib/types";
import type { CoachAction, ExecutionState } from "./coach-action-types";
import type { CoachSurface } from "./build-coach-context";

const MAX_ACTIONS = 3;

export function selectSeedActions(
  state: MomentState | null,
  surface: CoachSurface,
  inferred: ExecutionState,
): CoachAction[] {
  if (!state) return [];
  const actions: CoachAction[] = [];

  const pending = (state.tasks ?? []).filter((t) => t.status === "pending");
  const topTask = pending[0];
  const bigTask = pending.find((t) => (t.estimated_minutes ?? 30) > 45);
  const lessonTasks = (state.tasks ?? []).filter((t) => (t as any).note_review);

  // Always have an "explain why this matters" if a goal exists
  const hasGoal = Boolean(state.active_goal?.statement?.trim());

  // ── Surface-led suggestions ────────────────────────────────────────────────
  if (surface === "today" || surface === "coach") {
    if (topTask) {
      actions.push({
        type: "task.shrink",
        label: "Make this smaller",
        task_id: topTask.id,
      });
    }
    if (inferred === "overloaded" || inferred === "drifting") {
      actions.push({ type: "plan.repair_today", label: "Repair today" });
    }
    if (hasGoal && topTask) {
      actions.push({
        type: "explain.why_this_matters",
        label: "Why this matters",
        task_id: topTask.id,
      });
    }
  }

  if (surface === "plan") {
    actions.push({ type: "plan.repair_today", label: "Repair today" });
    actions.push({ type: "plan.make_lighter", label: "Make plan lighter" });
    if (topTask) {
      actions.push({
        type: "plan.move_one_task",
        label: "Move one task",
        task_id: topTask.id,
      });
    }
  }

  if (surface === "portfolio") {
    if (lessonTasks[0]) {
      actions.push({
        type: "review.save_memory",
        label: "Save what I learned",
        task_id: lessonTasks[0].id,
      });
    }
    actions.push({ type: "path.show_proof", label: "What should I review?" });
  }

  if (surface === "path") {
    if (hasGoal) {
      actions.push({ type: "explain.why_this_matters", label: "Why does this matter?" });
    }
    actions.push({ type: "path.show_proof", label: "What is my next proof?" });
  }

  if (surface === "forge" && topTask) {
    actions.push({
      type: "forge.create_artifact",
      label: "Turn this into a quiz",
      task_id: topTask.id,
    });
  }

  // ── State-led overrides ────────────────────────────────────────────────────
  if (inferred === "stuck" && bigTask && !actions.some((a) => a.type === "task.split")) {
    actions.unshift({ type: "task.split", label: "Split this task", task_id: bigTask.id });
  }
  if (inferred === "overloaded" && !actions.some((a) => a.type === "rescue.trigger")) {
    actions.push({
      type: "rescue.trigger",
      label: "Start rescue",
      needs_confirmation: true,
    });
  }

  // De-dup by type+task_id
  const seen = new Set<string>();
  const unique = actions.filter((a) => {
    const k = `${a.type}::${a.task_id ?? ""}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return unique.slice(0, MAX_ACTIONS);
}
