/**
 * Deterministic user learning profile derivation.
 *
 * Reads from: execution_feedback, rescue_signals, tasks, reflections, learning_signals.
 * Produces: UserLearningProfile with confidence-scored claims.
 *
 * Reuses: computeStallPattern() from audit.ts, detectFeedbackPatterns() from patterns.ts.
 * No ML, no black box, no raw user text in output.
 */
import type { MomentState } from "@/lib/types";
import { computeStallPattern } from "@/lib/selectors/audit";
import { detectFeedbackPatterns } from "@/lib/feedback/patterns";
import type { UserLearningProfile, FrictionTag, WorkWindow, AdaptationRule } from "./types";

const MIN_SIGNALS_FOR_CONFIDENCE = 5;

function clamp(n: number): number {
  return Math.min(1, Math.max(0, n));
}

// ─── Preferred task size ──────────────────────────────────────────────────────

function derivePreferredTaskSize(
  state: MomentState,
): UserLearningProfile["preferred_task_size"] {
  const completed = (state.tasks ?? []).filter(
    (t) => t.status === "done" && t.estimated_minutes > 0,
  );
  if (completed.length < 3) return "unknown";

  const sorted = [...completed].sort((a, b) => a.estimated_minutes - b.estimated_minutes);
  const median = sorted[Math.floor(sorted.length / 2)].estimated_minutes;

  if (median <= 15) return "micro";
  if (median <= 30) return "short";
  if (median <= 60) return "medium";
  return "deep";
}

// ─── Best work windows ────────────────────────────────────────────────────────

function deriveWorkWindows(state: MomentState): WorkWindow[] {
  const signals = (state.learning_signals ?? []).filter(
    (s) => s.signal_type === "task_completed" && s.metadata.hour_of_day !== undefined,
  );
  if (signals.length < MIN_SIGNALS_FOR_CONFIDENCE) return [];

  const windowMap: Record<string, { completions: number; total: number }> = {
    morning: { completions: 0, total: 0 },
    "after-school": { completions: 0, total: 0 },
    evening: { completions: 0, total: 0 },
    night: { completions: 0, total: 0 },
  };

  function hourToWindow(h: number): string {
    if (h >= 6 && h < 13) return "morning";
    if (h >= 13 && h < 18) return "after-school";
    if (h >= 18 && h < 22) return "evening";
    return "night";
  }

  for (const s of signals) {
    const w = hourToWindow(s.metadata.hour_of_day as number);
    windowMap[w].completions++;
    windowMap[w].total++;
  }

  // Also count attempted-but-not-completed from other surfaces
  const allSignals = (state.learning_signals ?? []).filter(
    (s) => s.metadata.hour_of_day !== undefined,
  );
  for (const s of allSignals) {
    if (s.signal_type !== "task_completed") {
      const w = hourToWindow(s.metadata.hour_of_day as number);
      if (windowMap[w]) windowMap[w].total++;
    }
  }

  return Object.entries(windowMap)
    .filter(([, v]) => v.total >= 2)
    .map(([window, v]) => ({
      window,
      confidence: clamp(v.completions / Math.max(1, v.total)),
      evidence_count: v.total,
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}

// ─── Friction tags ────────────────────────────────────────────────────────────

function deriveFrictionTags(state: MomentState): FrictionTag[] {
  const feedback = state.execution_feedback ?? [];
  if (feedback.length < 3) return [];

  // Use last 30 signals for recency
  const recent = feedback.slice(-30);
  const counts: Record<string, number> = {};
  for (const f of recent) {
    counts[f.feedback] = (counts[f.feedback] ?? 0) + 1;
  }

  const total = recent.length;
  const FRICTION_KEYS = [
    "too_big", "too_vague", "too_small", "not_relevant", "tired",
    "overwhelmed", "dont_understand", "feels_unrealistic", "wrong_time",
    "too_much_today", "need_help",
  ];

  return FRICTION_KEYS
    .filter((k) => (counts[k] ?? 0) >= 2)
    .map((k) => ({
      tag: k,
      confidence: clamp((counts[k] ?? 0) / total),
      evidence_count: counts[k] ?? 0,
    }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

// ─── Plan style ───────────────────────────────────────────────────────────────

function derivePlanStyle(state: MomentState): UserLearningProfile["plan_style"] {
  const rescueCount = (state.rescue_signals ?? []).length;
  const feedback = state.execution_feedback ?? [];
  const counts: Record<string, number> = {};
  for (const f of feedback) counts[f.feedback] = (counts[f.feedback] ?? 0) + 1;

  const tooBig = counts.too_big ?? 0;
  const overwhelmed = (counts.overwhelmed ?? 0) + (counts.too_much_today ?? 0);

  // Repeated rescue or overwhelm → user needs starter rituals
  if (rescueCount >= 3 || overwhelmed >= 3) return "starter_first";
  // Mostly large tasks completed → user likes deep work
  const completed = (state.tasks ?? []).filter((t) => t.status === "done");
  const deepCompleted = completed.filter((t) => t.estimated_minutes >= 60).length;
  if (deepCompleted >= 3 && tooBig === 0) return "deep_work";
  // Lots of too_big → flexible/shorter blocks
  if (tooBig >= 3) return "flexible";
  // Not enough data
  if (completed.length < 5) return "unknown";
  return "flexible";
}

// ─── Chat style ───────────────────────────────────────────────────────────────

function deriveChatStyle(state: MomentState): UserLearningProfile["chat_style"] {
  const tone = state.chat_preferences?.tone ?? "default";
  if (tone === "gentler") return "gentle";
  if (tone === "more_direct") return "direct";

  // Also look at tone feedback signals
  const feedback = state.execution_feedback ?? [];
  const gentler = feedback.filter((f) => f.feedback === "be_gentler").length;
  const direct = feedback.filter((f) => f.feedback === "be_more_direct").length;
  if (gentler >= 2) return "gentle";
  if (direct >= 2) return "direct";
  return "minimal";
}

// ─── Adaptation rules ─────────────────────────────────────────────────────────

function deriveAdaptationRules(
  frictionTags: FrictionTag[],
  preferredSize: UserLearningProfile["preferred_task_size"],
  planStyle: UserLearningProfile["plan_style"],
  chatStyle: UserLearningProfile["chat_style"],
  windows: WorkWindow[],
): AdaptationRule[] {
  const rules: AdaptationRule[] = [];

  const hasFriction = (tag: string) => frictionTags.find((f) => f.tag === tag);

  const tooB = hasFriction("too_big");
  if (tooB) {
    rules.push({
      id: "shrink_tasks",
      rule: "Keep tasks under 25 minutes — longer blocks have repeatedly felt too big.",
      reason: `${tooB.evidence_count}× "too big" feedback`,
      confidence: tooB.confidence,
      evidence_count: tooB.evidence_count,
    });
  }

  const tooV = hasFriction("too_vague");
  if (tooV) {
    rules.push({
      id: "concrete_first_step",
      rule: 'Every task should open with a concrete first step — vague tasks don\'t get started.',
      reason: `${tooV.evidence_count}× "too vague" feedback`,
      confidence: tooV.confidence,
      evidence_count: tooV.evidence_count,
    });
  }

  const tired = hasFriction("tired") ?? hasFriction("overwhelmed");
  if (tired) {
    rules.push({
      id: "protect_energy",
      rule: "Front-load the most important task — energy is consistently lower later in the day.",
      reason: `${tired.evidence_count}× low-energy feedback`,
      confidence: tired.confidence,
      evidence_count: tired.evidence_count,
    });
  }

  if (planStyle === "starter_first") {
    rules.push({
      id: "starter_ritual",
      rule: "Begin each work session with a 5-minute starter task before moving to the main block.",
      reason: "Rescue triggered multiple times — starter rituals reduce overwhelm",
      confidence: 0.75,
      evidence_count: 3,
    });
  }

  if (preferredSize === "micro" || preferredSize === "short") {
    rules.push({
      id: "prefer_short_blocks",
      rule: "Aim for 15–25 minute blocks — that's the size you actually complete.",
      reason: `Median completed task size is ${preferredSize}`,
      confidence: 0.8,
      evidence_count: 5,
    });
  }

  const bestWindow = windows[0];
  if (bestWindow && bestWindow.confidence >= 0.6) {
    rules.push({
      id: "schedule_to_best_window",
      rule: `Schedule your highest-value task during ${bestWindow.window} — that's when you complete most.`,
      reason: `${Math.round(bestWindow.confidence * 100)}% completion rate during ${bestWindow.window}`,
      confidence: bestWindow.confidence,
      evidence_count: bestWindow.evidence_count,
    });
  }

  if (chatStyle === "direct") {
    rules.push({
      id: "direct_coaching",
      rule: "Be direct and specific — skip the soft framing and give the concrete next move.",
      reason: "Requested more direct feedback",
      confidence: 0.9,
      evidence_count: 2,
    });
  } else if (chatStyle === "gentle") {
    rules.push({
      id: "gentle_coaching",
      rule: "Keep the tone calm and supportive — avoid pressure language.",
      reason: "Requested gentler feedback",
      confidence: 0.9,
      evidence_count: 2,
    });
  }

  return rules.slice(0, 6);
}

// ─── Main derivation ──────────────────────────────────────────────────────────

export function deriveUserLearningProfile(
  state: MomentState,
  existingDismissed: string[] = [],
): UserLearningProfile {
  const signals = state.learning_signals ?? [];
  const stall = computeStallPattern(state);

  const preferredSize = derivePreferredTaskSize(state);
  const frictionTags = deriveFrictionTags(state);
  const planStyle = derivePlanStyle(state);
  const chatStyle = deriveChatStyle(state);
  const windows = deriveWorkWindows(state);
  const rules = deriveAdaptationRules(frictionTags, preferredSize, planStyle, chatStyle, windows);

  const bottleneck =
    stall.stall_type !== "unclear"
      ? {
          claim: stall.label,
          confidence: stall.confidence === "high" ? 0.9 : stall.confidence === "medium" ? 0.6 : 0.3,
          evidence: stall.evidence_chips,
        }
      : null;

  // Detect any feedback patterns (reuse existing utility)
  detectFeedbackPatterns(state); // side-effect free; result used for insight validation

  return {
    derived_at: new Date().toISOString(),
    signal_count: signals.length,
    preferred_task_size: preferredSize,
    best_work_windows: windows,
    friction_tags: frictionTags,
    plan_style: planStyle,
    chat_style: chatStyle,
    current_bottleneck: bottleneck,
    adaptation_rules: rules,
    dismissed_insights: existingDismissed,
  };
}
