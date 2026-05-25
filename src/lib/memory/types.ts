/**
 * Moment Memory — the user model.
 * Pure derivation from MomentState. No AI. No storage. No mutations.
 *
 * This is the single source of truth for every decision engine and every AI
 * prompt. If a surface needs to know "what the user is like", it reads this.
 */

export interface MomentMemory {
  task_profile: {
    /** Median of recently-completed task durations. Falls back to 30. */
    preferred_minutes: number;
    /** Subjects/categories where rejection is more common than completion. */
    hard_start_subjects: string[];
    /** Categories the user completes most often. */
    reliable_task_types: string[];
    /** Top reasons tasks have been pushed back. */
    common_rejection_reasons: string[];
  };
  time_profile: {
    /** Windows (HH:MM ranges or labels) where blocks complete. */
    best_work_windows: string[];
    /** Windows where blocks tend to miss. */
    weak_work_windows: string[];
    /** 0–100. Completed-vs-missed blocks across the last 14 days. */
    plan_reliability_score: number;
    /** Days of week with the most missed blocks. */
    common_overload_days: string[];
  };
  learning_profile: {
    strongest_subjects: string[];
    fragile_topics: string[];
    /** Count of mini-lessons saved across all tasks. */
    saved_lessons: number;
    /** Notes recurring across reflections — what keeps coming back. */
    recurring_gaps: string[];
    preferred_review_formats: string[];
  };
  goal_profile: {
    active_goal: string;
    current_stage: string;
    next_proof: string;
    bottleneck: string;
    identity_path: string;
  };
  emotional_execution_profile: {
    common_friction: string[];
    rescue_triggers: string[];
    recovery_patterns: string[];
  };

  /** Last 5 wins, freshest first. */
  recent_wins: string[];
  /** Last 5 struggles, freshest first. */
  recent_struggles: string[];
  /** High-priority pending tasks not touched in 3+ days. */
  open_loops: Array<{ task_id: string; title: string; days_open: number }>;
  /** Tasks where a lesson is saved but no review was scheduled. */
  review_gaps: Array<{ task_id: string; title: string }>;
  /** Patterns the user can see. Each maps to a UI surface. */
  current_patterns: Array<{
    id: string;
    message: string;
    confidence: number;
    suggested_adjustment: string;
    surface: "today" | "plan" | "coach" | "portfolio" | "path" | "forge";
  }>;
}
