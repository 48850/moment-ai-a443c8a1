/**
 * Moment Core v1 — frozen feedback taxonomy for the Done flow.
 *
 * SINGLE SOURCE OF TRUTH. The Today/Done surface MUST only ever surface
 * these six labels. Legacy labels remain in `FEEDBACK_OPTIONS` (schema)
 * only for backwards compatibility with stored history and hidden routes.
 *
 * Do not extend this list without an explicit doctrine update.
 */
export const CORE_FEEDBACK_KEYS = [
  "hard_to_start",
  "too_long",
  "distracted",
  "felt_pointless",
  "useful",
  "easy",
] as const;

export type CoreFeedback = (typeof CORE_FEEDBACK_KEYS)[number];

export const CORE_FEEDBACK_LABELS: Record<CoreFeedback, string> = {
  hard_to_start: "Hard to start",
  too_long: "Took too long",
  distracted: "Got distracted",
  felt_pointless: "Felt pointless",
  useful: "Useful",
  easy: "Easy",
};

export function isCoreFeedback(value: unknown): value is CoreFeedback {
  return typeof value === "string" && (CORE_FEEDBACK_KEYS as readonly string[]).includes(value);
}
