/**
 * Moment Core v1 — Visible Adaptation Loop.
 *
 * Deterministic rules: given the signal from the last completed task,
 * decide (a) how the NEXT decisive move should be shaped, and
 * (b) one short sentence explaining why it changed.
 *
 * No AI. No vibes. Pure code. This is the heartbeat the doctrine demands:
 *   task completed → feedback saved → next move visibly adapts.
 */
import type { Task } from "@/lib/types";
import type { FeedbackKey } from "@/lib/feedback/labels";

export interface NextMoveAdaptation {
  from_task_id: string;
  from_task_title: string;
  from_feedback: FeedbackKey;
  rule_id: string;
  /** Short, plan-blaming sentence shown on the next decisive move card. */
  summary: string;
  /** Optional mutation applied to the *next* candidate task. */
  next_task_changes: Partial<Task> | null;
  created_at: string;
}

const FIRST_STEP_PREFIX = "First 10 min: ";

function clampMin(n: number, lo = 5, hi = 180) {
  if (!Number.isFinite(n) || n <= 0) return 15;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

/** Pick the strongest signal from a set of feedback keys captured at once. */
export function pickStrongestSignal(keys: FeedbackKey[]): FeedbackKey | null {
  if (!keys.length) return null;
  // Priority: capacity signals first, then fit, then value, then tone.
  const order: FeedbackKey[] = [
    "overwhelmed", "tired", "too_much_today", "feels_unrealistic",
    "too_big", "too_vague", "dont_understand", "hard",
    "not_relevant", "do_differently", "wrong_time", "need_help",
    "too_small", "easy",
    "valuable",
    "make_simpler", "make_more_ambitious", "be_gentler", "be_more_direct",
  ];
  for (const k of order) if (keys.includes(k)) return k;
  return keys[0];
}

/**
 * Apply the deterministic rule. `nextCandidate` is the task currently
 * sitting at the top of the next-move queue (may be null if nothing else is up).
 */
export function computeNextMoveAdaptation(args: {
  completedTask: Pick<Task, "id" | "title">;
  feedback: FeedbackKey;
  nextCandidate: Task | null;
}): NextMoveAdaptation {
  const { completedTask, feedback, nextCandidate } = args;
  const baseMin = nextCandidate?.estimated_minutes ?? 30;
  const nextTitle = nextCandidate?.title ?? "";
  const hasPrefix = nextTitle.startsWith(FIRST_STEP_PREFIX);

  let rule_id = "noop";
  let summary = "Your next move is set — same direction, same pace.";
  let next_task_changes: Partial<Task> | null = null;

  switch (feedback) {
    case "too_big":
    case "overwhelmed":
    case "too_much_today":
    case "feels_unrealistic":
    case "tired": {
      rule_id = "shrink_next";
      if (nextCandidate) {
        const next = clampMin(Math.max(10, Math.round(baseMin / 2)));
        next_task_changes = {
          estimated_minutes: next,
          energy_demand: "low",
          start_friction: "low",
          title: hasPrefix ? nextTitle : `${FIRST_STEP_PREFIX}${nextTitle}`,
          original_title: nextCandidate.original_title || nextCandidate.title,
        };
        summary = `Last one landed heavy — I shrunk the next move to ~${next} min and made it a clean first step.`;
      } else {
        summary = "Last one landed heavy — I'm holding back from stacking more on you tonight.";
      }
      break;
    }
    case "too_vague":
    case "dont_understand":
    case "need_help": {
      rule_id = "sharpen_next";
      if (nextCandidate) {
        next_task_changes = {
          title: hasPrefix ? nextTitle : `${FIRST_STEP_PREFIX}${nextTitle}`,
          original_title: nextCandidate.original_title || nextCandidate.title,
          description:
            nextCandidate.description ||
            "Open the file/page and write one rough sentence. Don't aim for good — aim for visible.",
        };
        summary = "Last one was fuzzy — your next move starts with one concrete first step.";
      } else {
        summary = "Last one was fuzzy — next time I'll lead with the first concrete step.";
      }
      break;
    }
    case "hard": {
      rule_id = "ease_next";
      if (nextCandidate) {
        const next = clampMin(Math.max(10, Math.round(baseMin * 0.7)));
        next_task_changes = { estimated_minutes: next, energy_demand: "low" };
        summary = `Heavier than expected — easing in with a ~${next} min lower-friction move.`;
      } else {
        summary = "Heavier than expected — I'll bring the next one in lower-friction.";
      }
      break;
    }
    case "easy":
    case "too_small":
    case "make_more_ambitious": {
      rule_id = "raise_bar";
      if (nextCandidate) {
        const next = clampMin(Math.round(baseMin * 1.4));
        next_task_changes = { estimated_minutes: next, priority: "high" };
        summary = `You had more in you — raising the bar to ~${next} min on the next move.`;
      } else {
        summary = "You had more in you — I'll bring something with more bite next.";
      }
      break;
    }
    case "valuable": {
      rule_id = "double_down";
      summary = "That one landed — your next move is the same kind of work.";
      break;
    }
    case "not_relevant":
    case "do_differently": {
      rule_id = "pivot_angle";
      if (nextCandidate) {
        next_task_changes = {
          description:
            (nextCandidate.description ? nextCandidate.description + "\n\n" : "") +
            "Different angle this time — try writing it out / pairing / breaking the surface first.",
        };
        summary = "That didn't fit — pivoting the next move to a different angle on the same goal.";
      } else {
        summary = "That didn't fit — I'll pivot the angle on the next one.";
      }
      break;
    }
    case "wrong_time": {
      rule_id = "respect_window";
      summary = "Wrong window for that — I'll stop placing heavy work here.";
      break;
    }
    case "make_simpler": {
      rule_id = "simpler";
      if (nextCandidate) {
        const next = clampMin(Math.max(10, Math.round(baseMin * 0.7)));
        next_task_changes = { estimated_minutes: next, energy_demand: "low" };
        summary = `Going simpler — next move is ~${next} min, low load.`;
      } else {
        summary = "Going simpler from here.";
      }
      break;
    }
    case "be_gentler":
    case "be_more_direct": {
      rule_id = "tone_shift";
      summary =
        feedback === "be_gentler"
          ? "Softer pace from here — same direction."
          : "Less cushion from here — clearer next step.";
      break;
    }
    default:
      break;
  }

  return {
    from_task_id: completedTask.id,
    from_task_title: completedTask.title,
    from_feedback: feedback,
    rule_id,
    summary,
    next_task_changes,
    created_at: new Date().toISOString(),
  };
}
