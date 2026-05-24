/**
 * Moment Core v1 — Visible Adaptation Loop.
 *
 * Pure deterministic rules. NO LLM. NO async. Given (completed task,
 * feedback signal, next candidate), return a tiny mutation for the next
 * candidate plus a one-line human summary the Today page renders as
 * "Why this changed →".
 *
 * Locked v1 scope: ONE rule.
 *   hard_to_start → next move gets a 3-minute starter / smaller launch step.
 *
 * Other frozen labels are accepted but currently no-op. Add new rules here
 * (and only here) when promoted into the locked scope.
 */
import type { Task } from "@/lib/types";

export type CoreFeedback =
  | "hard_to_start"
  | "too_long"
  | "distracted"
  | "felt_pointless"
  | "useful"
  | "easy";

export const CORE_FEEDBACK_KEYS: CoreFeedback[] = [
  "hard_to_start",
  "too_long",
  "distracted",
  "felt_pointless",
  "useful",
  "easy",
];

export interface AdaptationResult {
  rule_id: string;
  /** One short, plain-English line. Rendered verbatim under the next move. */
  summary: string;
  /** Partial Task fields to apply to the next candidate. Empty when no change. */
  next_task_changes: Partial<Task> | null;
  from_task_id: string;
  from_task_title: string;
  from_feedback: CoreFeedback;
  created_at: string;
}

const STARTER_PREFIX = "First 3 min: ";

export function applyRule(input: {
  completedTask: { id: string; title: string };
  feedback: CoreFeedback;
  nextCandidate: Task | null;
}): AdaptationResult {
  const { completedTask, feedback, nextCandidate } = input;
  const base = {
    from_task_id: completedTask.id,
    from_task_title: completedTask.title,
    from_feedback: feedback,
    created_at: new Date().toISOString(),
  };

  if (feedback === "hard_to_start" && nextCandidate) {
    const alreadyStartered = nextCandidate.title.startsWith(STARTER_PREFIX);
    const newTitle = alreadyStartered
      ? nextCandidate.title
      : `${STARTER_PREFIX}${shorten(nextCandidate.title)}`;
    const newMinutes = Math.min(nextCandidate.estimated_minutes || 10, 3);
    return {
      ...base,
      rule_id: "hard_to_start__three_min_starter",
      summary: `You said the last one was hard to start, so I shrank the next move to a 3-minute opener.`,
      next_task_changes: {
        title: newTitle,
        estimated_minutes: newMinutes,
      },
    };
  }

  // All other frozen labels accepted but no deterministic mutation in v1.
  return {
    ...base,
    rule_id: "noop_v1",
    summary: "",
    next_task_changes: null,
  };
}

function shorten(title: string) {
  if (title.length <= 60) return title;
  return title.slice(0, 57).trimEnd() + "…";
}
