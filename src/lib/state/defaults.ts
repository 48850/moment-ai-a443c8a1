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
    statement: "",
    why_it_matters: "",
    status: "forming",
    phase: "clarifying",
    seriousness_score: 0,
    stability_score: 0,
    reality_gap: "",
    last_updated_at: now,
  };

  const tasks: MomentState["tasks"] = [];

  const day_plan: MomentState["schedule_state"]["day_plan"] = [];

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
    mission_history: [],
  };

  base.pursuit_model = compilePursuitModel(base.active_goal, null);
  base.schedule_state.week_plan = seedWeekPlan(base);
  base.schedule_state.week_plan_generated_at = now;
  return base;
}
