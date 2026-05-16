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
  ChatMessage,
  ForgeGuidebook,
  FeatureRunResult,
  ForgeSignal,
  GoalFeasibilityReport,
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
  | { type: "week/set"; payload: WeekBlock[] }
  | { type: "week/addBlock"; payload: WeekBlock }
  | { type: "week/updateBlock"; payload: { id: string; changes: Partial<WeekBlock> } }
  | { type: "week/deleteBlock"; payload: { id: string } }
  | { type: "week/reform" }
  | { type: "week/seed" }
  | { type: "feedback/add"; payload: ExecutionFeedbackItem }
  | { type: "plan/reform"; payload: { reformed_plan: ScheduleBlock[]; reform_note: string } }
  | { type: "reflection/add"; payload: Reflection }
  | { type: "alignment/set"; payload: AlignmentState }
  | { type: "home/setPlan"; payload: "plan_a" | "plan_b" }
  | { type: "rescue/log"; payload: RescueSignal }
  | { type: "chat/append"; payload: ChatMessage }
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
  // ─── Legacy forge actions ──────────────────────────────────────────────────
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
  | { type: "forge/reset" }
  // ─── Guidebook system actions ──────────────────────────────────────────────
  | { type: "forge/set_draft_guidebook"; payload: Partial<ForgeGuidebook> }
  | { type: "forge/clear_draft_guidebook" }
  | { type: "forge/set_build_status"; payload: ForgeGuidebook["status"] | "asking" | "generating" | "preview" | "done" | "idle" }
  | { type: "forge/create_guidebook"; payload: ForgeGuidebook }
  | { type: "forge/update_guidebook"; payload: { id: string; changes: Partial<ForgeGuidebook> } }
  | { type: "forge/activate_guidebook"; payload: { id: string } }
  | { type: "forge/pause_guidebook"; payload: { id: string } }
  | { type: "forge/archive_guidebook"; payload: { id: string } }
  | { type: "forge/log_feature_run"; payload: FeatureRunResult }
  | { type: "forge/log_signal"; payload: ForgeSignal }
  | { type: "forge/touch_guidebook"; payload: { id: string } }
  // ─── Profile + onboarding ──────────────────────────────────────────────────
  | { type: "profile/patch"; payload: Partial<MomentState["profile"]> }
  | { type: "onboarding/set_answer"; payload: { key: string; value: unknown } }
  | { type: "onboarding/complete"; payload: {
      profile_patch: Partial<MomentState["profile"]>;
      goal_patch: Partial<MomentState["active_goal"]>;
      constraints_patch?: Partial<MomentState["constraints"]>;
      answers: Record<string, unknown>;
      understanding: {
        knowns: string[];
        unknowns: string[];
        assumptions: string[];
        confidence: "low" | "medium" | "high";
      };
      feasibility: GoalFeasibilityReport;
    } }
  | { type: "task/bulk_add"; payload: Task[] }
  // ─── Goal-specialisation chat flow ────────────────────────────────────────
  | { type: "chat/begin_specialisation" }
  | { type: "chat/set_specialisation_phase"; payload: {
      phase: "explain_goal" | "map_reality" | "locate_user" | "choose_first_path" | "activate_first_move" | "complete";
    } }
  | { type: "chat/complete_specialisation"; payload: {
      goal_patch: Partial<MomentState["active_goal"]>;
      first_task: Task;
    } };
