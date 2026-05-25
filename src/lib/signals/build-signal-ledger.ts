/**
 * buildSignalLedger — pure projection of MomentState into a typed event stream.
 * No storage. No AI. No mutations.
 */
import type { MomentState } from "@/lib/types";
import type { MomentSignal, SignalLedger, MomentSignalType } from "./types";

const SEVEN_DAYS = 7 * 86_400_000;

function uid(prefix: string, i: number) {
  return `${prefix}_${i}`;
}

export function buildSignalLedger(state: MomentState | null): SignalLedger {
  if (!state) {
    return {
      signals: [],
      summary: { total: 0, last_7d: 0, by_type: {}, by_source: {}, top_consumers: [] },
    };
  }

  const signals: MomentSignal[] = [];
  let i = 0;

  // ---------- task lifecycle ----------
  for (const t of state.tasks ?? []) {
    signals.push({
      id: uid("task_created", i++),
      type: "task_created",
      source: t.created_by === "ai" ? "system" : "today",
      timestamp: t.created_at,
      related_task_id: t.id,
      related_goal_id: t.goal_id || undefined,
      confidence: 1,
      user_facing_meaning: `Task added: "${t.title}"`,
      downstream_consumers: ["today", "plan", "portfolio"],
    });

    if (t.status === "in_progress") {
      signals.push({
        id: uid("task_started", i++),
        type: "task_started",
        source: "today",
        timestamp: t.created_at,
        related_task_id: t.id,
        confidence: 1,
        user_facing_meaning: `Started "${t.title}"`,
        downstream_consumers: ["today", "coach"],
      });
    }

    if (t.status === "done" && t.completed_at) {
      signals.push({
        id: uid("task_completed", i++),
        type: "task_completed",
        source: "today",
        timestamp: t.completed_at,
        related_task_id: t.id,
        related_goal_id: t.goal_id || undefined,
        value: { workstream: t.workstream_id, category: t.category, proof: t.proof_of_completion },
        confidence: 1,
        user_facing_meaning: `Finished "${t.title}"`,
        downstream_consumers: ["today", "portfolio", "path", "coach"],
      });
    }

    if (t.status === "skipped") {
      signals.push({
        id: uid("task_rejected", i++),
        type: "task_rejected",
        source: "today",
        timestamp: t.completed_at || t.created_at,
        related_task_id: t.id,
        confidence: 1,
        user_facing_meaning: `Skipped "${t.title}"`,
        downstream_consumers: ["plan", "coach", "portfolio"],
      });
    }

    // memory saved — note_review with a mini lesson body
    if (t.note_review?.mini_lesson?.body) {
      signals.push({
        id: uid("memory_saved", i++),
        type: "memory_saved",
        source: "review",
        timestamp: t.note_review.created_at || t.completed_at || t.created_at,
        related_task_id: t.id,
        related_memory_id: t.id,
        value: { title: t.note_review.mini_lesson.title },
        confidence: 1,
        user_facing_meaning: `Saved a lesson from "${t.title}"`,
        downstream_consumers: ["portfolio", "coach", "forge"],
      });
    }
  }

  // ---------- feedback ----------
  for (const f of state.execution_feedback ?? []) {
    signals.push({
      id: uid("feedback_added", i++),
      type: "feedback_added",
      source: (f.source as any) ?? "today",
      timestamp: f.created_at,
      related_task_id: f.task_id || undefined,
      value: { feedback: f.feedback, note: f.note },
      confidence: 1,
      user_facing_meaning: `Feedback: ${f.feedback.split("_").join(" ")}`,
      downstream_consumers: ["today", "plan", "coach", "portfolio"],
    });
  }

  // ---------- schedule blocks ----------
  for (const b of state.schedule_state?.day_plan ?? []) {
    const status = b.block_status ?? b.status;
    if (status === "done" || status === "completed") {
      signals.push({
        id: uid("block_completed", i++),
        type: "block_completed",
        source: "plan",
        timestamp: b.end_time,
        related_block_id: b.id,
        confidence: 1,
        user_facing_meaning: `Completed block: ${b.title}`,
        downstream_consumers: ["plan", "portfolio"],
      });
    } else if (status === "missed") {
      signals.push({
        id: uid("block_missed", i++),
        type: "block_missed",
        source: "plan",
        timestamp: b.end_time,
        related_block_id: b.id,
        value: { window: `${b.start_time}–${b.end_time}` },
        confidence: 1,
        user_facing_meaning: `Missed block: ${b.title}`,
        downstream_consumers: ["plan", "coach"],
      });
    }
  }

  // plan_repaired — reform_note presence is the signal
  if (state.schedule_state?.reform_note?.trim()) {
    signals.push({
      id: uid("plan_repaired", i++),
      type: "plan_repaired",
      source: "plan",
      timestamp: state.schedule_state.last_plan_generated_at || new Date().toISOString(),
      value: { note: state.schedule_state.reform_note },
      confidence: 1,
      user_facing_meaning: "Plan was repaired",
      downstream_consumers: ["plan", "portfolio"],
    });
  }

  // ---------- reflections ----------
  for (const r of state.reflections ?? []) {
    signals.push({
      id: uid("reflection_added", i++),
      type: "reflection_added",
      source: "reflect",
      timestamp: r.created_at || r.date,
      value: { energy: r.energy_rating, win: r.accomplishment, struggle: r.struggle },
      confidence: 1,
      user_facing_meaning: r.accomplishment ? `Reflected: "${r.accomplishment.slice(0, 60)}"` : "Reflected on the day",
      downstream_consumers: ["portfolio", "coach", "path"],
    });
  }

  // ---------- rescue ----------
  for (const rs of state.rescue_signals ?? []) {
    signals.push({
      id: uid("rescue_triggered", i++),
      type: "rescue_triggered",
      source: "rescue",
      timestamp: rs.created_at,
      related_task_id: rs.affected_task_id || undefined,
      value: { reason: rs.reason, note: rs.note },
      confidence: 1,
      user_facing_meaning: `Rescue: ${rs.reason}`,
      downstream_consumers: ["today", "coach", "portfolio"],
    });
  }

  // ---------- forge artifacts ----------
  for (const sig of state.forge_state?.forge_signals ?? []) {
    signals.push({
      id: uid("forge_artifact_created", i++),
      type: "forge_artifact_created",
      source: "forge",
      timestamp: sig.created_at,
      value: { feature: sig.feature_title, key: sig.signal_key, value: sig.value },
      confidence: 0.9,
      user_facing_meaning: `Forge artifact: ${sig.feature_title}`,
      downstream_consumers: ["portfolio", "coach"],
    });
  }

  // ---------- path proof completed (capability transitions) ----------
  for (const c of state.pursuit_model?.capability_clusters ?? []) {
    if (c.status === "developing" || c.status === "solid" || c.status === "mastered") {
      signals.push({
        id: uid("path_proof_completed", i++),
        type: "path_proof_completed",
        source: "path",
        timestamp: state.pursuit_model?.compiled_at ?? new Date().toISOString(),
        value: { capability: c.name, status: c.status },
        confidence: 0.7,
        user_facing_meaning: `Skill forming: ${c.name} (${c.status})`,
        downstream_consumers: ["path", "portfolio"],
      });
    }
  }

  // ---------- chat friction (heuristic — recurring "do_differently" / "be_gentler") ----------
  const recentFeedback = (state.execution_feedback ?? []).slice(-12);
  const frictionCount = recentFeedback.filter(
    (f) => f.feedback === "do_differently" || f.feedback === "be_gentler" || f.feedback === "dont_understand",
  ).length;
  if (frictionCount >= 2) {
    signals.push({
      id: uid("chat_friction_detected", i++),
      type: "chat_friction_detected",
      source: "coach",
      timestamp: recentFeedback[recentFeedback.length - 1]?.created_at ?? new Date().toISOString(),
      value: { count: frictionCount },
      confidence: 0.7,
      user_facing_meaning: "Coach style may need to shift",
      downstream_consumers: ["coach"],
    });
  }

  // ---------- plan overload (heuristic — upcoming minutes > 1.5x daily target) ----------
  const target = state.constraints?.study_minutes_daily ?? 60;
  const upcomingMin = (state.schedule_state?.day_plan ?? [])
    .filter((b) => (b.block_status ?? b.status) !== "done" && (b.block_status ?? b.status) !== "completed")
    .reduce((acc, b) => acc + (b.duration_minutes ?? 0), 0);
  if (upcomingMin > target * 1.5 && target > 0) {
    signals.push({
      id: uid("plan_overload_detected", i++),
      type: "plan_overload_detected",
      source: "system",
      timestamp: new Date().toISOString(),
      value: { upcoming_minutes: upcomingMin, daily_target: target },
      confidence: 0.8,
      user_facing_meaning: "Today's plan is heavier than usual",
      downstream_consumers: ["plan", "coach"],
    });
  }

  // ---------- summary ----------
  signals.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const cutoff = new Date(Date.now() - SEVEN_DAYS).toISOString();
  const byType: Record<string, number> = {};
  const bySource: Record<string, number> = {};
  const consumerCount: Record<string, number> = {};
  let last7d = 0;
  for (const s of signals) {
    byType[s.type] = (byType[s.type] ?? 0) + 1;
    bySource[s.source] = (bySource[s.source] ?? 0) + 1;
    if (s.timestamp >= cutoff) last7d++;
    for (const c of s.downstream_consumers) consumerCount[c] = (consumerCount[c] ?? 0) + 1;
  }
  const topConsumers = Object.entries(consumerCount)
    .sort((a, b) => b[1] - a[1])
    .map(([surface, count]) => ({ surface, count }));

  return {
    signals,
    summary: {
      total: signals.length,
      last_7d: last7d,
      by_type: byType,
      by_source: bySource,
      top_consumers: topConsumers,
    },
  };
}

/** Compact summary for AI prompts. */
export function renderSignalLedgerForPrompt(l: SignalLedger): string {
  const top = Object.entries(l.summary.by_type)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([k, v]) => `${k}×${v}`)
    .join(", ");
  return `SIGNAL LEDGER: ${l.summary.total} total · ${l.summary.last_7d} in last 7d · top: ${top || "—"}`;
}

export type { MomentSignal, SignalLedger, MomentSignalType };
