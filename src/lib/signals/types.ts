/**
 * Signal Ledger — typed events derived from MomentState.
 * No storage of its own; signals are projected from the state every read.
 *
 * Rule (enforced in code review, not at runtime):
 *   Every signal type MUST have at least one `downstream_consumers` entry.
 *   No silent telemetry. If nothing reads it, don't emit it.
 */

export type MomentSignalType =
  | "task_created"
  | "task_started"
  | "task_completed"
  | "task_rejected"
  | "feedback_added"
  | "block_missed"
  | "block_completed"
  | "plan_repaired"
  | "reflection_added"
  | "rescue_triggered"
  | "chat_friction_detected"
  | "forge_artifact_created"
  | "path_proof_completed"
  | "memory_saved"
  | "plan_overload_detected";

export type MomentSignalSource =
  | "today"
  | "plan"
  | "coach"
  | "review"
  | "path"
  | "forge"
  | "rescue"
  | "reflect"
  | "system";

export interface MomentSignal {
  id: string;
  type: MomentSignalType;
  source: MomentSignalSource;
  timestamp: string;
  related_task_id?: string;
  related_block_id?: string;
  related_memory_id?: string;
  related_goal_id?: string;
  value?: unknown;
  /** 0–1. Deterministic signals are 1; pattern-derived signals are lower. */
  confidence: number;
  /** Short, plain English. Used in UI surfaces, never jargon. */
  user_facing_meaning: string;
  /** Which surfaces actually use this signal. Audit field. */
  downstream_consumers: Array<
    "today" | "plan" | "coach" | "portfolio" | "path" | "forge" | "review" | "rescue"
  >;
}

export interface SignalLedger {
  signals: MomentSignal[];
  summary: {
    total: number;
    last_7d: number;
    by_type: Record<string, number>;
    by_source: Record<string, number>;
    top_consumers: Array<{ surface: string; count: number }>;
  };
}
