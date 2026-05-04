import type { MomentState } from "@/lib/types";
import { compilePursuitModel } from "@/lib/pursuit/compiler";
import { seedWeekPlan } from "@/lib/engine/week-plan";

/**
 * Build a fresh MomentState seeded with demo content so the redesigned
 * UI has something to render before any AI orchestration runs.
 */
export function createDefaultState(userId: string, displayName: string, timezone: string): MomentState {
  const now = new Date().toISOString();

  const active_goal: MomentState["active_goal"] = {
    statement: "Stanford CS, class of 2027",
    why_it_matters:
      "I want to build things that matter at the level Stanford CS opens up.",
    status: "active",
    phase: "building",
    seriousness_score: 78,
    stability_score: 65,
    reality_gap: "Essay opener still unclear; SAT below target.",
    last_updated_at: now,
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
      created_at: now,
      completed_at: "",
      due_date: "",
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
      created_at: now,
      completed_at: "",
      due_date: "",
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
      created_at: now,
      completed_at: "",
      due_date: "",
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
      created_at: now,
      completed_at: now,
      due_date: "",
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
      created_at: now,
      completed_at: "",
      due_date: "",
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

  const base: MomentState = {
    user_id: userId,
    profile: {
      display_name: displayName,
      timezone,
      created_at: now,
      last_active_at: now,
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
    pathway: { domains: [] },
    today_state: {
      date: now.slice(0, 10),
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
      assumptions: ["You have ~2 focused hours after school today."],
      confidence: 70,
      last_plan_generated_at: now,
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
      current_mode: "build_day_plan",
      last_response_type: "",
      state_version: 1,
    },
    tasks,
    reflections: [],
    execution_feedback: [],
    alignment: {
      status: "aligned",
      drift_score: 15,
      last_updated: now,
      reasons: [],
    },
    home: { active_plan: "plan_a" },
    forge_state: {
      interview_answers: [], candidate_features: [], selected_feature_ids: [],
      generated_modules: [], compiler_status: "idle",
    },
    pursuit_model: null,
    rescue_signals: [],
    chat_preferences: { tone: "default" },
  };

  base.pursuit_model = compilePursuitModel(base.active_goal, null);
  // Seed a 7-day liquid week plan so Plan/Weeks renders immediately.
  // Imported lazily to avoid a circular import via types.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { seedWeekPlan } = require("@/lib/engine/week-plan") as typeof import("@/lib/engine/week-plan");
  base.schedule_state.week_plan = seedWeekPlan(base);
  base.schedule_state.week_plan_generated_at = now;
  return base;
}
