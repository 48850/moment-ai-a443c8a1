/**
 * Coach Context — the unified packet every Coach call receives.
 *
 * Wraps the standard intelligence context-packet + adds emotional inference,
 * a surface hint, and a permissions block describing what the Coach can do.
 */
import type { MomentState } from "@/lib/types";
import { buildContextPacket } from "@/lib/ai/context-packet";
import { inferExecutionState, type InferredState } from "./infer-execution-state";

export type CoachSurface = "today" | "plan" | "portfolio" | "path" | "forge" | "rescue" | "coach";

export interface CoachContext {
  surface: CoachSurface;
  inferred: InferredState;
  permissions: {
    can_create_task: boolean;
    can_modify_plan: boolean;
    can_create_review_memory: boolean;
    can_trigger_rescue: boolean;
    requires_confirmation_for_major_changes: boolean;
  };
  /** The standard intelligence packet (goal, today, portfolio, memory, etc.). */
  packet: ReturnType<typeof buildContextPacket>;
}

export function buildCoachContext(
  state: MomentState | null,
  options: { surface?: CoachSurface; latestUserText?: string } = {},
): CoachContext {
  const surface = options.surface ?? "coach";
  const inferred = inferExecutionState(state, options.latestUserText ?? "");
  return {
    surface,
    inferred,
    permissions: {
      can_create_task: true,
      can_modify_plan: true,
      can_create_review_memory: true,
      can_trigger_rescue: true,
      requires_confirmation_for_major_changes: true,
    },
    packet: buildContextPacket(state),
  };
}
