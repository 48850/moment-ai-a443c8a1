/**
 * Learning Portfolio — a progressively-built snapshot of EVERYTHING the user
 * has done in Moment. Every AI call references this so generations get smarter
 * the more the user uses the app.
 *
 * Pulled live from MomentState — no separate storage. Compact-by-design so it
 * fits inside system prompts.
 */
import type { MomentState } from "@/lib/types";

export interface LearningPortfolio {
  lifetime_stats: {
    days_active: number;
    tasks_completed: number;
    tasks_total: number;
    completion_rate: number;
    notes_written: number;
    reflections_logged: number;
    chat_turns: number;
    plans_generated: number;
    streak_days: number;
  };
  completed_work: Array<{
    title: string;
    completed_at?: string;
    proof?: string;
    workstream?: string;
    category?: string;
  }>;
  mini_lessons_learned: Array<{
    title: string;
    body: string;
    from_task: string;
    created_at?: string;
  }>;
  recurring_patterns: {
    common_feedback: Array<{ label: string; count: number }>;
    common_struggles: string[];
    common_wins: string[];
    energy_profile: { high: number; ok: number; low: number };
  };
  capability_evolution: Array<{ name: string; status: string }>;
  milestones: string[]; // identity / stage / streak milestones
  open_threads: Array<{ kind: "task" | "question"; text: string }>;
  forge_progress: Array<{ guidebook: string; signal_count: number }>;
  decisions_made: string[]; // user choices, pivots, commitments worth remembering
}

function safeDate(s?: string) {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function uniqueDays(timestamps: Array<string | undefined>): number {
  const days = new Set<string>();
  for (const t of timestamps) {
    const d = safeDate(t);
    if (d) days.add(d.toISOString().slice(0, 10));
  }
  return days.size;
}

function topN<T extends string>(items: T[], n = 5): Array<{ label: T; count: number }> {
  const counts = new Map<T, number>();
  for (const i of items) counts.set(i, (counts.get(i) ?? 0) + 1);
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([label, count]) => ({ label, count }));
}

export function buildLearningPortfolio(s: MomentState | null): LearningPortfolio {
  if (!s) {
    return {
      lifetime_stats: {
        days_active: 0, tasks_completed: 0, tasks_total: 0, completion_rate: 0,
        notes_written: 0, reflections_logged: 0, chat_turns: 0, plans_generated: 0,
        streak_days: 0,
      },
      completed_work: [],
      mini_lessons_learned: [],
      recurring_patterns: { common_feedback: [], common_struggles: [], common_wins: [], energy_profile: { high: 0, ok: 0, low: 0 } },
      capability_evolution: [],
      milestones: [],
      open_threads: [],
      forge_progress: [],
      decisions_made: [],
    };
  }

  const tasks = s.tasks ?? [];
  const completed = tasks.filter((t) => t.status === "completed");
  const feedback = s.execution_feedback ?? [];
  const reflections = s.reflections ?? [];
  const chat = s.chat_messages ?? [];

  // ----- lifetime stats -----
  const daysActive = uniqueDays([
    ...tasks.map((t) => t.created_at),
    ...completed.map((t) => t.completed_at),
    ...feedback.map((f) => f.created_at),
    ...reflections.map((r) => r.date),
    ...chat.map((m) => m.created_at),
  ]);
  const notesWritten = tasks.reduce((acc, t) => acc + (t.notes?.length ?? 0), 0);
  const completionRate = tasks.length ? Math.round((completed.length / tasks.length) * 100) / 100 : 0;

  // streak: count consecutive days back from today with at least one completion
  const completionDays = new Set(
    completed.map((t) => (safeDate(t.completed_at)?.toISOString().slice(0, 10) ?? "")).filter(Boolean),
  );
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 90; i++) {
    const d = new Date(today.getTime() - i * 86_400_000).toISOString().slice(0, 10);
    if (completionDays.has(d)) streak++; else break;
  }

  // ----- completed work (last 25, freshest first) -----
  const completedWork = [...completed]
    .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
    .slice(0, 25)
    .map((t) => ({
      title: t.title,
      completed_at: t.completed_at,
      proof: t.proof_of_completion,
      workstream: t.workstream_id,
      category: t.category,
    }));

  // ----- mini-lessons saved from notes -----
  const miniLessons = tasks
    .filter((t) => t.note_review?.mini_lesson?.body)
    .sort((a, b) => (b.note_review?.created_at ?? "").localeCompare(a.note_review?.created_at ?? ""))
    .slice(0, 15)
    .map((t) => ({
      title: t.note_review!.mini_lesson?.title ?? t.note_review!.headline ?? "Lesson",
      body: (t.note_review!.mini_lesson?.body ?? "").slice(0, 600),
      from_task: t.title,
      created_at: t.note_review!.created_at,
    }));

  // ----- recurring patterns -----
  const commonFeedback = topN(feedback.map((f) => f.feedback).filter(Boolean) as string[], 6);
  const commonStruggles = topN(
    reflections.map((r) => (r.struggle ?? "").trim()).filter(Boolean) as string[],
    5,
  ).map((x) => x.label);
  const commonWins = topN(
    reflections.map((r) => (r.accomplishment ?? "").trim()).filter(Boolean) as string[],
    5,
  ).map((x) => x.label);
  const energy = { high: 0, ok: 0, low: 0 };
  for (const r of reflections) {
    const e = r.energy_rating ?? 0;
    if (e >= 4) energy.high++;
    else if (e >= 2) energy.ok++;
    else energy.low++;
  }

  // ----- capability evolution -----
  const capabilities = (s.pursuit_model?.capability_clusters ?? []).map((c) => ({
    name: c.name,
    status: c.status,
  }));

  // ----- milestones -----
  const milestones: string[] = [];
  if (completed.length >= 1) milestones.push(`first_completion: ${completed[0]?.title ?? ""}`);
  if (completed.length >= 10) milestones.push(`10_tasks_done`);
  if (completed.length >= 50) milestones.push(`50_tasks_done`);
  if (streak >= 3) milestones.push(`streak_${streak}_days`);
  if (s.active_goal?.current_stage && s.active_goal?.target_stage) {
    milestones.push(`stage: ${s.active_goal.current_stage} → ${s.active_goal.target_stage}`);
  }
  if (s.active_goal?.desired_identity) milestones.push(`identity: ${s.active_goal.desired_identity}`);

  // ----- open threads (pending tasks + recent rescue signals) -----
  const openThreads: LearningPortfolio["open_threads"] = tasks
    .filter((t) => t.status === "pending")
    .slice(0, 10)
    .map((t) => ({ kind: "task" as const, text: t.title }));

  // ----- forge progress -----
  const forgeProgress = (s.forge_state?.guidebooks ?? [])
    .filter((g) => g.status === "active")
    .map((g) => ({
      guidebook: g.title,
      signal_count: (s.forge_state?.forge_signals ?? []).filter((sig) => sig.guidebook_id === g.id).length,
    }));

  // ----- decisions / commitments worth remembering -----
  const decisions: string[] = [];
  if (s.active_goal?.statement) decisions.push(`active_goal: ${s.active_goal.statement}`);
  if (s.active_goal?.why_it_matters) decisions.push(`why: ${s.active_goal.why_it_matters}`);
  if (s.pursuit_model?.summary) decisions.push(`pursuit: ${s.pursuit_model.summary}`);
  if (s.onboarding?.understanding?.assumptions?.length) {
    decisions.push(`assumptions: ${s.onboarding.understanding.assumptions.slice(0, 3).join("; ")}`);
  }

  return {
    lifetime_stats: {
      days_active: daysActive,
      tasks_completed: completed.length,
      tasks_total: tasks.length,
      completion_rate: completionRate,
      notes_written: notesWritten,
      reflections_logged: reflections.length,
      chat_turns: chat.length,
      plans_generated: 0, // reserved for future tracking
      streak_days: streak,
    },
    completed_work: completedWork,
    mini_lessons_learned: miniLessons,
    recurring_patterns: {
      common_feedback: commonFeedback,
      common_struggles: commonStruggles,
      common_wins: commonWins,
      energy_profile: energy,
    },
    capability_evolution: capabilities,
    milestones,
    open_threads: openThreads,
    forge_progress: forgeProgress,
    decisions_made: decisions,
  };
}

/** Render the portfolio as a compact text block for system prompts. */
export function renderPortfolioForPrompt(p: LearningPortfolio): string {
  const ls = p.lifetime_stats;
  const lines: string[] = [];
  lines.push(`LEARNING PORTFOLIO (the user's progressive record — always reference this; never plan as if this is day one):`);
  lines.push(`- Lifetime: ${ls.days_active} active days · ${ls.tasks_completed}/${ls.tasks_total} tasks done (${Math.round(ls.completion_rate * 100)}%) · ${ls.notes_written} notes · ${ls.reflections_logged} reflections · current streak ${ls.streak_days}d`);
  if (p.milestones.length) lines.push(`- Milestones: ${p.milestones.join(" · ")}`);
  if (p.decisions_made.length) lines.push(`- Standing decisions: ${p.decisions_made.join(" · ")}`);
  if (p.completed_work.length) {
    lines.push(`- Recently completed (newest first): ${p.completed_work.slice(0, 10).map((c) => `"${c.title}"${c.proof ? ` → ${c.proof}` : ""}`).join(" | ")}`);
  }
  if (p.mini_lessons_learned.length) {
    lines.push(`- Mini-lessons already taught (do NOT repeat — build on them):`);
    for (const l of p.mini_lessons_learned.slice(0, 6)) {
      lines.push(`  · ${l.title} (from "${l.from_task}"): ${l.body.slice(0, 220)}`);
    }
  }
  if (p.recurring_patterns.common_feedback.length) {
    lines.push(`- Recurring task feedback: ${p.recurring_patterns.common_feedback.map((f) => `${f.label}×${f.count}`).join(", ")}`);
  }
  if (p.recurring_patterns.common_struggles.length) {
    lines.push(`- Recurring struggles: ${p.recurring_patterns.common_struggles.join("; ")}`);
  }
  if (p.recurring_patterns.common_wins.length) {
    lines.push(`- Recurring wins: ${p.recurring_patterns.common_wins.join("; ")}`);
  }
  const e = p.recurring_patterns.energy_profile;
  if (e.high || e.ok || e.low) lines.push(`- Energy profile: high=${e.high}, ok=${e.ok}, low=${e.low}`);
  if (p.capability_evolution.length) {
    lines.push(`- Capability state: ${p.capability_evolution.map((c) => `${c.name}=${c.status}`).join(", ")}`);
  }
  if (p.open_threads.length) {
    lines.push(`- Open threads (in-flight): ${p.open_threads.slice(0, 8).map((t) => t.text).join(" | ")}`);
  }
  if (p.forge_progress.length) {
    lines.push(`- Forge guidebooks in use: ${p.forge_progress.map((g) => `${g.guidebook}(${g.signal_count} signals)`).join(", ")}`);
  }
  lines.push(`RULE: Tailor output to this portfolio. Acknowledge progress. Avoid re-teaching past lessons. Build on completed work. Address recurring struggles head-on.`);
  return lines.join("\n");
}
