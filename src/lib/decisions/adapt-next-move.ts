/**
 * adaptNextMove — re-derives a next-move recommendation after fresh feedback.
 * Returns the same shape as selectNextMove with an adaptation_note that
 * references the just-given feedback. Deterministic, no AI.
 */
import type { MomentState } from "@/lib/types";
import type { FeedbackKey } from "@/lib/feedback/labels";
import { tuneTaskFromFeedback } from "@/lib/feedback/tune-engine";
import { selectNextMove, type NextMoveResult } from "./select-next-move";

export function adaptNextMove(
  state: MomentState | null,
  lastFeedback: FeedbackKey | null,
): NextMoveResult {
  const base = selectNextMove(state);
  if (!base.task || !lastFeedback) return base;

  const tune = tuneTaskFromFeedback(base.task, lastFeedback);
  if (!tune) return base;

  const adapted = { ...base.task, ...tune.changes };
  return {
    ...base,
    task: adapted,
    estimated_minutes: adapted.estimated_minutes ?? base.estimated_minutes,
    adaptation_applied: true,
    adaptation_note: `Adjusted after "${lastFeedback.split("_").join(" ")}". ${tune.change_summary}`,
  };
}
