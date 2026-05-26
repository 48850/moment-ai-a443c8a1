/**
 * Practical execution-state inference.
 *
 * Not diagnosis. Not therapy. Just a coaching read on where the user is right
 * now so the Coach can change tone and action without lecturing.
 */
import type { MomentState } from "@/lib/types";
import type { ExecutionState } from "./coach-action-types";

export interface InferredState {
  state: ExecutionState;
  confidence: number; // 0–1
  evidence: string[];
}

const OVERLOAD_FEEDBACK = new Set(["too_much_today", "overwhelmed", "tired", "too_big"]);
const STUCK_FEEDBACK = new Set(["hard_to_start", "stuck", "felt_pointless", "confused"]);
const PROUD_FEEDBACK = new Set(["flow", "easier_than_expected", "satisfying"]);

const DAY = 86_400_000;

export function inferExecutionState(state: MomentState | null, latestUserText = ""): InferredState {
  if (!state) return { state: "steady", confidence: 0.1, evidence: ["no state"] };

  const now = Date.now();
  const evidence: string[] = [];

  const tasks = state.tasks ?? [];
  const pending = tasks.filter((t) => t.status === "pending");
  const doneToday = tasks.filter(
    (t) => t.status === "done" && t.completed_at && now - new Date(t.completed_at).getTime() < DAY,
  );
  const overdue = pending.filter((t) => {
    if (!t.due_date) return false;
    return new Date(t.due_date).getTime() < now - DAY;
  });

  const fb14 = (state.execution_feedback ?? []).filter(
    (f) => now - new Date(f.created_at ?? now).getTime() < 14 * DAY,
  );
  const overloadHits = fb14.filter((f) => OVERLOAD_FEEDBACK.has(f.feedback)).length;
  const stuckHits = fb14.filter((f) => STUCK_FEEDBACK.has(f.feedback)).length;
  const proudHits = fb14.filter((f) => PROUD_FEEDBACK.has(f.feedback)).length;

  const rescue7d = (state.rescue_signals ?? []).filter(
    (r) => now - new Date(r.created_at).getTime() < 7 * DAY,
  ).length;

  const blocks = state.schedule_state?.day_plan ?? [];
  const missedBlocks = blocks.filter((b) => (b as any).status === "missed").length;

  const text = latestUserText.toLowerCase();
  const says = (...words: string[]) => words.some((w) => text.includes(w));
  const matches = (pattern: RegExp) => pattern.test(text);

  // ── Explicit language signals win first ────────────────────────────────────
  if (says("can't", "cant", "i give up", "pointless", "what's the point", "whats the point")) {
    evidence.push(`user said: "${latestUserText.slice(0, 60)}"`);
    return { state: "drifting", confidence: 0.8, evidence };
  }
  if (
    says("i'm cooked", "im cooked", "burnt out", "burned out", "too much", "overwhelmed", "drowning") ||
    matches(/panick?ing|freaking out/)
  ) {
    evidence.push(`user said: "${latestUserText.slice(0, 60)}"`);
    return { state: "overloaded", confidence: 0.85, evidence };
  }
  // Urgent deadline + not started = overloaded
  if (
    matches(/haven'?t (started|begun|done any)/) &&
    matches(/due (today|tomorrow|tonight|this week|friday|thursday|wednesday|tuesday|monday)/)
  ) {
    evidence.push(`urgent deadline: "${latestUserText.slice(0, 60)}"`);
    return { state: "overloaded", confidence: 0.9, evidence };
  }
  if (says("stuck", "don't know how", "dont know how", "blank", "lost")) {
    evidence.push(`user said: "${latestUserText.slice(0, 60)}"`);
    return { state: "stuck", confidence: 0.8, evidence };
  }
  if (says("confused", "don't get it", "dont get it", "doesn't make sense", "doesnt make sense")) {
    evidence.push(`user said: "${latestUserText.slice(0, 60)}"`);
    return { state: "confused", confidence: 0.8, evidence };
  }
  if (says("i did it", "finally", "got it done", "finished", "smashed")) {
    evidence.push(`user said: "${latestUserText.slice(0, 60)}"`);
    return { state: "proud", confidence: 0.7, evidence };
  }
  if (says("annoyed", "frustrat", "angry", "pissed")) {
    evidence.push(`user said: "${latestUserText.slice(0, 60)}"`);
    return { state: "frustrated", confidence: 0.75, evidence };
  }

  // ── Behavioural signals ────────────────────────────────────────────────────
  if (overloadHits >= 3 || (pending.length >= 5 && missedBlocks >= 2)) {
    evidence.push(`${overloadHits} overload feedback in 14d`);
    if (pending.length >= 5) evidence.push(`${pending.length} pending tasks`);
    return { state: "overloaded", confidence: 0.7, evidence };
  }

  if (rescue7d > 0 && doneToday.length > 0) {
    evidence.push(`rescue used in last 7d`);
    evidence.push(`${doneToday.length} done today`);
    return { state: "recovering", confidence: 0.7, evidence };
  }

  if (overdue.length >= 2) {
    evidence.push(`${overdue.length} overdue tasks`);
    return { state: "drifting", confidence: 0.65, evidence };
  }

  if (stuckHits >= 2) {
    evidence.push(`${stuckHits} stuck/hard-to-start signals`);
    return { state: "stuck", confidence: 0.6, evidence };
  }

  if (proudHits >= 2 && doneToday.length >= 1) {
    evidence.push(`${proudHits} positive feedback signals`);
    evidence.push(`${doneToday.length} done today`);
    return { state: "proud", confidence: 0.65, evidence };
  }

  if (pending.length === 0 && doneToday.length === 0) {
    evidence.push("no pending tasks, none done today");
    return { state: "low_confidence", confidence: 0.4, evidence };
  }

  evidence.push(`${doneToday.length} done today, ${pending.length} pending`);
  return { state: "steady", confidence: 0.55, evidence };
}
