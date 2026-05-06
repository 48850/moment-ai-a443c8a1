import { z } from "zod";
import {
  momentStateSchema,
  fixedCommitmentSchema,
  scheduleBlockSchema,
  weekBlockSchema,
  pathwayDomainSchema,
  taskSchema,
  reflectionSchema,
  alignmentStateSchema,
  homeStateSchema,
  executionFeedbackItemSchema,
  forgeStateSchema,
  pursuitStandardSchema,
  capabilityClusterSchema,
  pursuitWorkstreamSchema,
  pursuitRiskSchema,
  evidenceSignalSchema,
  operatingModeSchema,
  compiledPursuitModelSchema,
  rescueSignalSchema,
  chatPreferencesSchema,
  missionSnapshotSchema,
} from "@/lib/state/schema";

export type MomentState = z.infer<typeof momentStateSchema>;
export type FixedCommitment = z.infer<typeof fixedCommitmentSchema>;
export type ScheduleBlock = z.infer<typeof scheduleBlockSchema>;
export type WeekBlock = z.infer<typeof weekBlockSchema>;
export type WeekCategory = WeekBlock["category"];
export type PathwayDomain = z.infer<typeof pathwayDomainSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Reflection = z.infer<typeof reflectionSchema>;
export type AlignmentState = z.infer<typeof alignmentStateSchema>;
export type HomeState = z.infer<typeof homeStateSchema>;
export type ExecutionFeedbackItem = z.infer<typeof executionFeedbackItemSchema>;

export type PursuitStandard = z.infer<typeof pursuitStandardSchema>;
export type CapabilityCluster = z.infer<typeof capabilityClusterSchema>;
export type PursuitWorkstream = z.infer<typeof pursuitWorkstreamSchema>;
export type PursuitRisk = z.infer<typeof pursuitRiskSchema>;
export type EvidenceSignal = z.infer<typeof evidenceSignalSchema>;
export type OperatingMode = z.infer<typeof operatingModeSchema>;
export type CompiledPursuitModel = z.infer<typeof compiledPursuitModelSchema>;
export type RescueSignal = z.infer<typeof rescueSignalSchema>;
export type ChatPreferences = z.infer<typeof chatPreferencesSchema>;
export type MissionSnapshot = z.infer<typeof missionSnapshotSchema>;
export type { PursuitFamily } from "@/lib/pursuit/families";

export interface ForgeInterviewAnswer {
  id: string;
  question_key: string;
  question_text: string;
  answer_text: string;
  source: "user" | "system_inferred";
}

export interface ModuleConfig {
  /** tracker: named numeric/text fields to log per entry */
  fields?: Array<{ key: string; label: string; kind: "number" | "text" | "rating" }>;
  /** rescue_protocol / practice_system: ordered steps or drills */
  steps?: string[];
  /** planner: named slots/cadences */
  slots?: Array<{ label: string; cadence: string }>;
  /** practice_system: drills */
  drills?: Array<{ name: string; minutes: number }>;
  /** any extra free-form notes */
  notes?: string;
}

export interface ModuleEntry {
  id: string;
  created_at: string;
  data: Record<string, unknown>;
  note?: string;
}

export interface FeatureCandidate {
  id: string;
  name: string;
  description: string;
  problem_it_solves: string;
  leverage_score: number;
  immediacy_score: number;
  repeat_value_score: number;
  complexity_score: number;
  distinctiveness_score: number;
  total_score: number;
  rationale: string;
  module_type: string;
  config?: ModuleConfig;
  why?: string;
}

export interface GeneratedModuleManifest {
  id: string;
  name: string;
  module_type:
    | "coach_loop" | "planner" | "tracker" | "rescue_protocol"
    | "practice_system" | "evidence_log" | "simulator" | "review_engine";
  title: string;
  description: string;
  linked_workstream_ids: string[];
  primary_surface: "home" | "chat" | "plan" | "forge" | "insights";
  config: ModuleConfig;
  status: "draft" | "active" | "archived";
  entries?: ModuleEntry[];
  created_at?: string;
}

export interface ForgeState {
  interview_answers: ForgeInterviewAnswer[];
  candidate_features: FeatureCandidate[];
  selected_feature_ids: string[];
  generated_modules: GeneratedModuleManifest[];
  compiler_status: "idle" | "interviewing" | "model_ready" | "ranking" | "instantiated";
  last_generated_at?: string;
}

// ─── Forge Guidebook system ──────────────────────────────────────────────────

export type ForgeFeatureType =
  | "control_room" | "proof_builder" | "drill_lab" | "tracker" | "planner"
  | "simulator" | "coach_lens" | "research_helper" | "decision_engine"
  | "protocol" | "custom";

export type GuidebookFunctionType =
  | "generate" | "rank" | "critique" | "score" | "plan"
  | "reflect" | "diagnose" | "rewrite" | "summarize" | "decide";

export interface GuidebookInput {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "scale" | "number" | "date";
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

export interface GuidebookAIFunction {
  id: string;
  name: string;
  description: string;
  function_type: GuidebookFunctionType;
  prompt_contract: string;
  input_sources: string[];
  output_schema: Record<string, string>;
  writes_to_state: boolean;
  allowed_state_actions: string[];
}

export interface GuidebookSection {
  id: string;
  title: string;
  section_type:
    | "input_panel" | "ai_output" | "saved_entries" | "task_list"
    | "scorecard" | "timeline" | "protocol_steps" | "decision_result"
    | "reflection_box" | "audit_summary";
  description?: string;
  linked_ai_function_id?: string;
}

export interface GuidebookTaskOutput {
  title_template: string;
  category?: string;
}

export interface GuidebookAuditHook {
  signal_key: string;
  description: string;
}

export interface GuidebookStateWrite {
  action: string;
  description: string;
}

export interface ForgeGuidebook {
  id: string;
  feature_type: ForgeFeatureType;
  title: string;
  subtitle: string;
  purpose: string;
  bottleneck_addressed: string;
  route_slug: string;
  required_inputs: GuidebookInput[];
  ai_functions: GuidebookAIFunction[];
  sections: GuidebookSection[];
  task_outputs: GuidebookTaskOutput[];
  audit_hooks: GuidebookAuditHook[];
  state_writes: GuidebookStateWrite[];
  safety_rules: string[];
  status: "draft" | "active" | "paused" | "archived";
  created_at: string;
  updated_at: string;
  last_used_at?: string;
}

export interface FeatureRunResult {
  id: string;
  feature_id: string;
  run_at: string;
  function_id: string;
  function_type: string;
  inputs: Record<string, unknown>;
  output: Record<string, unknown>;
  state_writes_approved: string[];
  tasks_created: string[];
}

export interface ForgeSignal {
  id: string;
  feature_id: string;
  feature_title: string;
  signal_key: string;
  value: string;
  created_at: string;
}

export type AppMode =
  | "lock_goal"
  | "gather_constraints"
  | "build_day_plan"
  | "adjust_day_plan"
  | "update_after_action"
  | "weekly_reset";
