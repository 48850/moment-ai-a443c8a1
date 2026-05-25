/**
 * Runtime validation + safe-parse for CoachResponse.
 * The edge function returns raw JSON; this guards against bad shapes.
 */
import type { CoachAction, CoachResponse, ExecutionState, CoachMode } from "./coach-action-types";

const VALID_MODES: CoachMode[] = [
  "next_move",
  "plan_repair",
  "emotional_support",
  "review_memory",
  "path_explanation",
  "task_breakdown",
  "forge_artifact",
  "rescue",
  "clarifying_question",
  "celebrate",
];

const VALID_STATES: ExecutionState[] = [
  "steady",
  "stuck",
  "overloaded",
  "drifting",
  "recovering",
  "confused",
  "low_confidence",
  "avoidant",
  "proud",
  "frustrated",
];

const VALID_ACTION_TYPES = new Set([
  "task.shrink",
  "task.split",
  "task.mark_done",
  "task.reject",
  "task.create_proof",
  "plan.repair_today",
  "plan.make_lighter",
  "plan.move_one_task",
  "review.save_memory",
  "forge.create_artifact",
  "rescue.trigger",
  "path.show_proof",
  "explain.why_this_matters",
]);

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function parseCoachResponse(raw: unknown, fallbackReply = ""): CoachResponse {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;

  const mode = VALID_MODES.includes(obj.mode as CoachMode) ? (obj.mode as CoachMode) : "next_move";
  const inferred = VALID_STATES.includes(obj.inferred_state as ExecutionState)
    ? (obj.inferred_state as ExecutionState)
    : "steady";

  const rawActions = Array.isArray(obj.suggested_actions) ? obj.suggested_actions : [];
  const suggested_actions: CoachAction[] = rawActions
    .filter((a): a is Record<string, unknown> => Boolean(a) && typeof a === "object")
    .filter((a) => VALID_ACTION_TYPES.has(String(a.type)))
    .slice(0, 3)
    .map((a) => ({
      type: a.type as CoachAction["type"],
      label: asString(a.label, "Do it").slice(0, 32),
      task_id: typeof a.task_id === "string" ? a.task_id : undefined,
      block_id: typeof a.block_id === "string" ? a.block_id : undefined,
      needs_confirmation: Boolean(a.needs_confirmation),
    }));

  const rawNext = obj.next_move as Record<string, unknown> | null | undefined;
  const next_move = rawNext && typeof rawNext === "object"
    ? {
        label: asString(rawNext.label, ""),
        task_id: typeof rawNext.task_id === "string" ? rawNext.task_id : undefined,
        estimated_minutes:
          typeof rawNext.estimated_minutes === "number" ? rawNext.estimated_minutes : undefined,
      }
    : undefined;

  const mem = obj.memory_to_save as Record<string, unknown> | null | undefined;
  const memory_to_save = mem && typeof mem === "object" && typeof mem.content === "string"
    ? {
        type: (["friction", "goal_clarity", "learning_gap", "win", "open_loop"].includes(
          String(mem.type),
        )
          ? mem.type
          : "open_loop") as CoachResponse["memory_to_save"]["type"],
        content: asString(mem.content),
        confidence: asNumber(mem.confidence, 0.5),
      }
    : undefined;

  return {
    mode,
    reply: asString(obj.reply, fallbackReply),
    inferred_state: inferred,
    confidence: Math.max(0, Math.min(1, asNumber(obj.confidence, 0.5))),
    evidence_used: Array.isArray(obj.evidence_used)
      ? obj.evidence_used.filter((s): s is string => typeof s === "string").slice(0, 6)
      : [],
    next_move: next_move && next_move.label ? next_move : undefined,
    suggested_actions,
    memory_to_save,
    follow_up_question:
      typeof obj.follow_up_question === "string" && obj.follow_up_question.trim()
        ? obj.follow_up_question.trim()
        : null,
  };
}
