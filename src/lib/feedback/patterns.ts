import type { MomentState, ExecutionFeedbackItem } from "@/lib/types";
import type { FeedbackKey } from "@/lib/feedback/labels";

export interface FeedbackPattern {
  id: string;
  /** Calm, plan-blaming, non-diagnostic insight. */
  message: string;
  triggerKey: FeedbackKey;
  count: number;
}

/**
 * Detect repeated signals over the last N feedback events and return
 * a small set of calm, non-shaming insights. The app speaks about the
 * plan, never about the user.
 */
export function detectFeedbackPatterns(
  state: MomentState | null,
  window = 12,
): FeedbackPattern[] {
  if (!state) return [];
  const recent = (state.execution_feedback ?? []).slice(-window);
  const counts = new Map<FeedbackKey, number>();
  recent.forEach((f: ExecutionFeedbackItem) => {
    counts.set(f.feedback as FeedbackKey, (counts.get(f.feedback as FeedbackKey) ?? 0) + 1);
  });

  const out: FeedbackPattern[] = [];
  const push = (key: FeedbackKey, message: string, threshold = 2) => {
    const c = counts.get(key) ?? 0;
    if (c >= threshold) out.push({ id: key, message, triggerKey: key, count: c });
  };

  push("too_big", "I'm seeing a pattern: the goal is still right, but the task size is too large. I'll keep the direction and make the next actions smaller.");
  push("too_vague", "Tasks have felt unclear lately. I'll define the first physical step on each one.");
  push("not_relevant", "These recommendations may be off the pathway. Worth re-checking what part of the goal actually matters to you.");
  push("wrong_time", "This time window doesn't seem reliable for heavy work. I'll stop placing important tasks here unless you ask me to.");
  push("valuable", "This kind of task seems to connect strongly with your goal. I'll treat it as a high-value workstream.", 2);
  push("tired", "Energy has been low. We'll keep one meaningful action and move the rest.", 2);
  push("overwhelmed", "The plan is asking for too much. I'll shrink it to what protects the goal today.", 2);
  push("feels_unrealistic", "The plan feels heavier than the day. We're not cancelling the goal — we're adjusting the plan so it can survive today.", 2);
  push("be_gentler", "I'll soften the tone and emphasise reset and recovery.", 2);
  push("be_more_direct", "I'll be clearer and firmer about the next move.", 2);

  return out.slice(0, 2);
}
