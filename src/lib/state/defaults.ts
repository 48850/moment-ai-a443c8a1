import type { MomentState } from "@/lib/types";

/**
 * Build a fresh, empty MomentState for a new (or reset) user.
 * AUDIT FIXES vs. archive:
 *   - Adds `execution_feedback: []`
 *   - Adds `schedule_state.day_plan_a_snapshot: []`
 *   - Adds `schedule_state.reform_note: ""`
 */
export function createDefaultState(userId: string, displayName: string, timezone: string): MomentState {
  const now = new Date().toISOString();
  return {
    user_id: userId,
    profile: {
      display_name: displayName,
      timezone,
      created_at: now,
      last_active_at: now,
    },
    active_goal: {
      statement: "",
      why_it_matters: "",
      status: "forming",
      phase: "clarifying",
      seriousness_score: 0,
      stability_score: 0,
      reality_gap: "",
      last_updated_at: now,
    },
    constraints: {
      school_end_time: "",
      commute_minutes: -1,
      sleep_floor_time: "",
      sleep_target_time: "",
      exercise_minutes_daily: -1,
      study_minutes_daily: -1,
      fixed_commitments: [],
      preferred_work_window: "",
      energy_pattern: "unknown",
      fixed_commitments_checked: false,
      missing_fields: [
        "school_end_time",
        "commute_minutes",
        "sleep_floor_time",
        "sleep_target_time",
        "exercise_minutes_daily",
        "study_minutes_daily",
        "preferred_work_window",
        "energy_pattern",
      ],
    },
    pathway: { domains: [] },
    today_state: {
      date: "",
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
      assumptions: [],
      confidence: 0,
      last_plan_generated_at: "",
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
      last_updated: now,
      reasons: [],
    },
    home: { active_plan: "plan_a" },
    pursuit_model: null,
  };
}
