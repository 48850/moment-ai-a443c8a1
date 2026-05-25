/**
 * buildMomentMemory — derives the user model from raw MomentState.
 * Pure. No AI. No storage.
 */
import type { MomentState } from "@/lib/types";
import type { MomentMemory } from "./types";
import { detectFeedbackPatterns } from "@/lib/feedback/patterns";

const DAY = 86_400_000;
const FOURTEEN_DAYS = 14 * DAY;

function median(nums: number[], fallback = 30): number {
  if (!nums.length) return fallback;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function topKeys<T extends string>(counts: Record<T, number>, n: number): T[] {
  return (Object.entries(counts) as Array<[T, number]>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k]) => k);
}

function windowLabel(hhmm: string): string {
  const h = parseInt(hhmm.slice(0, 2), 10);
  if (Number.isNaN(h)) return "unknown";
  if (h < 6) return "early morning";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 21) return "evening";
  return "late night";
}

function dayOfWeek(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
}

const EMPTY: MomentMemory = {
  task_profile: { preferred_minutes: 30, hard_start_subjects: [], reliable_task_types: [], common_rejection_reasons: [] },
  time_profile: { best_work_windows: [], weak_work_windows: [], plan_reliability_score: 0, common_overload_days: [] },
  learning_profile: { strongest_subjects: [], fragile_topics: [], saved_lessons: 0, recurring_gaps: [], preferred_review_formats: [] },
  goal_profile: { active_goal: "", current_stage: "", next_proof: "", bottleneck: "", identity_path: "" },
  emotional_execution_profile: { common_friction: [], rescue_triggers: [], recovery_patterns: [] },
  recent_wins: [],
  recent_struggles: [],
  open_loops: [],
  review_gaps: [],
  current_patterns: [],
};

export function buildMomentMemory(state: MomentState | null): MomentMemory {
  if (!state) return EMPTY;

  const tasks = state.tasks ?? [];
  const completed = tasks.filter((t) => t.status === "done");
  const feedback = state.execution_feedback ?? [];
  const reflections = state.reflections ?? [];
  const rescues = state.rescue_signals ?? [];
  const blocks = state.schedule_state?.day_plan ?? [];
  const now = Date.now();

  // ---------- task_profile ----------
  const completedDurations = completed
    .map((t) => t.estimated_minutes)
    .filter((n): n is number => typeof n === "number" && n > 0);
  const preferredMinutes = median(completedDurations, 30);

  const categoryCounts: Record<string, number> = {};
  for (const t of completed) categoryCounts[t.category] = (categoryCounts[t.category] ?? 0) + 1;
  const reliableTaskTypes = topKeys(categoryCounts as Record<string, number>, 3);

  // hard-start subjects: tasks where rejection feedback outweighs completion
  const tasksByGoal: Record<string, { rejected: number; completed: number; title: string }> = {};
  for (const t of tasks) {
    const k = t.workstream_id || t.goal_id || t.category;
    if (!tasksByGoal[k]) tasksByGoal[k] = { rejected: 0, completed: 0, title: t.workstream_id || t.category };
    if (t.status === "done") tasksByGoal[k].completed++;
    if (t.status === "skipped") tasksByGoal[k].rejected++;
  }
  const rejectionFeedbacks = new Set(["too_big", "too_vague", "feels_unrealistic", "wrong_time", "overwhelmed"]);
  for (const f of feedback) {
    if (!rejectionFeedbacks.has(f.feedback)) continue;
    const t = tasks.find((x) => x.id === f.task_id);
    if (!t) continue;
    const k = t.workstream_id || t.goal_id || t.category;
    if (!tasksByGoal[k]) tasksByGoal[k] = { rejected: 0, completed: 0, title: k };
    tasksByGoal[k].rejected++;
  }
  const hardStartSubjects = Object.entries(tasksByGoal)
    .filter(([, v]) => v.rejected > v.completed && v.rejected >= 2)
    .sort((a, b) => b[1].rejected - a[1].rejected)
    .slice(0, 4)
    .map(([k]) => k);

  const rejectionReasonCounts: Record<string, number> = {};
  for (const f of feedback) {
    if (rejectionFeedbacks.has(f.feedback)) {
      rejectionReasonCounts[f.feedback] = (rejectionReasonCounts[f.feedback] ?? 0) + 1;
    }
  }
  const commonRejectionReasons = topKeys(rejectionReasonCounts, 4).map((s) => s.replaceAll("_", " "));

  // ---------- time_profile ----------
  const windowOutcomes: Record<string, { done: number; missed: number }> = {};
  const dowOutcomes: Record<string, number> = {};
  for (const b of blocks) {
    const status = b.block_status ?? b.status;
    const win = windowLabel(b.start_time || "");
    if (!windowOutcomes[win]) windowOutcomes[win] = { done: 0, missed: 0 };
    if (status === "done" || status === "completed") windowOutcomes[win].done++;
    if (status === "missed") {
      windowOutcomes[win].missed++;
      const dow = dayOfWeek(state.schedule_state?.last_plan_generated_at ?? "");
      if (dow) dowOutcomes[dow] = (dowOutcomes[dow] ?? 0) + 1;
    }
  }
  const bestWindows = Object.entries(windowOutcomes)
    .filter(([, v]) => v.done >= v.missed && v.done > 0)
    .sort((a, b) => b[1].done - a[1].done)
    .map(([k]) => k);
  const weakWindows = Object.entries(windowOutcomes)
    .filter(([, v]) => v.missed > v.done && v.missed > 0)
    .sort((a, b) => b[1].missed - a[1].missed)
    .map(([k]) => k);
  const recentBlocks = blocks.filter((b) => {
    const s = b.block_status ?? b.status;
    return s === "done" || s === "completed" || s === "missed";
  });
  const doneBlocks = recentBlocks.filter((b) => (b.block_status ?? b.status) === "done" || (b.block_status ?? b.status) === "completed").length;
  const planReliability = recentBlocks.length ? Math.round((doneBlocks / recentBlocks.length) * 100) : 0;
  const commonOverloadDays = topKeys(dowOutcomes, 2);

  // ---------- learning_profile ----------
  const savedLessons = tasks.filter((t) => t.note_review?.mini_lesson?.body).length;
  const fragileTopics: string[] = [];
  for (const t of tasks) {
    const gaps = t.note_review?.gaps ?? [];
    for (const g of gaps) if (g.trim()) fragileTopics.push(g.trim());
  }
  const fragileTopicsTop = Array.from(new Set(fragileTopics)).slice(0, 5);

  const strongSubjects = topKeys(categoryCounts, 2);
  const recurringGapsCount: Record<string, number> = {};
  for (const r of reflections) {
    const s = (r.struggle ?? "").trim();
    if (s) recurringGapsCount[s] = (recurringGapsCount[s] ?? 0) + 1;
  }
  const recurringGaps = Object.entries(recurringGapsCount)
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  // ---------- goal_profile ----------
  const goalProfile = {
    active_goal: state.active_goal?.statement ?? "",
    current_stage: state.active_goal?.current_stage ?? "",
    next_proof: state.pursuit_model?.workstreams?.[0]?.next_proof ?? "",
    bottleneck: state.pursuit_model?.workstreams?.[0]?.bottleneck ?? state.today_state?.current_bottleneck ?? "",
    identity_path: state.active_goal?.desired_identity ?? "",
  };

  // ---------- emotional_execution_profile ----------
  const frictionTags: string[] = [];
  for (const r of reflections) for (const tag of r.friction_tags ?? []) frictionTags.push(tag);
  const frictionCount: Record<string, number> = {};
  for (const t of frictionTags) frictionCount[t] = (frictionCount[t] ?? 0) + 1;
  const commonFriction = topKeys(frictionCount, 3).map((s) => s.replaceAll("_", " "));

  const rescueTriggerCount: Record<string, number> = {};
  for (const r of rescues) rescueTriggerCount[r.reason] = (rescueTriggerCount[r.reason] ?? 0) + 1;
  const rescueTriggers = topKeys(rescueTriggerCount, 3);

  const recoveryPatterns: string[] = [];
  if (rescues.some((r) => r.switched_to_plan_b)) recoveryPatterns.push("switches to Plan B");
  if (rescues.some((r) => r.shrunk_to_minutes > 0)) recoveryPatterns.push("shrinks task on overwhelm");

  // ---------- recent wins / struggles ----------
  const sortedRefls = [...reflections].sort((a, b) => (b.created_at || b.date).localeCompare(a.created_at || a.date));
  const recentWins = sortedRefls.map((r) => (r.accomplishment ?? "").trim()).filter(Boolean).slice(0, 5);
  const recentStruggles = sortedRefls.map((r) => (r.struggle ?? "").trim()).filter(Boolean).slice(0, 5);

  // ---------- open loops ----------
  const openLoops = tasks
    .filter((t) => t.status === "pending" && t.priority === "high")
    .map((t) => {
      const created = t.created_at ? new Date(t.created_at).getTime() : now;
      return { task_id: t.id, title: t.title, days_open: Math.floor((now - created) / DAY) };
    })
    .filter((x) => x.days_open >= 3)
    .sort((a, b) => b.days_open - a.days_open)
    .slice(0, 5);

  // ---------- review gaps ----------
  const reviewGaps = tasks
    .filter((t) => t.note_review?.mini_lesson?.body && !t.note_review?.next_step)
    .slice(0, 5)
    .map((t) => ({ task_id: t.id, title: t.title }));

  // ---------- patterns ----------
  const patterns: MomentMemory["current_patterns"] = [];
  const feedbackPatterns = detectFeedbackPatterns(state, 12);
  for (const p of feedbackPatterns) {
    patterns.push({
      id: `fb_${p.id}`,
      message: p.message,
      confidence: Math.min(1, p.count / 4),
      suggested_adjustment: "applied to next move",
      surface: "today",
    });
  }
  if (hardStartSubjects.length) {
    patterns.push({
      id: "subject_friction",
      message: `These areas keep getting pushed back: ${hardStartSubjects.join(", ")}.`,
      confidence: 0.7,
      suggested_adjustment: "shrink first step + reframe as a 10-minute starter",
      surface: "plan",
    });
  }
  if (planReliability && planReliability < 50 && recentBlocks.length >= 4) {
    patterns.push({
      id: "plan_reliability_low",
      message: `Recent plans have only completed ${planReliability}% of blocks. Plan is asking for too much.`,
      confidence: 0.8,
      suggested_adjustment: "drop two blocks; protect the one that matters",
      surface: "plan",
    });
  }
  if (weakWindows.length) {
    patterns.push({
      id: "weak_window",
      message: `Blocks in the ${weakWindows[0]} tend to slip.`,
      confidence: 0.7,
      suggested_adjustment: "move important work out of this window",
      surface: "plan",
    });
  }
  if (rescueTriggers.length >= 2) {
    patterns.push({
      id: "rescue_recurring",
      message: `Rescue used repeatedly for: ${rescueTriggers.join(", ")}.`,
      confidence: 0.75,
      suggested_adjustment: "reduce daily target until the pattern fades",
      surface: "coach",
    });
  }
  // avoidance pattern: same pending task with skipped or wrong_time feedback ≥3 times
  const avoidance = new Map<string, number>();
  for (const f of feedback) {
    if (f.task_id && (f.feedback === "wrong_time" || f.feedback === "feels_unrealistic" || f.feedback === "do_differently")) {
      avoidance.set(f.task_id, (avoidance.get(f.task_id) ?? 0) + 1);
    }
  }
  for (const [taskId, count] of avoidance) {
    if (count >= 3) {
      const t = tasks.find((x) => x.id === taskId);
      if (t && t.status === "pending") {
        patterns.push({
          id: `avoidance_${taskId}`,
          message: `"${t.title}" keeps being pushed back.`,
          confidence: 0.8,
          suggested_adjustment: "break it down or replace it",
          surface: "today",
        });
        break; // surface just the loudest one
      }
    }
  }

  return {
    task_profile: {
      preferred_minutes: preferredMinutes,
      hard_start_subjects: hardStartSubjects,
      reliable_task_types: reliableTaskTypes,
      common_rejection_reasons: commonRejectionReasons,
    },
    time_profile: {
      best_work_windows: bestWindows,
      weak_work_windows: weakWindows,
      plan_reliability_score: planReliability,
      common_overload_days: commonOverloadDays,
    },
    learning_profile: {
      strongest_subjects: strongSubjects,
      fragile_topics: fragileTopicsTop,
      saved_lessons: savedLessons,
      recurring_gaps: recurringGaps,
      preferred_review_formats: [],
    },
    goal_profile: goalProfile,
    emotional_execution_profile: {
      common_friction: commonFriction,
      rescue_triggers: rescueTriggers,
      recovery_patterns: recoveryPatterns,
    },
    recent_wins: recentWins,
    recent_struggles: recentStruggles,
    open_loops: openLoops,
    review_gaps: reviewGaps,
    current_patterns: patterns.slice(0, 5),
  };
}

/** Compact, prompt-ready block. */
export function renderMomentMemoryForPrompt(m: MomentMemory): string {
  const lines: string[] = [];
  lines.push("MOMENT MEMORY (the user model — reference, do not re-derive):");
  lines.push(`- Preferred task size: ~${m.task_profile.preferred_minutes} min · plan reliability ${m.time_profile.plan_reliability_score}%`);
  if (m.task_profile.hard_start_subjects.length)
    lines.push(`- Hard to start: ${m.task_profile.hard_start_subjects.join(", ")}`);
  if (m.task_profile.common_rejection_reasons.length)
    lines.push(`- Common rejection reasons: ${m.task_profile.common_rejection_reasons.join(", ")}`);
  if (m.time_profile.best_work_windows.length)
    lines.push(`- Best windows: ${m.time_profile.best_work_windows.join(", ")}`);
  if (m.time_profile.weak_work_windows.length)
    lines.push(`- Weak windows: ${m.time_profile.weak_work_windows.join(", ")}`);
  if (m.learning_profile.fragile_topics.length)
    lines.push(`- Fragile topics (need review): ${m.learning_profile.fragile_topics.join(", ")}`);
  if (m.learning_profile.recurring_gaps.length)
    lines.push(`- Recurring gaps: ${m.learning_profile.recurring_gaps.join("; ")}`);
  if (m.goal_profile.next_proof) lines.push(`- Next proof: ${m.goal_profile.next_proof}`);
  if (m.goal_profile.bottleneck) lines.push(`- Bottleneck: ${m.goal_profile.bottleneck}`);
  if (m.emotional_execution_profile.common_friction.length)
    lines.push(`- Friction: ${m.emotional_execution_profile.common_friction.join(", ")}`);
  if (m.open_loops.length)
    lines.push(`- Open loops: ${m.open_loops.map((l) => `"${l.title}" (${l.days_open}d)`).join(" | ")}`);
  if (m.current_patterns.length)
    lines.push(`- Active patterns: ${m.current_patterns.map((p) => p.message).join(" | ")}`);
  lines.push("RULE: Adapt to memory. Never ask the user something this already answers.");
  return lines.join("\n");
}
