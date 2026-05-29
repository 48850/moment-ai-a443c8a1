import type { MomentState } from "@/lib/types";
import { compilePursuitModel } from "@/lib/pursuit/compiler";
import { seedWeekPlan } from "@/lib/engine/week-plan";

const now = () => new Date().toISOString();

/**
 * For real new users: no demo data, no fake goal.
 * Every required field is present; all content is empty/safe.
 */
export function createEmptyUserState(userId: string, displayName: string, timezone: string): MomentState {
  const ts = now();
  return {
    user_id: userId,
    profile: {
      display_name: displayName,
      timezone,
      created_at: ts,
      last_active_at: ts,
      age_bracket: "unknown",
      commitments: [],
      preferences: { tone: "calm", strictness: "soft", schedule_style: "flexible", support_style: "coach" },
    },
    active_goal: {
      statement: "",
      why_it_matters: "",
      status: "forming",
      phase: "clarifying",
      seriousness_score: 0,
      stability_score: 0,
      reality_gap: "",
      last_updated_at: ts,
      desired_identity: "",
      success_definition: "",
      current_stage: "",
      target_stage: "",
    },
    constraints: {
      school_end_time: "",
      commute_minutes: 0,
      sleep_floor_time: "23:30",
      sleep_target_time: "23:00",
      exercise_minutes_daily: 0,
      study_minutes_daily: 60,
      fixed_commitments: [],
      preferred_work_window: "",
      energy_pattern: "unknown",
      fixed_commitments_checked: false,
      missing_fields: ["school_end_time", "commute_minutes", "study_minutes_daily"],
    },
    pathway: { domains: [] },
    today_state: {
      date: ts.slice(0, 10),
      energy: "unknown",
      stress: "unknown",
      alignment_signal: "unknown",
      current_bottleneck: "",
      decisive_move: "",
      decisive_move_reason: "",
      available_time_blocks: [],
      day_context_notes: "",
    },
    schedule_state: {
      day_plan: [],
      day_plan_a_snapshot: [],
      week_plan: [],
      week_plan_generated_at: "",
      assumptions: [],
      confidence: 0,
      last_plan_generated_at: ts,
      reform_note: "",
      relationships: [],
    },
    progress_state: {
      last_planned_action: "",
      last_outcome: "unknown",
      blockers: [],
      what_changed: "",
      last_checked_at: "",
    },
    memory_state: {
      stable_facts: {},
      semi_stable_patterns: {},
      open_questions: [],
      expiring_assumptions: [],
    },
    system_state: {
      current_mode: "lock_goal",
      last_response_type: "",
      state_version: 1,
    },
    tasks: [],
    reflections: [],
    execution_feedback: [],
    alignment: {
      status: "aligned",
      drift_score: 0,
      last_updated: ts,
      reasons: [],
    },
    home: { active_plan: "plan_a" },
    forge_state: {
      interview_answers: [],
      candidate_features: [],
      selected_feature_ids: [],
      generated_modules: [],
      compiler_status: "idle",
    },
    pursuit_model: null,
    rescue_signals: [],
    exam_emergencies: [],
    goals: [],
    moment_trials: [],
    mistake_cards: [],
    chat_messages: [],
    chat_preferences: { tone: "default" },
    chat_state: {
      post_onboarding_specialisation_required: false,
      specialisation_phase: "explain_goal" as const,
    },
    onboarding: {
      completed: false,
      current_stage: "",
      answers: {},
      last_updated: ts,
      understanding: { knowns: [], unknowns: [], assumptions: [], confidence: "low" },
    },
  };
}

/**
 * For dev/demo only — loaded when ?demo=true or VITE_ENABLE_DEMO_STATE=true.
 * Never shown to real new users.
 */
export function createDemoState(userId: string, displayName: string, timezone: string): MomentState {
  const ts = now();
  const base = createEmptyUserState(userId, displayName, timezone);

  const active_goal: MomentState["active_goal"] = {
    statement: "Stanford CS, class of 2027",
    why_it_matters: "I want to build things that matter at the level Stanford CS opens up.",
    status: "active",
    phase: "building",
    seriousness_score: 78,
    stability_score: 65,
    reality_gap: "Essay opener still unclear; SAT below target.",
    last_updated_at: ts,
    desired_identity: "A builder who ships things that matter.",
    success_definition: "Admitted to Stanford CS class of 2027.",
    current_stage: "high school junior with strong math and some CS",
    target_stage: "Stanford admitted applicant",
  };

  const tasks: MomentState["tasks"] = [
    {
      id: "t-essay-opener",
      title: "Draft three opening lines for the Stanford 'why us' essay",
      description: "Pick the one that scares you most. 25-min sprint.",
      status: "pending",
      priority: "high",
      goal_id: "",
      domain_id: "",
      estimated_minutes: 25,
      category: "goal_direct",
      created_at: ts,
      completed_at: "",
      due_date: "",
      created_by: "user",
      resource_url: "https://www.collegeessayguy.com/blog/stanford-why-us-essay",
      resource_label: "College Essay Guy — Stanford 'Why Us' Guide",
    },
    {
      id: "t1",
      title: "Re-read last essay draft",
      description: "",
      status: "pending",
      priority: "medium",
      goal_id: "",
      domain_id: "",
      estimated_minutes: 15,
      category: "goal_direct",
      created_at: ts,
      completed_at: "",
      due_date: "",
      created_by: "user",
    },
    {
      id: "t2",
      title: "30-min focused math review (problem set 4)",
      description: "",
      status: "pending",
      priority: "medium",
      goal_id: "",
      domain_id: "",
      estimated_minutes: 30,
      category: "goal_direct",
      created_at: ts,
      completed_at: "",
      due_date: "",
      created_by: "user",
      resource_url: "https://www.khanacademy.org/math/ap-calculus-ab",
      resource_label: "Khan Academy — AP Calculus AB",
    },
    {
      id: "t3",
      title: "Email Mr. Patel about rec letter",
      description: "",
      status: "done",
      priority: "low",
      goal_id: "",
      domain_id: "",
      estimated_minutes: 10,
      category: "maintenance",
      created_at: ts,
      completed_at: ts,
      due_date: "",
      created_by: "user",
    },
    {
      id: "u1",
      title: "Order SAT prep book",
      description: "",
      status: "pending",
      priority: "low",
      goal_id: "",
      domain_id: "",
      estimated_minutes: 5,
      category: "maintenance",
      created_at: ts,
      completed_at: "",
      due_date: "",
      created_by: "user",
      resource_url: "https://www.amazon.com/s?k=SAT+prep+book+2025",
      resource_label: "Amazon — SAT Prep Books 2025",
    },
  ];

  const day_plan: MomentState["schedule_state"]["day_plan"] = [
    {
      id: "b1",
      title: "School",
      type: "fixed_commitment",
      start_time: "08:00",
      end_time: "15:30",
      duration_minutes: 450,
      priority: 1,
      is_fixed: true,
      source: "seed",
      goal_link: "",
      fallback_version: "",
      status: "completed",
    },
    {
      id: "b3",
      title: "Essay opener sprint",
      type: "study",
      start_time: "16:30",
      end_time: "17:00",
      duration_minutes: 30,
      priority: 1,
      is_fixed: false,
      source: "seed",
      goal_link: active_goal.statement,
      fallback_version: "",
      status: "upcoming",
      linked_task_ids: ["t-essay-opener"],
    },
    {
      id: "b5",
      title: "Math problem set 4",
      type: "study",
      start_time: "17:20",
      end_time: "18:00",
      duration_minutes: 40,
      priority: 2,
      is_fixed: false,
      source: "seed",
      goal_link: "",
      fallback_version: "",
      status: "upcoming",
      linked_task_ids: ["t2"],
    },
    {
      id: "b6",
      title: "Run",
      type: "exercise",
      start_time: "18:30",
      end_time: "19:10",
      duration_minutes: 40,
      priority: 3,
      is_fixed: false,
      source: "seed",
      goal_link: "",
      fallback_version: "",
      status: "upcoming",
    },
  ];

  const demo: MomentState = {
    ...base,
    profile: {
      ...base.profile,
      age: 17,
      age_bracket: "teen_16_18",
      school_year: "Year 12",
      academic_context: "High school junior in the US",
    },
    active_goal,
    constraints: {
      school_end_time: "15:30",
      commute_minutes: 30,
      sleep_floor_time: "23:30",
      sleep_target_time: "23:00",
      exercise_minutes_daily: 40,
      study_minutes_daily: 90,
      fixed_commitments: [],
      preferred_work_window: "afternoon",
      energy_pattern: "afternoon",
      fixed_commitments_checked: true,
      missing_fields: [],
    },
    today_state: {
      date: ts.slice(0, 10),
      energy: "medium",
      stress: "medium",
      alignment_signal: "aligned",
      current_bottleneck: "Essay opener still unclear",
      decisive_move: "Draft three opening lines for the Stanford 'why us' essay",
      decisive_move_reason: "Unblocks the essay workstream.",
      available_time_blocks: [],
      day_context_notes: "",
    },
    schedule_state: {
      day_plan,
      day_plan_a_snapshot: [],
      week_plan: [],
      week_plan_generated_at: "",
      assumptions: ["You have ~2 focused hours after school today."],
      confidence: 70,
      last_plan_generated_at: ts,
      reform_note: "",
      relationships: [],
    },
    tasks,
    chat_state: {
      post_onboarding_specialisation_required: false,
      specialisation_phase: "complete" as const,
    },
    onboarding: {
      completed: true,
      current_stage: "high school junior with strong math",
      answers: { stage_of_life: "school", horizon: "years" },
      last_updated: ts,
      understanding: {
        knowns: ["goal", "why", "school year", "age"],
        unknowns: [],
        assumptions: ["User is in the US education system"],
        confidence: "high",
      },
    },
  };

  demo.pursuit_model = compilePursuitModel(demo.active_goal, null);
  demo.schedule_state.week_plan = seedWeekPlan(demo);
  demo.schedule_state.week_plan_generated_at = ts;
  return demo;
}

/**
 * Legacy export — points to demo state for existing callers.
 * New code should call createEmptyUserState or createDemoState directly.
 */
export function createDefaultState(userId: string, displayName: string, timezone: string): MomentState {
  return createDemoState(userId, displayName, timezone);
}
