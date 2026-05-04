import type {
  Task,
  Reflection,
  ScheduleBlock,
  WeekBlock,
  AlignmentState,
  MomentState,
  ExecutionFeedbackItem,
  CompiledPursuitModel,
  PursuitStandard,
  CapabilityCluster,
  PursuitWorkstream,
  PursuitRisk,
  AppMode,
  RescueSignal,
  ChatPreferences,
} from "@/lib/types";

/**
 * Typed action union for the Moment dispatch system.
 */
export type MomentAction =
  | { type: "task/add"; payload: Task }
  | { type: "task/update"; payload: { id: string; changes: Partial<Task> } }
  | { type: "task/complete"; payload: { id: string; completed_at: string } }
  | { type: "task/delete"; payload: { id: string } }
  | { type: "task/tune"; payload: { id: string; feedback: string; change: string; changes: Partial<Task> } }
  | { type: "schedule/addBlock"; payload: ScheduleBlock }
  | { type: "schedule/updateBlock"; payload: { id: string; changes: Partial<ScheduleBlock> } }
  | { type: "feedback/add"; payload: ExecutionFeedbackItem }
  | { type: "plan/reform"; payload: { reformed_plan: ScheduleBlock[]; reform_note: string } }
  | { type: "reflection/add"; payload: Reflection }
  | { type: "alignment/set"; payload: AlignmentState }
  | { type: "home/setPlan"; payload: "plan_a" | "plan_b" }
  | { type: "rescue/log"; payload: RescueSignal }
  | { type: "chat/setPreferences"; payload: Partial<ChatPreferences> }
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
  | { type: "system/set_mode"; payload: AppMode }
  | { type: "forge/start_interview" }
  | { type: "forge/answer"; payload: { question_key: string; question_text: string; answer_text: string } }
  | { type: "forge/generate_candidates" }
  | { type: "forge/toggle_feature"; payload: { id: string } }
  | { type: "forge/instantiate" }
  | { type: "forge/set_ai_candidates"; payload: { candidates: import("@/lib/types").FeatureCandidate[] } }
  | { type: "forge/update_module"; payload: { id: string; changes: Partial<import("@/lib/types").GeneratedModuleManifest> } }
  | { type: "forge/archive_module"; payload: { id: string } }
  | { type: "forge/delete_module"; payload: { id: string } }
  | { type: "forge/log_entry"; payload: { module_id: string; entry: import("@/lib/types").ModuleEntry } }
  | { type: "forge/reset" };
