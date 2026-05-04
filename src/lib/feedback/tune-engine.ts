/**
 * Tune engine — turns a Tune feedback tap into a deterministic, instant
 * mutation of the targeted task. Heuristics only; never calls AI.
 *
 * Returns null when no mutation applies (e.g. tone-only feedback with no task).
 */
import type { Task } from "@/lib/types";
import type { FeedbackKey } from "@/lib/feedback/labels";

export interface TuneOutcome {
  changes: Partial<Task>;
  /** Short human-readable summary like "Halved estimated time and shrunk first step." */
  change_summary: string;
}

const FIRST_STEP_PREFIX = "First 10 min: ";

function clampMinutes(n: number, lo = 5, hi = 180): number {
  if (!Number.isFinite(n) || n <= 0) return 15;
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function tuneTaskFromFeedback(task: Task, feedback: FeedbackKey): TuneOutcome | null {
  switch (feedback) {
    case "too_big": {
      const next = clampMinutes(Math.max(10, Math.round(task.estimated_minutes / 2)));
      const newTitle = task.title.startsWith(FIRST_STEP_PREFIX)
        ? task.title
        : `${FIRST_STEP_PREFIX}${task.title}`;
      return {
        changes: {
          estimated_minutes: next,
          title: newTitle,
          original_title: task.original_title || task.title,
          was_tuned: true,
          energy_demand: "low",
          start_friction: "low",
        },
        change_summary: `Shrunk to ~${next} min and reframed as a first step.`,
      };
    }
    case "too_small": {
      const next = clampMinutes(Math.round(task.estimated_minutes * 1.5));
      return {
        changes: { estimated_minutes: next, was_tuned: true },
        change_summary: `Bumped up to ~${next} min for more bite.`,
      };
    }
    case "too_vague":
    case "dont_understand": {
      const newTitle = task.title.startsWith(FIRST_STEP_PREFIX)
        ? task.title
        : `${FIRST_STEP_PREFIX}${task.title}`;
      return {
        changes: {
          title: newTitle,
          original_title: task.original_title || task.title,
          description:
            task.description ||
            "Open the file and write one rough sentence. Don't aim for good — aim for visible.",
          was_tuned: true,
        },
        change_summary: "Reframed as a concrete first step.",
      };
    }
    case "make_simpler": {
      const next = clampMinutes(Math.max(10, Math.round(task.estimated_minutes * 0.7)));
      return {
        changes: { estimated_minutes: next, was_tuned: true, energy_demand: "low" },
        change_summary: `Simplified — ~${next} min, low cognitive load.`,
      };
    }
    case "make_more_ambitious": {
      const next = clampMinutes(Math.round(task.estimated_minutes * 1.4));
      return {
        changes: { estimated_minutes: next, was_tuned: true, priority: "high" },
        change_summary: `Raised the bar — ~${next} min, high priority.`,
      };
    }
    case "not_relevant": {
      return {
        changes: { priority: "low", was_tuned: true },
        change_summary: "Lowered priority — flagged for relevance review.",
      };
    }
    case "need_help": {
      return {
        changes: {
          description:
            (task.description ? task.description + "\n\n" : "") +
            "Helper: in chat, paste your goal + this task and ask Moment for one clarifying question.",
          was_tuned: true,
        },
        change_summary: "Added a helper hint pointing to chat.",
      };
    }
    case "do_differently": {
      return {
        changes: { was_tuned: true, description: (task.description ? task.description + "\n\n" : "") + "Approach mismatch — try a different angle (paired work / writing it out / breaking the surface)." },
        change_summary: "Marked approach as needing a different angle.",
      };
    }
    case "wrong_time": {
      return {
        changes: { was_tuned: true, scheduled_block_id: "" },
        change_summary: "Detached from current time slot — needs rescheduling.",
      };
    }
    case "feels_unrealistic":
    case "too_much_today":
    case "tired":
    case "overwhelmed": {
      // Day-level signals: shrink the task as a first courtesy, plus the
      // calling code can also patch the day plan via Rescue/Plan B.
      const next = clampMinutes(Math.max(10, Math.round(task.estimated_minutes / 2)));
      return {
        changes: {
          estimated_minutes: next,
          was_tuned: true,
          energy_demand: "low",
          title: task.title.startsWith(FIRST_STEP_PREFIX)
            ? task.title
            : `${FIRST_STEP_PREFIX}${task.title}`,
          original_title: task.original_title || task.title,
        },
        change_summary: `Lightened today — ~${next} min, low load.`,
      };
    }
    // Tone signals don't mutate tasks; preferences updated elsewhere.
    case "valuable":
    case "easy":
    case "hard":
    case "be_gentler":
    case "be_more_direct":
    default:
      return null;
  }
}

export function isToneFeedback(feedback: FeedbackKey): boolean {
  return feedback === "be_gentler" || feedback === "be_more_direct";
}
