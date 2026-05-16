import type {
  MomentState,
  PursuitWorkstream,
  EvidenceSignal,
  ExecutionFeedbackItem,
  Reflection,
  Task,
} from "@/lib/types";

/* ────────────────────────────────────────────────────────────── *
 * Mission analytics — turns raw state into per-workstream signal *
 * (quant + qual). Drives the constellation, the workstream rows, *
 * and the daily snapshot used by the AI for confrontation.       *
 * ────────────────────────────────────────────────────────────── */

const DAY = 86_400_000;

export interface FeedbackTone {
  positive: number; // valuable, easy
  friction: number; // hard, need_help, dont_understand
  fatigue: number;  // tired, overwhelmed, too_much_today, wrong_time
  fit_off: number;  // too_big, too_vague, feels_unrealistic, not_relevant
  total: number;
  topLabels: string[]; // up to 3 most-used labels
}

const TONE_BUCKETS: Record<string, keyof Omit<FeedbackTone, "total" | "topLabels">> = {
  valuable: "positive", easy: "positive",
  hard: "friction", need_help: "friction", dont_understand: "friction", do_differently: "friction",
  tired: "fatigue", overwhelmed: "fatigue", too_much_today: "fatigue", wrong_time: "fatigue",
  too_big: "fit_off", too_small: "fit_off", too_vague: "fit_off",
  feels_unrealistic: "fit_off", not_relevant: "fit_off",
};

function summarizeFeedback(items: ExecutionFeedbackItem[]): FeedbackTone {
  const t: FeedbackTone = { positive: 0, friction: 0, fatigue: 0, fit_off: 0, total: items.length, topLabels: [] };
  const counts: Record<string, number> = {};
  for (const it of items) {
    const bucket = TONE_BUCKETS[it.feedback];
    if (bucket) t[bucket]++;
    counts[it.feedback] = (counts[it.feedback] ?? 0) + 1;
  }
  t.topLabels = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);
  return t;
}

function signalTrajectoryScore(s: EvidenceSignal): number | null {
  // Returns 0-100 where 100 = at-or-past target. Numeric only; null when not comparable.
  const cur = parseFloat(s.last_value);
  const tgt = parseFloat(s.target);
  if (!isFinite(cur) || !isFinite(tgt) || tgt === 0) return null;
  const ratio = Math.min(1.2, Math.max(0, cur / tgt));
  return Math.round(Math.min(100, ratio * 100));
}

export interface WorkstreamAnalytics {
  workstream: PursuitWorkstream;
  tasks: { total: number; done: number; in_progress: number; pending: number; pct: number };
  velocity_7d: number;          // tasks completed in last 7 days
  velocity_prev_7d: number;     // 7-14 days ago, for trend
  trend: "rising" | "steady" | "falling" | "cold";
  linkedSignals: EvidenceSignal[];
  signalScore: number | null;   // average trajectory of linked signals
  feedback: FeedbackTone;
  reflectionMentions: number;   // reflections mentioning this workstream's keywords
  health: number;               // composite 0-100
  headline: string;             // qualitative one-liner
}

function tokenize(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
}

export function analyzeWorkstream(
  state: MomentState,
  ws: PursuitWorkstream,
): WorkstreamAnalytics {
  const tasks = (state.tasks ?? []).filter((t: Task) => t.workstream_id === ws.id);
  const done = tasks.filter((t) => t.status === "done");
  const in_progress = tasks.filter((t) => t.status === "in_progress").length;
  const pending = tasks.filter((t) => t.status === "pending").length;
  const pct = tasks.length === 0 ? 0 : Math.round((done.length / tasks.length) * 100);

  const now = Date.now();
  const completedAt = (t: Task) => (t.completed_at ? new Date(t.completed_at).getTime() : 0);
  const velocity_7d = done.filter((t) => completedAt(t) > now - 7 * DAY).length;
  const velocity_prev_7d = done.filter((t) => {
    const c = completedAt(t);
    return c > now - 14 * DAY && c <= now - 7 * DAY;
  }).length;

  const trend: WorkstreamAnalytics["trend"] =
    velocity_7d === 0 && velocity_prev_7d === 0 ? "cold"
      : velocity_7d > velocity_prev_7d ? "rising"
      : velocity_7d < velocity_prev_7d ? "falling"
      : "steady";

  // Link signals heuristically: name overlap with workstream
  const wsTokens = new Set(tokenize(ws.name + " " + ws.description));
  const linkedSignals = (state.pursuit_model?.evidence_signals ?? []).filter((s) => {
    const sigTokens = tokenize(s.name + " " + s.description);
    return sigTokens.some((t) => wsTokens.has(t));
  });
  const sigScores = linkedSignals.map(signalTrajectoryScore).filter((v): v is number => v !== null);
  const signalScore = sigScores.length === 0 ? null : Math.round(sigScores.reduce((a, b) => a + b, 0) / sigScores.length);

  // Feedback targeted at this workstream OR at its tasks
  const taskIds = new Set(tasks.map((t) => t.id));
  const feedbackItems = (state.execution_feedback ?? []).filter((f) =>
    f.target_id === ws.id || taskIds.has(f.task_id)
  );
  const feedback = summarizeFeedback(feedbackItems);

  // Reflection mentions: simple keyword overlap on accomplishment/struggle
  const reflectionMentions = (state.reflections ?? []).filter((r: Reflection) => {
    const text = `${r.accomplishment} ${r.struggle ?? ""} ${r.win ?? ""}`.toLowerCase();
    return [...wsTokens].some((tok) => text.includes(tok));
  }).length;

  // Composite health
  const statusFloor: Record<PursuitWorkstream["status"], number> = {
    on_track: 70, complete: 100, slipping: 45, stalled: 20, not_started: 30,
  };
  let health = statusFloor[ws.status];
  if (tasks.length > 0) health = Math.round(health * 0.5 + pct * 0.5);
  if (signalScore !== null) health = Math.round(health * 0.7 + signalScore * 0.3);
  if (feedback.total > 0) {
    const ratio = (feedback.positive - feedback.friction - feedback.fatigue - feedback.fit_off) / feedback.total;
    health = Math.max(0, Math.min(100, Math.round(health + ratio * 12)));
  }
  if (trend === "rising") health = Math.min(100, health + 4);
  if (trend === "falling") health = Math.max(0, health - 4);
  if (trend === "cold" && tasks.length === 0) health = Math.min(health, 35);

  // Qualitative headline
  let headline = "Quiet — no recent signal.";
  if (feedback.fatigue > feedback.positive && feedback.fatigue >= 2) headline = "Energy is the bottleneck, not the work.";
  else if (feedback.fit_off >= 2) headline = "The shape of this work feels off — needs reframing.";
  else if (trend === "rising" && pct > 0) headline = `Compounding — ${velocity_7d} done this week, up from ${velocity_prev_7d}.`;
  else if (trend === "falling") headline = `Cooling — ${velocity_7d} this week vs ${velocity_prev_7d} last.`;
  else if (ws.status === "stalled") headline = "Stalled — needs a smaller next step.";
  else if (pct >= 80) headline = "Most moves landed. Define the next horizon.";
  else if (pct > 0) headline = `${done.length} of ${tasks.length} tasks done.`;

  return {
    workstream: ws, tasks: { total: tasks.length, done: done.length, in_progress, pending, pct },
    velocity_7d, velocity_prev_7d, trend, linkedSignals, signalScore, feedback,
    reflectionMentions, health, headline,
  };
}

export interface MissionAnalytics {
  perWorkstream: WorkstreamAnalytics[];
  overallHealth: number;
  totalTasks: number;
  totalDone: number;
  velocity_7d: number;
  needsAttention: WorkstreamAnalytics[];
  rising: WorkstreamAnalytics[];
}

export function analyzeMission(state: MomentState): MissionAnalytics {
  const wss = state.pursuit_model?.workstreams ?? [];
  const perWorkstream = wss.map((w) => analyzeWorkstream(state, w));

  const workstreamTotal = perWorkstream.reduce((s, a) => s + a.tasks.total, 0);
  const workstreamDone = perWorkstream.reduce((s, a) => s + a.tasks.done, 0);

  // Fall back to all non-skipped tasks in the last 60 days when workstream filter under-reports.
  const cutoff = Date.now() - 60 * 24 * 60 * 60 * 1000;
  const recentTasks = (state.tasks ?? []).filter((t) => {
    const created = t.created_at ? new Date(t.created_at).getTime() : Date.now();
    return created >= cutoff && t.status !== "skipped";
  });
  const recentDone = recentTasks.filter((t) => t.status === "done").length;

  const totalTasks = Math.max(workstreamTotal, recentTasks.length);
  const totalDone = Math.max(workstreamDone, recentDone);

  const velocity_7d = perWorkstream.reduce((s, a) => s + a.velocity_7d, 0);
  const overallHealth = perWorkstream.length === 0
    ? (totalTasks === 0 ? 0 : Math.round((totalDone / totalTasks) * 100))
    : Math.round(perWorkstream.reduce((s, a) => s + a.health, 0) / perWorkstream.length);

  const needsAttention = perWorkstream.filter((a) => a.health < 50).sort((a, b) => a.health - b.health);
  const rising = perWorkstream.filter((a) => a.trend === "rising");
  return { perWorkstream, overallHealth, totalTasks, totalDone, velocity_7d, needsAttention, rising };
}
