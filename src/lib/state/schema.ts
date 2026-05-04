import { z } from "zod";
import { PURSUIT_FAMILIES } from "@/lib/pursuit/families";

// --- Sub-schemas ---

export const fixedCommitmentSchema = z.object({
  id: z.string().default(""),
  title: z.string(),
  day_of_week: z.string().default(""),
  start_time: z.string().default(""),
  end_time: z.string().default(""),
  recurrence_type: z.string().default(""),
  importance: z.string().default(""),
});

export const activeGoalSchema = z.object({
  statement: z.string(),
  why_it_matters: z.string(),
  status: z.enum(["forming", "locked", "testing", "active", "unstable"]),
  phase: z.enum(["clarifying", "reality_testing", "path_mapping", "building", "recovering", "recommitting"]),
  seriousness_score: z.number().min(0).max(100),
  stability_score: z.number().min(0).max(100),
  reality_gap: z.string(),
  last_updated_at: z.string(),
});

export const constraintsSchema = z.object({
  school_end_time: z.string(),
  commute_minutes: z.number(),
  sleep_floor_time: z.string(),
  sleep_target_time: z.string(),
  exercise_minutes_daily: z.number(),
  study_minutes_daily: z.number(),
  fixed_commitments: z.array(fixedCommitmentSchema),
  preferred_work_window: z.string(),
  energy_pattern: z.enum(["morning", "afternoon", "night", "variable", "unknown"]),
  fixed_commitments_checked: z.boolean().default(false),
  missing_fields: z.array(z.string()),
});

export const pathwayDomainSchema = z.object({
  id: z.string(),
  name: z.string(),
  status: z.enum(["dormant", "forming", "active", "blocked", "fragile", "advancing"]),
  why_it_matters: z.string(),
  bottleneck: z.string(),
  next_proof: z.string(),
  growth_score: z.number().min(0).max(100).default(0),
  momentum: z.string().default("stable"),
  last_updated_at: z.string(),
});

export const scheduleBlockSchema = z.object({
  id: z.string(),
  title: z.string(),
  type: z.enum(["study", "goal_work", "exercise", "recovery", "meal", "commute", "fixed_commitment", "buffer", "wind_down"]),
  start_time: z.string(),
  end_time: z.string(),
  duration_minutes: z.number(),
  priority: z.union([z.number(), z.string()]),
  is_fixed: z.boolean(),
  source: z.string(),
  goal_link: z.string(),
  fallback_version: z.string(),
  linked_task_ids: z.array(z.string()).optional(),
  plan_type: z.enum(["plan_a", "plan_b"]).optional(),
  block_status: z.enum(["upcoming", "active", "done", "missed"]).optional(),
  status: z.enum(["dormant", "active", "upcoming", "completed", "partial", "missed", "adjusted", "blocked", "fallback"]).default("dormant"),
});

export const todayStateSchema = z.object({
  date: z.string(),
  energy: z.enum(["low", "medium", "high", "unknown"]),
  stress: z.enum(["low", "medium", "high", "unknown"]),
  alignment_signal: z.enum(["aligned", "drifting", "overwhelmed", "recovering", "unknown"]),
  current_bottleneck: z.string(),
  decisive_move: z.string(),
  decisive_move_reason: z.string(),
  available_time_blocks: z.array(z.string()),
  day_context_notes: z.string(),
});

// AUDIT FIX: day_plan_a_snapshot added to preserve original plan across reforms.
export const scheduleStateSchema = z.object({
  day_plan: z.array(scheduleBlockSchema),
  day_plan_a_snapshot: z.array(scheduleBlockSchema).default([]),
  week_plan: z.array(z.any()),
  assumptions: z.array(z.string()),
  confidence: z.number().min(0).max(100),
  last_plan_generated_at: z.string(),
  reform_note: z.string().default(""),
  relationships: z.array(z.object({
    from: z.string(),
    to: z.string(),
    type: z.enum(["sequential", "support", "constraint", "protection"]),
  })).default([]),
});

export const progressStateSchema = z.object({
  last_planned_action: z.string(),
  last_outcome: z.enum(["done", "partial", "missed", "rescheduled", "unknown"]),
  blockers: z.array(z.string()),
  what_changed: z.string(),
  last_checked_at: z.string(),
});

export const memoryStateSchema = z.object({
  stable_facts: z.record(z.string(), z.string()),
  semi_stable_patterns: z.record(z.string(), z.string()),
  open_questions: z.array(z.string()),
  expiring_assumptions: z.array(z.string()),
});

export const systemStateSchema = z.object({
  current_mode: z.enum(["lock_goal", "gather_constraints", "build_day_plan", "adjust_day_plan", "update_after_action", "weekly_reset"]),
  last_response_type: z.string(),
  state_version: z.number(),
});

export const taskTuneNoteSchema = z.object({
  at: z.string(),
  feedback: z.string(),
  change: z.string(),
});

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(""),
  status: z.enum(["pending", "in_progress", "done", "skipped"]),
  priority: z.enum(["high", "medium", "low"]),
  goal_id: z.string().default(""),
  domain_id: z.string().default(""),
  estimated_minutes: z.number().default(30),
  category: z.enum(["goal_direct", "bottleneck_removal", "maintenance", "discovery"]),
  created_at: z.string(),
  completed_at: z.string().default(""),
  due_date: z.string().default(""),
  energy_demand: z.enum(["low", "medium", "high"]).optional(),
  start_friction: z.enum(["low", "medium", "high"]).optional(),
  scheduled_block_id: z.string().optional(),
  parent_milestone_id: z.string().optional(),
  fallback_task_id: z.string().optional(),
  workstream_id: z.string().optional(),
  /** Lineage of Tune adjustments — visible on the task. */
  tune_notes: z.array(taskTuneNoteSchema).default([]).optional(),
  /** True when the task has been auto-mutated by feedback. */
  was_tuned: z.boolean().default(false).optional(),
  /** Original title before the most recent tune (for context only). */
  original_title: z.string().default("").optional(),
});

export const frictionTagSchema = z.enum([
  "hard_to_start",
  "distracted",
  "too_ambitious",
  "low_energy",
  "unclear_task",
  "interruptions",
]);

export const reflectionSchema = z.object({
  id: z.string(),
  date: z.string(),
  energy_rating: z.number().min(1).max(5),
  accomplishment: z.string(),
  struggle: z.string().default(""),
  tomorrow_intention: z.string().default(""),
  created_at: z.string(),
  stress_rating: z.number().min(1).max(5).optional(),
  win: z.string().optional(),
  friction_tags: z.array(frictionTagSchema).optional(),
  tomorrow_adjustment: z.string().optional(),
});

// Emotionally-intelligent feedback signals collected throughout the app.
// Tone rule: every option is observational, not evaluative of the user.
export const FEEDBACK_OPTIONS = [
  // task fit
  "easy",
  "hard",
  "too_vague",
  "too_big",
  "too_small",
  "valuable",
  "not_relevant",
  "need_help",
  "do_differently",
  // emotional / capacity signals (never diagnostic)
  "tired",
  "overwhelmed",
  "dont_understand",
  "feels_unrealistic",
  "wrong_time",
  "too_much_today",
  // shaping requests
  "make_simpler",
  "make_more_ambitious",
  "be_more_direct",
  "be_gentler",
] as const;

export const FEEDBACK_SOURCES = [
  "task",
  "plan",
  "schedule_block",
  "chat",
  "home",
  "mission",
  "pathway",
  "reflection",
  "nudge",
  "rescue",
] as const;

export const executionFeedbackItemSchema = z.object({
  id: z.string(),
  task_id: z.string().default(""),
  task_title: z.string().default(""),
  /** Empty string when feedback was given before task completion. */
  completed_at: z.string().default(""),
  feedback: z.enum(FEEDBACK_OPTIONS),
  note: z.string().default(""),
  created_at: z.string(),
  source: z.enum(FEEDBACK_SOURCES).default("task"),
  target_id: z.string().default(""),
});

export const alignmentStateSchema = z.object({
  status: z.enum(["aligned", "drifting", "overwhelmed", "recovering"]),
  drift_score: z.number().min(0).max(100),
  last_updated: z.string(),
  reasons: z.array(z.string()),
});

export const homeStateSchema = z.object({
  active_plan: z.enum(["plan_a", "plan_b"]),
});

export const rescueSignalSchema = z.object({
  id: z.string(),
  reason: z.enum(["overwhelmed", "tired", "stuck", "anxious"]),
  created_at: z.string(),
  affected_task_id: z.string().default(""),
  shrunk_to_minutes: z.number().default(0),
  switched_to_plan_b: z.boolean().default(false),
  note: z.string().default(""),
});

export const chatPreferencesSchema = z.object({
  tone: z.enum(["default", "gentler", "more_direct"]).default("default"),
});

export const forgeStateSchema = z.object({
  interview_answers: z.array(z.any()).default([]),
  candidate_features: z.array(z.any()).default([]),
  selected_feature_ids: z.array(z.string()).default([]),
  generated_modules: z.array(z.any()).default([]),
  compiler_status: z.enum(["idle", "interviewing", "model_ready", "ranking", "instantiated"]).default("idle"),
  last_generated_at: z.string().optional(),
});

// --- Pursuit compiler sub-schemas ---
export const pursuitStandardSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  target_value: z.string().default(""),
  current_value: z.string().default(""),
  trajectory: z.enum(["below", "at_risk", "on_track", "ahead"]),
  kind: z.string().default(""),
  last_checked_at: z.string().default(""),
  source: z.string().default("compiler"),
});
export const capabilityClusterSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  status: z.enum(["not_started", "emerging", "developing", "solid", "mastered"]),
  why_it_matters: z.string().default(""),
  source: z.string().default("compiler"),
});
export const pursuitWorkstreamSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  status: z.enum(["not_started", "on_track", "slipping", "stalled", "complete"]),
  priority: z.enum(["critical", "high", "medium", "low"]),
  bottleneck: z.string().default(""),
  next_proof: z.string().default(""),
  last_updated_at: z.string().default(""),
  source: z.string().default("compiler"),
});
export const pursuitRiskSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  severity: z.enum(["critical", "high", "medium", "low"]),
  mitigation: z.string().default(""),
  source: z.string().default("compiler"),
});
export const evidenceSignalSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["leading", "lagging"]),
  description: z.string().default(""),
  cadence: z.string().default(""),
  target: z.string().default(""),
  last_value: z.string().default(""),
  last_checked_at: z.string().default(""),
  source: z.string().default("compiler"),
});
export const operatingModeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().default(""),
  stance: z.string().default(""),
  when_to_use: z.string().default(""),
});
export const compiledPursuitModelSchema = z.object({
  pursuit_family: z.enum(PURSUIT_FAMILIES),
  family_confidence: z.number().min(0).max(100),
  inferred_reasons: z.array(z.string()).default([]),
  summary: z.string().default(""),
  assumptions: z.array(z.string()).default([]),
  standards: z.array(pursuitStandardSchema).default([]),
  capability_clusters: z.array(capabilityClusterSchema).default([]),
  workstreams: z.array(pursuitWorkstreamSchema).default([]),
  risks: z.array(pursuitRiskSchema).default([]),
  evidence_signals: z.array(evidenceSignalSchema).default([]),
  operating_modes: z.array(operatingModeSchema).default([]),
  active_operating_mode_id: z.string().default(""),
  compiled_at: z.string(),
  compiled_from_goal_hash: z.string(),
});

// --- Full state schema ---
export const momentStateSchema = z.object({
  user_id: z.string(),
  profile: z.object({
    display_name: z.string(),
    timezone: z.string(),
    created_at: z.string(),
    last_active_at: z.string(),
  }),
  active_goal: activeGoalSchema,
  constraints: constraintsSchema,
  pathway: z.object({ domains: z.array(pathwayDomainSchema) }),
  today_state: todayStateSchema,
  schedule_state: scheduleStateSchema,
  progress_state: progressStateSchema,
  memory_state: memoryStateSchema,
  system_state: systemStateSchema,
  tasks: z.array(taskSchema),
  reflections: z.array(reflectionSchema),
  // AUDIT FIX: execution_feedback as a first-class field.
  execution_feedback: z.array(executionFeedbackItemSchema).default([]),
  alignment: alignmentStateSchema,
  home: homeStateSchema,
  forge_state: forgeStateSchema.default({
    interview_answers: [], candidate_features: [], selected_feature_ids: [],
    generated_modules: [], compiler_status: "idle",
  }),
  pursuit_model: compiledPursuitModelSchema.nullable(),
  rescue_signals: z.array(rescueSignalSchema).default([]),
  chat_preferences: chatPreferencesSchema.default({ tone: "default" }),
});
