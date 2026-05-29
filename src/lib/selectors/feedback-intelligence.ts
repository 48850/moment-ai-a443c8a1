/**
 * Feedback Intelligence — pure selectors over execution_feedback.
 *
 * These functions are the emotional intelligence layer of Moment.
 * They read user-facing feedback signals to derive vibe, friction patterns,
 * and adaptation hints — without diagnosing or guessing.
 *
 * Rule: never infer a state without ≥2 matching signals.
 * Rule: evidence strings use plain human language, not system jargon.
 */
import type { MomentState, ExecutionFeedbackItem } from "@/lib/types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export interface FrictionPattern {
  avoidant: boolean;
  confused: boolean;
  overwhelmed: boolean;
  friction_count: number;
}

export interface TaskAdaptation {
  shrink: boolean;
  add_example: boolean;
  celebrate: boolean;
}

export function selectRecentFeedback(
  state: MomentState,
  sources?: string[],
  hours = 48,
): ExecutionFeedbackItem[] {
  const cutoff = Date.now() - hours * HOUR;
  const feedback = state.execution_feedback ?? [];
  return feedback.filter((f) => {
    const ts = f.created_at ? new Date(f.created_at).getTime() : 0;
    if (ts < cutoff) return false;
    if (sources && sources.length > 0 && !sources.includes(f.source)) return false;
    return true;
  });
}

export function selectFrictionPattern(state: MomentState): FrictionPattern {
  const recent = selectRecentFeedback(state, undefined, 48);

  const avoidCount = recent.filter((f) => f.feedback === "do_differently").length;
  const confusedCount = recent.filter((f) =>
    f.feedback === "confusing" || f.feedback === "dont_understand",
  ).length;
  const overwhelmedCount = recent.filter((f) =>
    f.feedback === "too_much" ||
    f.feedback === "too_much_today" ||
    f.feedback === "overwhelmed",
  ).length;
  const tiredCount = recent.filter((f) => f.feedback === "tired").length;

  return {
    avoidant: avoidCount >= 2,
    confused: confusedCount >= 2,
    overwhelmed: overwhelmedCount >= 1 && tiredCount >= 1,
    friction_count: avoidCount + confusedCount + overwhelmedCount,
  };
}

export function selectPreferredSupportStyle(
  state: MomentState,
): "direct" | "gentle" | "tiny_step" | "celebrate_then_next" {
  const recent = selectRecentFeedback(state, undefined, 48);
  if (recent.length === 0) return "gentle";

  const directCount = recent.filter((f) => f.feedback === "be_more_direct").length;
  const gentleCount = recent.filter((f) => f.feedback === "be_gentler").length;
  const smallerCount = recent.filter((f) =>
    f.feedback === "make_simpler" || f.feedback === "too_much" || f.feedback === "too_much_today",
  ).length;
  const celebrateCount = recent.filter((f) =>
    f.feedback === "felt_good" || f.feedback === "proud",
  ).length;

  if (directCount >= 2 && directCount > gentleCount) return "direct";
  if (celebrateCount >= 1 && selectFrictionPattern(state).friction_count === 0) return "celebrate_then_next";
  if (smallerCount >= 2) return "tiny_step";
  if (gentleCount >= 1) return "gentle";
  return "gentle";
}

export function selectLatestVibe(
  state: MomentState,
): "positive" | "friction" | "neutral" {
  const recent = selectRecentFeedback(state, undefined, 24);
  if (recent.length === 0) return "neutral";

  const POSITIVE = new Set(["easy", "valuable", "felt_good", "proud"]);
  const FRICTION = new Set([
    "hard", "too_big", "too_vague", "avoided", "do_differently",
    "tired", "overwhelmed", "dont_understand", "too_much_today",
    "too_much", "confusing", "too_generic", "too_slow",
  ]);

  // Look at the last 3 feedback items for recency
  const last3 = recent.slice(-3);
  let positiveScore = 0;
  let frictionScore = 0;
  for (const f of last3) {
    if (POSITIVE.has(f.feedback)) positiveScore++;
    if (FRICTION.has(f.feedback)) frictionScore++;
  }

  if (positiveScore > frictionScore) return "positive";
  if (frictionScore > positiveScore) return "friction";
  return "neutral";
}

export function selectTaskAdaptationFromFeedback(state: MomentState): TaskAdaptation {
  const pattern = selectFrictionPattern(state);
  const vibe = selectLatestVibe(state);
  const recent = selectRecentFeedback(state, undefined, 48);

  const confusedCount = recent.filter((f) =>
    f.feedback === "confusing" || f.feedback === "dont_understand",
  ).length;

  return {
    shrink: pattern.avoidant || pattern.overwhelmed || recent.filter((f) => f.feedback === "too_big").length >= 2,
    add_example: confusedCount >= 1,
    celebrate: vibe === "positive",
  };
}

/**
 * Builds a human-readable EmotionalSnapshot from recent feedback.
 * Called by buildContextSnapshot() — do not call in UI directly.
 */
export interface EmotionalSnapshot {
  inferred_state:
    | "steady"
    | "overwhelmed"
    | "tired"
    | "avoidant"
    | "confused"
    | "proud"
    | "under_pressure";
  confidence: number;
  evidence: string[];
  support_style: "direct" | "gentle" | "tiny_step" | "celebrate_then_next";
  avoid: (
    | "long_explanation"
    | "fake_hype"
    | "too_many_options"
    | "shame_language"
    | "generic_motivation"
  )[];
}

export function buildEmotionalSnapshot(feedback: ExecutionFeedbackItem[]): EmotionalSnapshot {
  const cutoff = Date.now() - 48 * HOUR;
  const recent = feedback.filter((f) => {
    const ts = f.created_at ? new Date(f.created_at).getTime() : 0;
    return ts >= cutoff;
  });

  if (recent.length === 0) {
    return {
      inferred_state: "steady",
      confidence: 0.3,
      evidence: [],
      support_style: "gentle",
      avoid: [],
    };
  }

  const count = (keys: string[]) =>
    recent.filter((f) => keys.includes(f.feedback)).length;

  const avoidCount = count(["do_differently"]);
  const tiredCount = count(["tired"]);
  const overloadCount = count(["too_much", "too_much_today", "overwhelmed"]);
  const confusedCount = count(["confusing", "dont_understand"]);
  const proudCount = count(["felt_good", "proud", "easy", "valuable"]);
  const directCount = count(["be_more_direct"]);

  // Require ≥2 matching signals for non-steady inference
  let inferred: EmotionalSnapshot["inferred_state"] = "steady";
  let confidence = 0.4;
  const evidence: string[] = [];

  if (overloadCount >= 1 && tiredCount >= 1) {
    inferred = "overwhelmed";
    confidence = 0.75;
    evidence.push(`Marked ${overloadCount + tiredCount} tasks as too much or tiring recently`);
  } else if (tiredCount >= 2) {
    inferred = "tired";
    confidence = 0.7;
    evidence.push(`Marked ${tiredCount} moves as tiring in the last 48 hours`);
  } else if (avoidCount >= 2) {
    inferred = "avoidant";
    confidence = 0.7;
    evidence.push(`Skipped or marked ${avoidCount} tasks differently recently`);
  } else if (confusedCount >= 2) {
    inferred = "confused";
    confidence = 0.7;
    evidence.push(`Marked ${confusedCount} moves as confusing in the last 48 hours`);
  } else if (proudCount >= 2 && (avoidCount + tiredCount + overloadCount) === 0) {
    inferred = "proud";
    confidence = 0.8;
    evidence.push(`Marked ${proudCount} moves as easy or good recently`);
  }

  const style = ((): EmotionalSnapshot["support_style"] => {
    if (directCount >= 2) return "direct";
    if (inferred === "proud") return "celebrate_then_next";
    if (inferred === "overwhelmed" || inferred === "avoidant") return "tiny_step";
    if (inferred === "tired") return "gentle";
    return "gentle";
  })();

  const avoid: EmotionalSnapshot["avoid"] = [];
  if (inferred === "overwhelmed" || inferred === "tired") avoid.push("long_explanation", "too_many_options");
  if (inferred === "proud") avoid.push("generic_motivation");
  if (inferred === "avoidant") avoid.push("shame_language", "fake_hype");

  return { inferred_state: inferred, confidence, evidence, support_style: style, avoid };
}
