import type {
  Task,
  Reflection,
  ScheduleBlock,
  AlignmentState,
  MomentState,
  ExecutionFeedbackItem,
  CompiledPursuitModel,
  PursuitStandard,
  CapabilityCluster,
  PursuitWorkstream,
  PursuitRisk,
  AppMode,
} from "@/lib/types";

/**
 * Typed action union for the Moment dispatch system.
 * AUDIT FIXES vs. archive:
 *   - Added `feedback/add` (was missing)
 *   - Added `plan/reform` (was missing)
 */
export type MomentAction =
  | { type: "task/add"; payload: Task }
  | { type: "task/update"; payload: { id: string; changes: Partial<Task> } }
  | { type: "task/complete"; payload: { id: string; completed_at: string } }
  | { type: "task/delete"; payload: { id: string } }
  | { type: "schedule/addBlock"; payload: ScheduleBlock }
  | { type: "schedule/updateBlock"; payload: { id: string; changes: Partial<ScheduleBlock> } }
  | { type: "feedback/add"; payload: ExecutionFeedbackItem }
  | { type: "plan/reform"; payload: { reformed_plan: ScheduleBlock[]; reform_note: string } }
  | { type: "reflection/add"; payload: Reflection }
  | { type: "alignment/set"; payload: AlignmentState }
  | { type: "home/setPlan"; payload: "plan_a" | "plan_b" }
  | { type: "goal/set"; payload: MomentState["active_goal"] }
  | { type: "goal/patch"; payload: Partial<MomentState["active_goal"]> }
  | { type: "pursuit/set_model"; payload: CompiledPursuitModel }
  | { type: "pursuit/clear_model" }
  | { type: "pursuit/set_active_mode"; payload: { operatingModeId: string } }
  | { type: "pursuit/patch_workstream_status"; payload: { id: string; status: PursuitWorkstream["status"]; bottleneck?: string; next_proof?: string } }
  | { type: "pursuit/patch_capability"; payload: { id: string; changes: Partial<CapabilityCluster> } }
  | { type: "pursuit/patch_standard"; payload: { id: string; changes: Partial<PursuitStandard> } }
  | { type: "pursuit/patch_risk"; payload: { id: string; changes: Partial<PursuitRisk> } }
  | { type: "pursuit/patch_evidence_signal"; payload: { id: string; last_value: string; last_checked_at: string } }
  | { type: "pursuit/recompile" }
  | { type: "system/set_mode"; payload: AppMode };
