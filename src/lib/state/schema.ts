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

export const goalFeasibilityReportSchema = z.object({
  goal_is_possible: z.boolean(),
  goal_type: z.enum(["near_term", "long_term", "career", "academic", "creative", "fitness", "business", "other"]),
  user_stage: z.string(),
  target_stage: z.string(),
  reality_gap: z.string(),
  risk_of_bad_advice: z.enum(["low", "medium", "high"]),
  premature_recommendations: z.array(z.string()),
  appropriate_focus_now: z.array(z.string()),
  next_clarifying_question: z.string().optional(),
});

export const activeGoalSchema = z.object({
  id: z.string().default(""),
  statement: z.string(),
  why_it_matters: z.string(),
  status: z.enum(["forming", "locked", "testing", "active", "unstable"]),
  phase: z.enum(["clarifying", "reality_testing", "path_mapping", "building", "recovering", "recommitting"]),
  seriousness_score: z.number().min(0).max(100),
  stability_score: z.number().min(0).max(100),
  reality_gap: z.string(),
  last_updated_at: z.string(),
  horizon: z.enum(["days", "weeks", "months", "years", "decade"]).optional(),
  desired_identity: z.string().default(""),
  success_definition: z.string().default(""),
  current_stage: z.string().default(""),
  target_stage: z.string().default(""),
  feasibility: goalFeasibilityReportSchema.optional(),
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

// Liquid weekly grid — a 7-day plan that's easily reformable.
export const WEEK_CATEGORIES = ["school", "goal", "commitment", "hobby", "rest"] as const;
export const weekBlockSchema = z.object({
  id: z.string(),
  day_index: z.number().min(0).max(6), // 0 = Mon … 6 = Sun
  start_time: z.string(), // "HH:MM"
  end_time: z.string(),   // "HH:MM"
  title: z.string(),
  category: z.enum(WEEK_CATEGORIES),
  notes: z.string().default(""),
  is_locked: z.boolean().default(false), // school/commitments stay put unless edited
  /** When this block was auto-created to back a task, link it here so the
   *  block follows the task lifecycle (delete/complete removes the block). */
  task_id: z.string().optional(),
});

// AUDIT FIX: day_plan_a_snapshot added to preserve original plan across reforms.
export const scheduleStateSchema = z.object({
  day_plan: z.array(scheduleBlockSchema),
  day_plan_a_snapshot: z.array(scheduleBlockSchema).default([]),
  week_plan: z.array(weekBlockSchema).default([]),
  week_plan_generated_at: z.string().default(""),
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
  // Stage-fit enforcement fields (populated by task-stage-filter before tasks enter state)
  user_stage_fit: z.enum(["strong", "okay", "weak", "premature"]).optional(),
  why_now: z.string().default("").optional(),
  pathway_node: z.string().optional(),
  prerequisite_link: z.string().optional(),
  proof_of_completion: z.string().optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  required_resources: z.array(z.string()).default([]).optional(),
  blocked_reason: z.string().default("").optional(),
  created_by: z.enum(["user", "ai"]).default("user").optional(),
  forge_feature_id: z.string().optional(),
  /** Optional URL to use when the task involves online work (research, course, signup, doc). */
  resource_url: z.string().url().optional().or(z.literal("")),
  resource_label: z.string().optional(),
  /** User-authored notes attached to this task. */
  notes: z
    .array(
      z.object({
        id: z.string(),
        content: z.string(),
        created_at: z.string(),
      }),
    )
    .default([])
    .optional(),
  /** Last saved AI review of task notes, including the mini-lesson. */
  note_review: z
    .object({
      headline: z.string().default(""),
      key_insights: z.array(z.string()).default([]),
      gaps: z.array(z.string()).default([]),
      mini_lesson: z.object({ title: z.string().default(""), body: z.string().default("") }).default({ title: "", body: "" }),
      next_step: z.string().default(""),
      created_at: z.string().default(""),
    })
    .optional(),
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

// ─── Exam Emergency schemas ───────────────────────────────────────────────────

const triScore = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);

export const examTopicSchema = z.object({
  id: z.string(),
  name: z.string(),
  confidence: triScore,
  mark_value: triScore.optional(),
  likelihood: triScore.optional(),
  time_cost: triScore.optional(),
  quick_win_potential: triScore.optional(),
  priority: z.enum(["critical", "high", "medium", "low", "ignore_for_now"]).default("medium"),
});

export const studyBlockSchema = z.object({
  id: z.string(),
  title: z.string(),
  topic_ids: z.array(z.string()).default([]),
  duration_minutes: z.number().default(25),
  method: z.enum([
    "active_recall", "practice_questions", "summary",
    "flashcards", "essay_plan", "formula_drill",
  ]),
  goal: z.string(),
  success_criteria: z.string(),
  fallback_if_stuck: z.string(),
});

export const studyWindowSchema = z.object({
  start_time: z.string(),
  end_time: z.string(),
  day_label: z.string(),
  available_minutes: z.number(),
});

export const examBlockFeedbackSchema = z.object({
  block_id: z.string(),
  result: z.enum(["easy", "hard", "confused", "avoided", "too_long", "completed"]),
  note: z.string().optional(),
  created_at: z.string(),
});

export const examCurrentPlanSchema = z.object({
  survival_plan: z.array(studyBlockSchema).default([]),
  recovery_plan: z.array(studyBlockSchema).default([]),
  stretch_plan: z.array(studyBlockSchema).default([]),
});

export const examTaskProfileSchema = z.object({
  exam_format: z.string().optional(),
  section_breakdown: z.array(z.object({
    name: z.string(),
    marks: z.number().optional(),
    description: z.string().optional(),
  })).default([]),
  rubric_notes: z.string().optional(),
  mark_allocation: z.string().optional(),
  common_mistakes: z.string().optional(),
  set_by: z.string().optional(),
  past_paper_url: z.string().optional(),
  updated_at: z.string().optional(),
});

export const examResourceSchema = z.object({
  id: z.string(),
  type: z.enum(["notes", "textbook", "past_paper", "rubric", "formula_sheet", "other"]),
  label: z.string(),
  content_text: z.string().optional(),
  url: z.string().optional(),
  topic_ids: z.array(z.string()).default([]),
  added_at: z.string(),
});

export const examQuestionSchema = z.object({
  id: z.string(),
  type: z.enum(["quick_quiz", "explain_back", "past_paper_style", "essay_plan", "definition", "formula", "weak_topic"]),
  topic_id: z.string().optional(),
  topic_name: z.string().optional(),
  question_text: z.string(),
  marks: z.number().optional(),
  model_answer: z.string().optional(),
  hints: z.array(z.string()).default([]),
  source: z.enum(["ai", "local_template"]).default("local_template"),
  created_at: z.string(),
});

export const examAnswerAttemptSchema = z.object({
  id: z.string(),
  question_id: z.string(),
  answer_text: z.string(),
  created_at: z.string(),
  rating_id: z.string().optional(),
});

export const examWorkRatingSchema = z.object({
  id: z.string(),
  question_id: z.string(),
  answer_attempt_id: z.string(),
  score_out_of: z.number().optional(),
  max_marks: z.number().optional(),
  level: z.enum(["needs_work", "developing", "solid", "strong"]),
  missing_points: z.array(z.string()).default([]),
  upgrade_suggestion: z.string(),
  model_comparison: z.string().optional(),
  source: z.enum(["ai", "local_heuristic"]).default("local_heuristic"),
  created_at: z.string(),
});

export const examEmergencySchema = z.object({
  id: z.string(),
  subject: z.string(),
  exam_date_time: z.string(),
  status: z.enum(["intake", "active", "recovering", "completed"]).default("intake"),
  preparedness_score: z.number().min(1).max(10).optional(),
  topics: z.array(examTopicSchema).default([]),
  available_study_windows: z.array(studyWindowSchema).default([]),
  target_outcome: z.enum(["survive", "solid", "high_score"]).optional(),
  current_plan: examCurrentPlanSchema.default({ survival_plan: [], recovery_plan: [], stretch_plan: [] }),
  active_block_id: z.string().optional(),
  feedback: z.array(examBlockFeedbackSchema).default([]),
  intake_status: z.enum([
    "needs_subject", "needs_exam_time", "needs_topics",
    "needs_available_time", "ready_to_build", "active",
  ]).default("needs_subject"),
  reflection: z.object({
    result: z.enum(["easy", "okay", "hard", "very_hard"]).optional(),
    surprise: z.string().optional(),
    next_time: z.string().optional(),
    created_at: z.string().optional(),
  }).optional(),
  task_profile: examTaskProfileSchema.optional(),
  resources: z.array(examResourceSchema).default([]),
  questions: z.array(examQuestionSchema).default([]),
  answer_attempts: z.array(examAnswerAttemptSchema).default([]),
  work_ratings: z.array(examWorkRatingSchema).default([]),
  copilot_mode: z.enum(["intake", "task_profile", "resource_intake", "questioner", "work_rater"]).default("intake"),
  copilot_session_count: z.number().default(0),
  created_at: z.string(),
  updated_at: z.string(),
});

export const chatPreferencesSchema = z.object({
  tone: z.enum(["default", "gentler", "more_direct"]).default("default"),
});

export const chatStateSchema = z.object({
  post_onboarding_specialisation_required: z.boolean().default(false),
  specialisation_phase: z.enum([
    "explain_goal",
    "map_reality",
    "locate_user",
    "choose_first_path",
    "activate_first_move",
    "complete",
  ]).default("explain_goal"),
});

export const contextVideoSceneSchema = z.object({
  scene_number: z.number(),
  visual_prompt: z.string().default(""),
  voiceover: z.string().default(""),
  on_screen_text: z.string().default(""),
  duration_seconds: z.number().default(5),
  palette: z.object({
    bg: z.string().default("#0a0a14"),
    fg: z.string().default("#ffffff"),
    accent: z.string().default("#ff5a36"),
  }).default({ bg: "#0a0a14", fg: "#ffffff", accent: "#ff5a36" }),
  audio_base64: z.string().optional(),
});

export const contextVideoSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  format: z.enum(["pov", "roast", "trailer", "recap", "mission_briefing", "mockumentary", "motivational_edit"]),
  tone: z.string().default("playful"),
  title: z.string(),
  hook: z.string().default(""),
  scenes: z.array(contextVideoSceneSchema).default([]),
  caption: z.string().default(""),
  call_to_action: z.object({
    kind: z.enum(["start_task", "break_down", "reform_plan", "schedule", "reflect", "open_node", "rescue"]),
    label: z.string(),
    task_id: z.string().optional(),
    node_id: z.string().optional(),
    prompt: z.string().optional(),
    when: z.string().optional(),
  }),
  has_voiceover: z.boolean().default(false),
});

export const forgeStateSchema = z.object({
  interview_answers: z.array(z.any()).default([]),
  candidate_features: z.array(z.any()).default([]),
  selected_feature_ids: z.array(z.string()).default([]),
  generated_modules: z.array(z.any()).default([]),
  compiler_status: z.enum(["idle", "interviewing", "model_ready", "ranking", "instantiated"]).default("idle"),
  last_generated_at: z.string().optional(),
  guidebooks: z.array(z.any()).default([]),
  feature_runs: z.array(z.any()).default([]),
  forge_signals: z.array(z.any()).default([]),
  guidebook_build_status: z.string().default("idle"),
  draft_guidebook: z.any().nullable().default(null),
  forge_videos: z.array(contextVideoSchema).default([]),
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

// --- Onboarding schema ---
export const onboardingSchema = z.object({
  completed: z.boolean().default(false),
  current_stage: z.string().default(""),
  answers: z.record(z.string(), z.any()).default({}),
  last_updated: z.string().default(""),
  understanding: z.object({
    knowns: z.array(z.string()).default([]),
    unknowns: z.array(z.string()).default([]),
    assumptions: z.array(z.string()).default([]),
    confidence: z.enum(["low", "medium", "high"]).default("low"),
  }).default({ knowns: [], unknowns: [], assumptions: [], confidence: "low" }),
});

export const chatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  created_at: z.string().default(""),
  mode: z.enum(["chat", "goal_specialisation"]).optional(),
});

// --- Full state schema ---
export const momentStateSchema = z.object({
  user_id: z.string(),
  profile: z.object({
    display_name: z.string(),
    timezone: z.string(),
    created_at: z.string(),
    last_active_at: z.string(),
    age: z.number().optional(),
    age_bracket: z.enum(["under_13", "teen_13_15", "teen_16_18", "adult", "unknown"]).default("unknown"),
    school_year: z.string().optional(),
    academic_context: z.string().optional(),
    normal_weekday: z.string().optional(),
    commitments: z.array(z.string()).default([]),
    country: z.string().optional(),
    education_system: z.enum([
      "uk_a_levels", "uk_gcse", "ib", "us_ap", "us_highschool",
      "au_atar", "au_hsc", "ca_ontario", "ca_ib", "sg_a_levels",
      "in_cbse", "in_isc", "other", "unknown",
    ]).default("unknown"),
    preferences: z.object({
      tone: z.enum(["gentle", "direct", "energising", "calm", "strict"]).default("calm"),
      strictness: z.enum(["soft", "firm", "minimal"]).default("soft"),
      schedule_style: z.enum(["structured", "flexible", "mixed"]).default("flexible"),
      support_style: z.enum(["coach", "advisor", "accountability", "cheerleader"]).default("coach"),
    }).default({ tone: "calm", strictness: "soft", schedule_style: "flexible", support_style: "coach" }),
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
  exam_emergencies: z.array(examEmergencySchema).optional().default([]),
  chat_messages: z.array(chatMessageSchema).default([]),
  chat_preferences: chatPreferencesSchema.default({ tone: "default" }),
  chat_state: chatStateSchema.default({
    post_onboarding_specialisation_required: false,
    specialisation_phase: "explain_goal",
  }),
  onboarding: onboardingSchema.default({
    completed: false,
    current_stage: "",
    answers: {},
    last_updated: "",
    understanding: { knowns: [], unknowns: [], assumptions: [], confidence: "low" },
  }),
});
