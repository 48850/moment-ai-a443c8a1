import { z } from "zod";
import {
  momentStateSchema,
  fixedCommitmentSchema,
  scheduleBlockSchema,
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
} from "@/lib/state/schema";

export type MomentState = z.infer<typeof momentStateSchema>;
export type FixedCommitment = z.infer<typeof fixedCommitmentSchema>;
export type ScheduleBlock = z.infer<typeof scheduleBlockSchema>;
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
export type { PursuitFamily } from "@/lib/pursuit/families";

export interface ForgeInterviewAnswer {
  id: string;
  question_key: string;
  question_text: string;
  answer_text: string;
  source: "user" | "system_inferred";
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
  config: Record<string, unknown>;
  status: "draft" | "active" | "archived";
}

export interface ForgeState {
  interview_answers: ForgeInterviewAnswer[];
  candidate_features: FeatureCandidate[];
  selected_feature_ids: string[];
  generated_modules: GeneratedModuleManifest[];
  compiler_status: "idle" | "interviewing" | "model_ready" | "ranking" | "instantiated";
  last_generated_at?: string;
}

export type AppMode =
  | "lock_goal"
  | "gather_constraints"
  | "build_day_plan"
  | "adjust_day_plan"
  | "update_after_action"
  | "weekly_reset";
