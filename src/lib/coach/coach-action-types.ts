/**
 * Coach Actions — discriminated union of every action the Coach can propose
 * and the app can execute on the user's behalf. Every action MUST map to a
 * real state-store mutation in `execute-coach-action.ts`.
 *
 * Rule: if you add a new action here, you also add it to the executor and
 * surface it as a suggestion in `select-coach-actions.ts`.
 */

export type CoachActionType =
  | "task.shrink"
  | "task.split"
  | "task.mark_done"
  | "task.reject"
  | "task.create_proof"
  | "plan.repair_today"
  | "plan.make_lighter"
  | "plan.move_one_task"
  | "review.save_memory"
  | "forge.create_artifact"
  | "rescue.trigger"
  | "path.show_proof"
  | "explain.why_this_matters";

export interface CoachAction {
  type: CoachActionType;
  /** Short human label rendered on the chip. ≤ 22 chars ideal. */
  label: string;
  /** Optional task target. */
  task_id?: string;
  /** Optional plan block target. */
  block_id?: string;
  /** Action-specific payload, kept narrow per type. */
  payload?: Record<string, unknown>;
  /** True for destructive/irreversible actions — UI confirms before running. */
  needs_confirmation?: boolean;
}

export type CoachMode =
  | "next_move"
  | "plan_repair"
  | "emotional_support"
  | "review_memory"
  | "path_explanation"
  | "task_breakdown"
  | "forge_artifact"
  | "rescue"
  | "clarifying_question"
  | "celebrate";

export type ExecutionState =
  | "steady"
  | "stuck"
  | "overloaded"
  | "drifting"
  | "recovering"
  | "confused"
  | "low_confidence"
  | "avoidant"
  | "proud"
  | "frustrated";

export interface CoachMemoryToSave {
  type: "friction" | "goal_clarity" | "learning_gap" | "win" | "open_loop";
  content: string;
  confidence: number;
}

export interface CoachRescuePlan {
  task_title: string;
  due_description: string;
  first_move: string;
  steps: string[];
  estimated_total_minutes: number;
  panic_reduction: string;
}

export interface CoachResponse {
  mode: CoachMode;
  reply: string;
  inferred_state: ExecutionState;
  confidence: number;
  evidence_used: string[];
  next_move?: {
    label: string;
    task_id?: string;
    estimated_minutes?: number;
  };
  suggested_actions: CoachAction[];
  memory_to_save?: CoachMemoryToSave;
  follow_up_question?: string | null;
  rescue_plan?: CoachRescuePlan | null;
}
