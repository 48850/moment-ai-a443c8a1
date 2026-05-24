/**
 * Moment Core v1 — Visible Adaptation Loop.
 *
 * Pure deterministic rules. NO LLM. NO async. NO Supabase. NO random.
 * Given (completed task, feedback signal, next candidate, recent history),
 * return a tiny mutation for the next candidate plus a one-line human
 * summary the Today card renders as "Why this changed →".
 *
 * Locked v1 scope: ONE rule.
 *   hard_to_start → next move gets a 3-minute starter / smaller launch step.
 *
 * Edge cases handled:
 *   - next candidate already ≤ 3 min → no-op mutation, signal still saved
 *   - already prefixed with "First 3 min:" → no double prefix
 *   - 3rd hard_to_start in a row → STOP shrinking, raise coach_support flag
 *   - no next candidate at all → return pending, never invent a fake task
 *
 * Other frozen labels are accepted (signal preserved) but currently no-op.
 * Promote new rules into this file only — there is no second engine.
 */
import type { Task } from "@/lib/types";
import {
  CORE_FEEDBACK_KEYS,
  type CoreFeedback,
} from "@/lib/feedback/core-labels";

export { CORE_FEEDBACK_KEYS };
export type { CoreFeedback };

const STARTER_PREFIX = "First 3 min: ";
const STARTER_MINUTES = 3;
const HARD_TO_START_STREAK_LIMIT = 3;

export interface AdaptationResult {
  rule_id: string;
  /** One short, plain-English line. Rendered verbatim under the next move. */
  summary: string;
  /** Partial Task fields to apply to the next candidate. Null when no change. */
  next_task_changes: Partial<Task> | null;
  /** True when the rule could not visibly apply (no next task). */
  pending: boolean;
  /** Pending reason; only set when pending=true. */
  pending_reason: string;
  /** True when adaptation logic decided to stop shrinking and hand to Coach. */
  coach_support: boolean;
  from_task_id: string;
  from_task_title: string;
  from_feedback: CoreFeedback;
  created_at: string;
}

export interface ApplyRuleInput {
  completedTask: { id: string; title: string };
  feedback: CoreFeedback;
  nextCandidate: Task | null;
  /** Most-recent-first list of recent feedback signals (excluding the one being applied). */
  recentFeedback?: CoreFeedback[];
}

export function applyRule(input: ApplyRuleInput): AdaptationResult {
  const { completedTask, feedback, nextCandidate, recentFeedback = [] } = input;
  const base = {
    from_task_id: completedTask.id,
    from_task_title: completedTask.title,
    from_feedback: feedback,
    created_at: new Date().toISOString(),
  };

  if (feedback === "hard_to_start") {
    // Streak check: this completion + previous N hard_to_start ⇒ ≥ LIMIT.
    const priorStreak = countLeading(recentFeedback, "hard_to_start");
    if (priorStreak + 1 >= HARD_TO_START_STREAK_LIMIT) {
      return {
        ...base,
        rule_id: "hard_to_start__coach_support",
        summary:
          "Starting has been hard a few times in a row. I'm going to stop shrinking and bring Coach in.",
        next_task_changes: null,
        pending: false,
        pending_reason: "",
        coach_support: true,
      };
    }

    if (!nextCandidate) {
      return {
        ...base,
        rule_id: "hard_to_start__pending",
        summary: "",
        next_task_changes: null,
        pending: true,
        pending_reason: "no_next_task",
        coach_support: false,
      };
    }

    const minutes = nextCandidate.estimated_minutes ?? 0;
    const alreadyStartered = nextCandidate.title.startsWith(STARTER_PREFIX);

    // Already ≤ 3 min and already startered/short → no-op, still save signal.
    if (minutes > 0 && minutes <= STARTER_MINUTES && alreadyStartered) {
      return {
        ...base,
        rule_id: "hard_to_start__noop_already_minimal",
        summary: "",
        next_task_changes: null,
        pending: false,
        pending_reason: "",
        coach_support: false,
      };
    }

    const newTitle = alreadyStartered
      ? nextCandidate.title
      : `${STARTER_PREFIX}${shorten(nextCandidate.title)}`;
    const newMinutes = STARTER_MINUTES;

    return {
      ...base,
      rule_id: "hard_to_start__three_min_starter",
      summary:
        "I made this smaller because the last one was hard to start — this one opens with 3 minutes.",
      next_task_changes: {
        title: newTitle,
        estimated_minutes: newMinutes,
      },
      pending: false,
      pending_reason: "",
      coach_support: false,
    };
  }

  // All other frozen labels accepted, signal preserved, no mutation in v1.
  return {
    ...base,
    rule_id: "noop_v1",
    summary: "",
    next_task_changes: null,
    pending: false,
    pending_reason: "",
    coach_support: false,
  };
}

function shorten(title: string) {
  if (title.length <= 60) return title;
  return title.slice(0, 57).trimEnd() + "…";
}

function countLeading<T>(arr: T[], value: T): number {
  let n = 0;
  for (const v of arr) {
    if (v === value) n++;
    else break;
  }
  return n;
}
