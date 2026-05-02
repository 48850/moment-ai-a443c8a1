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

export type AppMode =
  | "lock_goal"
  | "gather_constraints"
  | "build_day_plan"
  | "adjust_day_plan"
  | "update_after_action"
  | "weekly_reset";
