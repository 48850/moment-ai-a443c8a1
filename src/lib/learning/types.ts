/**
 * Learning Engine — core types.
 *
 * Privacy rules enforced here:
 * - No raw user text in signal metadata (no goal statement, no task titles, no chat content).
 * - Metadata is behavioural only: numbers, enums, timestamps.
 * - Every derived claim carries confidence (0–1) + evidence_count.
 * - User can dismiss any insight; dismissed items never resurface.
 */

export type LearningSignalType =
  | "task_completed"
  | "task_missed"
  | "task_rescheduled"
  | "task_feedback_submitted"
  | "task_tuned"
  | "plan_generated"
  | "plan_reformed"
  | "plan_block_completed"
  | "plan_block_failed"
  | "forge_feature_created"
  | "forge_feature_used"
  | "forge_feature_reused"
  | "forge_feature_abandoned"
  | "rescue_triggered"
  | "rescue_resolved"
  | "chat_question_answered"
  | "onboarding_completed";

export type LearningSurface =
  | "chat"
  | "plan"
  | "tasks"
  | "dashboard"
  | "forge"
  | "mission"
  | "rescue"
  | "audit"
  | "onboarding";

/**
 * Behavioural-only metadata — no raw user text.
 * All fields are optional; only populate what is known at the callsite.
 */
export interface LearningSignalMeta {
  estimated_minutes?: number;
  actual_minutes?: number;
  feedback_key?: string;
  hour_of_day?: number; // 0–23
  day_of_week?: number; // 0 = Mon … 6 = Sun
  surface?: LearningSurface;
  feature_type?: string;
  task_category?: string;
  task_priority?: string;
  completed?: boolean;
  plan_switched?: boolean;
  tune_applied?: boolean;
  rescue_reason?: string;
  [key: string]: string | number | boolean | undefined;
}

export interface LearningSignal {
  id: string;
  created_at: string;
  signal_type: LearningSignalType;
  source_surface: LearningSurface;
  task_id?: string;
  forge_feature_id?: string;
  metadata: LearningSignalMeta;
  /** private = never leaves device; aggregate_ok = can be used in cohort analysis */
  privacy_level: "private" | "aggregate_ok";
  confidence: number; // 0–1
  outcome_value?: number;
}

export interface FrictionTag {
  tag: string;
  confidence: number;
  evidence_count: number;
}

export interface WorkWindow {
  window: string; // e.g. "morning", "after-school", "evening"
  confidence: number;
  evidence_count: number;
}

export interface AdaptationRule {
  id: string;
  rule: string;
  reason: string;
  confidence: number;
  evidence_count: number;
}

export interface UserLearningProfile {
  derived_at: string;
  signal_count: number;
  preferred_task_size: "micro" | "short" | "medium" | "deep" | "unknown";
  best_work_windows: WorkWindow[];
  friction_tags: FrictionTag[];
  plan_style: "strict" | "flexible" | "starter_first" | "deep_work" | "unknown";
  chat_style: "direct" | "gentle" | "challenge" | "minimal" | "unknown";
  current_bottleneck: { claim: string; confidence: number; evidence: string[] } | null;
  adaptation_rules: AdaptationRule[];
  dismissed_insights: string[]; // rule ids dismissed by user
}
