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
  chatMessageSchema,
  goalFeasibilityReportSchema,
  onboardingSchema,
  examEmergencySchema,
  examTopicSchema,
  studyBlockSchema,
  studyWindowSchema,
  examBlockFeedbackSchema,
  examTaskProfileSchema,
  examResourceSchema,
  examQuestionSchema,
  examAnswerAttemptSchema,
  examWorkRatingSchema,
} from "@/lib/state/schema";

export type MomentState = z.infer<typeof momentStateSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type GoalFeasibilityReport = z.infer<typeof goalFeasibilityReportSchema>;
export type OnboardingState = z.infer<typeof onboardingSchema>;
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
export type ExamEmergency = z.infer<typeof examEmergencySchema>;
export type ExamTopic = z.infer<typeof examTopicSchema>;
export type StudyBlock = z.infer<typeof studyBlockSchema>;
export type StudyWindow = z.infer<typeof studyWindowSchema>;
export type ExamBlockFeedback = z.infer<typeof examBlockFeedbackSchema>;
export type ExamTaskProfile = z.infer<typeof examTaskProfileSchema>;
export type ExamResource = z.infer<typeof examResourceSchema>;
export type ExamQuestion = z.infer<typeof examQuestionSchema>;
export type ExamAnswerAttempt = z.infer<typeof examAnswerAttemptSchema>;
export type ExamWorkRating = z.infer<typeof examWorkRatingSchema>;
export type ChatPreferences = z.infer<typeof chatPreferencesSchema>;
export type { PursuitFamily } from "@/lib/pursuit/families";

// ─── Legacy module system (kept for backward compatibility) ───────────────────

export interface ForgeInterviewAnswer {
  id: string;
  question_key: string;
  question_text: string;
  answer_text: string;
  source: "user" | "system_inferred";
}

export interface ModuleConfig {
  fields?: Array<{ key: string; label: string; kind: "number" | "text" | "rating" }>;
  steps?: string[];
  slots?: Array<{ label: string; cadence: string }>;
  drills?: Array<{ name: string; minutes: number }>;
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

// ─── Guidebook system ─────────────────────────────────────────────────────────

export type ForgeFeatureType =
  | "tracker"
  | "protocol"
  | "control_room"
  | "drill_lab"
  | "proof_builder"
  | "decision_engine"
  | "planner"
  | "simulator"
  | "coach_lens"
  | "research_helper"
  | "custom";

export interface GuidebookInput {
  id: string;
  label: string;
  type: "text" | "textarea" | "number" | "select" | "date" | "scale" | "file_link";
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export interface GuidebookSection {
  id: string;
  title: string;
  description?: string;
  section_type:
    | "input_panel"
    | "ai_output"
    | "saved_entries"
    | "task_list"
    | "scorecard"
    | "timeline"
    | "protocol_steps"
    | "decision_result"
    | "reflection_box"
    | "audit_summary";
  linked_ai_function_id?: string;
  linked_state_key?: string;
}

export interface GuidebookAIFunction {
  id: string;
  name: string;
  description: string;
  function_type:
    | "analyze"
    | "generate_plan"
    | "split_tasks"
    | "score_quality"
    | "rank_options"
    | "simulate"
    | "challenge"
    | "summarize"
    | "extract_signals"
    | "create_next_move";
  input_sources: string[];
  output_schema: Record<string, unknown>;
  prompt_contract: string;
  writes_to_state: boolean;
  allowed_state_actions: string[];
}

export interface GuidebookStateWrite {
  action:
    | "task/create"
    | "task/update"
    | "forge/log_signal"
    | "forge/check_in"
    | "audit/add_signal"
    | "reflection/add"
    | "plan/add_item"
    | "chat/add_context"
    | "rescue/create_signal";
  conditions: string;
  user_confirmation_required: boolean;
}

export interface GuidebookTaskOutput {
  id: string;
  title_template: string;
  description_template?: string;
  priority: "high" | "medium" | "low";
  trigger: string;
}

export interface GuidebookAuditHook {
  signal_key: string;
  description: string;
  trigger: string;
}

export interface ForgeGuidebook {
  id: string;
  title: string;
  subtitle: string;
  purpose: string;
  linked_goal_id: string;
  bottleneck_addressed: string;
  feature_type: ForgeFeatureType;
  status: "draft" | "active" | "paused" | "archived";
  route_slug: string;
  required_inputs: GuidebookInput[];
  sections: GuidebookSection[];
  ai_functions: GuidebookAIFunction[];
  state_writes: GuidebookStateWrite[];
  task_outputs: GuidebookTaskOutput[];
  audit_hooks: GuidebookAuditHook[];
  chat_context_summary: string;
  safety_rules: string[];
  created_at: string;
  updated_at: string;
  last_used_at: string;
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

// ─── State ────────────────────────────────────────────────────────────────────

export interface ForgeState {
  // Legacy module system
  interview_answers: ForgeInterviewAnswer[];
  candidate_features: FeatureCandidate[];
  selected_feature_ids: string[];
  generated_modules: GeneratedModuleManifest[];
  compiler_status: "idle" | "interviewing" | "model_ready" | "ranking" | "instantiated";
  last_generated_at?: string;

  // Guidebook system
  guidebooks: ForgeGuidebook[];
  feature_runs: FeatureRunResult[];
  forge_signals: ForgeSignal[];
  guidebook_build_status: "idle" | "asking" | "generating" | "preview" | "done";
  draft_guidebook?: Partial<ForgeGuidebook> | null;
}

export type AppMode =
  | "lock_goal"
  | "gather_constraints"
  | "build_day_plan"
  | "adjust_day_plan"
  | "update_after_action"
  | "weekly_reset";
