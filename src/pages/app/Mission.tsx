import { Mote } from "@/components/app/Mote";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Target, TrendingUp, TrendingDown, Activity,
  Sparkles, Flag, ArrowUpRight, ArrowDownRight, Minus, Zap,
  ChevronDown, PlusCircle, BookOpen, Layers, CheckCircle2,
  Circle, BarChart2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStateStore } from "@/stores/state-store";
import { selectMissionViewModel } from "@/lib/selectors/mission";
import { analyzeMission, type WorkstreamAnalytics } from "@/lib/selectors/mission-analytics";
import { MissionConstellation } from "@/components/app/MissionConstellation";
import { StreakFlame } from "@/components/app/StreakFlame";
import type { CapabilityCluster, EvidenceSignal, PursuitRisk, PursuitStandard, PursuitWorkstream, Task } from "@/lib/types";
import { FeedbackChips } from "@/components/app/FeedbackChips";
import { PatternBanner } from "@/components/app/PatternBanner";
import { AIInsight } from "@/components/app/AIInsight";
import { useAI } from "@/lib/ai/useAI";
import { FEEDBACK_LABELS } from "@/lib/feedback/labels";
import { buildLearningPortfolio } from "@/lib/ai/learning-portfolio";
import { Award, Lightbulb, Trophy } from "lucide-react";

/* ─── Stage normalisation ──────────────────────────────────────────────────── */

const STAGE_MAP: Array<[RegExp, string]> = [
  [/found|beginn|basic|start|minim/i, "Foundation"],
  [/early.?expo|intro|orient|discov/i, "Early Exposure"],
  [/skill.?build|develop|practi|intermed/i, "Skill Building"],
  [/proof.?build|evidence|produc|demonstr/i, "Proof Building"],
  [/advanc|final|polish|near|almost/i, "Advanced Preparation"],
];

function readableStage(raw: string): string | null {
  if (!raw || !raw.trim()) return null;
  for (const [re, label] of STAGE_MAP) if (re.test(raw)) return label;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

const STAGE_BRIEF: Record<string, { description: string; focus: string }> = {
  "Foundation": {
    description: "Your job right now is not to act like an expert — it is to keep this path open. That means confirming prerequisites, building basic literacy in the domain, and proving to yourself that you can stick with it.",
    focus: "Confirm prerequisites, build foundational knowledge, and establish one repeatable study rhythm.",
  },
  "Early Exposure": {
    description: "You are starting to test whether this path is real for you. Get genuine exposure, log what you find, and begin forming a picture of what this pursuit actually requires.",
    focus: "Explore the domain, gather first-hand evidence, and identify the gaps you need to close.",
  },
  "Skill Building": {
    description: "The path is confirmed. Now you need to close the capability gap. Deliberate practice on the skills your goal actually requires — not just accumulating hours.",
    focus: "Target your weakest skill, practice it deliberately, and produce proof of improvement.",
  },
  "Proof Building": {
    description: "You have skills. Now you need to make them visible. The goal is concrete artefacts — results, outputs, and records that others can see and verify.",
    focus: "Produce tangible outputs: essays, results, projects, credentials, or documented evidence.",
  },
  "Advanced Preparation": {
    description: "Final stretch. Every move should close the gap between where you are and the target outcome. No more exploration — execution at full intensity.",
    focus: "Sharpen the critical edges, practise at full difficulty, and protect your energy reserves.",
  },
};

/* ─── Colour helpers ───────────────────────────────────────────────────────── */

const healthColor = (h: number) =>
  h >= 70 ? "text-emerald-400" : h >= 45 ? "text-amber-300" : "text-red-400";
const healthBarColor = (h: number) =>
  h >= 70 ? "bg-emerald-500" : h >= 45 ? "bg-amber-400" : "bg-red-400";
const trendIcon = (t: WorkstreamAnalytics["trend"]) =>
  t === "rising" ? ArrowUpRight : t === "falling" ? ArrowDownRight : Minus;

const riskBorder: Record<PursuitRisk["severity"], string> = {
  critical: "border-red-500/40",
  high:     "border-amber-500/40",
  medium:   "border-border",
  low:      "border-border",
};
const riskBg: Record<PursuitRisk["severity"], string> = {
  critical: "bg-red-500/5",
  high:     "bg-amber-500/5",
  medium:   "bg-card",
  low:      "bg-card",
};
const riskTextColor: Record<PursuitRisk["severity"], string> = {
  critical: "text-red-300",
  high:     "text-amber-300",
  medium:   "text-foreground",
  low:      "text-muted-foreground",
};

const stdIcons: Record<PursuitStandard["trajectory"], typeof TrendingUp> = {
  ahead: TrendingUp, on_track: Activity, at_risk: AlertTriangle, below: TrendingDown,
};
const stdColors: Record<PursuitStandard["trajectory"], string> = {
  ahead: "text-emerald-400", on_track: "text-primary", at_risk: "text-amber-300", below: "text-red-400",
};
const ccProgress: Record<CapabilityCluster["status"], number> = {
  not_started: 5, emerging: 25, developing: 50, solid: 78, mastered: 100,
};

/* ─── Section label ────────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
      {children}
    </div>
  );
}

/* ─── Next Proof card ──────────────────────────────────────────────────────── */

function NextProofCard({
  proof, workstream, onStart, onAddToTasks, hasGoal,
}: {
  proof: string;
  workstream: PursuitWorkstream | null;
  onStart: () => void;
  onAddToTasks: () => void;
  hasGoal: boolean;
}) {
  if (!proof) {
    return (
      <section className="rounded-2xl border border-dashed border-border bg-card p-6 space-y-3">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <Target className="h-3.5 w-3.5" /> next proof
        </div>
        <p className="text-base font-medium text-muted-foreground">
          {hasGoal ? "No next proof queued." : "Set a goal in Chat to generate your first proof."}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onAddToTasks}
            className="rounded-lg border border-border bg-background/60 px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Open Tasks
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/30 via-card to-card p-6 space-y-4">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-500/8 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-400/70">
          <Target className="h-3.5 w-3.5" /> next proof
        </div>
        <p className="mt-3 text-xl font-semibold leading-snug text-foreground">{proof}</p>
        {workstream && (
          <p className="mt-1 text-sm text-muted-foreground">
            From: <span className="text-foreground">{workstream.name}</span>
          </p>
        )}
      </div>

      {workstream?.bottleneck && (
        <div className="relative rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2.5 flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />
          <div>
            <span className="text-[10px] uppercase tracking-wider text-amber-400/60 font-mono">current bottleneck</span>
            <p className="mt-0.5 text-sm text-amber-200">{workstream.bottleneck}</p>
          </div>
        </div>
      )}

      <div className="relative flex flex-wrap gap-2">
        <button
          onClick={onStart}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500"
        >
          Start this proof
        </button>
        <button
          onClick={onAddToTasks}
          className="rounded-lg border border-border bg-background/60 px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
        >
          Open Tasks
        </button>
      </div>
    </section>
  );
}

/* ─── What matters now card ────────────────────────────────────────────────── */

function MattersCard({
  a, allTasks, onCreateTask,
}: {
  a: WorkstreamAnalytics;
  allTasks: Task[];
  onCreateTask: (wsId: string, proof: string) => void;
}) {
  const ws = a.workstream;
  const Trend = trendIcon(a.trend);
  const doneThisWs = allTasks.filter((t) => t.workstream_id === ws.id && t.status === "done").length;
  const realNextProof = ws.next_proof?.trim() || "";
  const realBottleneck = ws.bottleneck?.trim() || "";
  const evidenceText = doneThisWs > 0
    ? `${doneThisWs} completed proof task${doneThisWs === 1 ? "" : "s"}.`
    : "No completed proof tasks yet.";

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="text-sm font-semibold">{ws.name}</div>
          {ws.description && <p className="text-[12px] text-muted-foreground leading-relaxed">{ws.description}</p>}
        </div>
        <span className={`flex shrink-0 items-center gap-1 font-mono text-[10px] ${healthColor(a.health)}`}>
          <Trend className="h-3 w-3" /> {a.health}
        </span>
      </div>

      {realBottleneck && (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-500/20 bg-amber-500/5 px-2.5 py-2 text-[12px] text-amber-300">
          <AlertTriangle className="mt-px h-3 w-3 shrink-0" />
          {realBottleneck}
        </div>
      )}

      <div className="space-y-1 text-[11px] text-muted-foreground">
        <div><span className="text-foreground/60">Signal:</span> {evidenceText}</div>
      </div>

      {realNextProof ? (
        <>
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 space-y-1">
            <div className="text-[10px] uppercase tracking-wider text-primary/50 font-mono">next action</div>
            <p className="text-[13px] text-foreground">{realNextProof}</p>
          </div>
          <button
            onClick={() => onCreateTask(ws.id, realNextProof)}
            className="flex w-fit items-center gap-1.5 rounded-md border border-border bg-background/60 px-3 py-1.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary"
          >
            <PlusCircle className="h-3 w-3" /> Create task
          </button>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-background/30 px-3 py-2 text-[12px] text-muted-foreground">
          No next proof defined for this lane yet. Talk to Moment in Chat to name one.
        </div>
      )}
    </div>
  );
}

/* ─── Signal pill ──────────────────────────────────────────────────────────── */

function SignalPill({ value, label, tone }: { value: string | number; label: string; tone?: "good" | "warn" | "bad" | "neutral" }) {
  const dotColor = tone === "good" ? "bg-emerald-400" : tone === "warn" ? "bg-amber-400" : tone === "bad" ? "bg-red-400" : "bg-muted-foreground/40";
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dotColor}`} />
      <span className="text-xs font-medium text-foreground">{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

function GoalHorizonCard({ label, value, emphasis = false }: { label: string; value: string; emphasis?: boolean }) {
  if (!value.trim()) return null;
  return (
    <div className={`rounded-xl border p-4 ${emphasis ? "border-primary/30 bg-primary/8" : "border-border/60 bg-background/35"}`}>
      <div className={`font-mono text-[10px] uppercase tracking-[0.18em] ${emphasis ? "text-primary/70" : "text-muted-foreground"}`}>
        {label}
      </div>
      <p className="mt-2 text-sm font-medium leading-snug text-foreground">{value}</p>
    </div>
  );
}

/* ─── Main page ────────────────────────────────────────────────────────────── */

const Mission = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const navigate = useNavigate();
  const [openWs, setOpenWs] = useState<string | null>(null);
  const insight = useAI<{
    observation: string;
    suggestion?: string;
    notices?: Array<{
      kind: "momentum" | "bottleneck" | "drift" | "imbalance" | "feedback_pattern" | "stage_progress" | "blind_spot" | "risk" | "celebrate";
      tone: "good" | "warn" | "bad" | "neutral";
      title: string;
      detail: string;
      next_step?: string;
    }>;
  }>("mission_insight");

  const m = useMemo(() => (state ? selectMissionViewModel(state) : null), [state]);
  const analytics = useMemo(() => (state ? analyzeMission(state) : null), [state]);

  /* Daily snapshot — only when we have real data to snapshot */
  const snapshotDateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!state || !analytics || analytics.perWorkstream.length === 0) return;
    if (analytics.totalTasks === 0) return; // don't pollute history with zero-state snapshots
    const today = new Date().toISOString().slice(0, 10);
    const history = ((state as Record<string, unknown>).mission_history ?? []) as Array<{ date: string }>;
    if (history.slice(-1)[0]?.date === today || snapshotDateRef.current === today) return;
    snapshotDateRef.current = today;
    dispatch({
      type: "mission/snapshot",
      payload: {
        date: today,
        taken_at: new Date().toISOString(),
        overall_health: analytics.overallHealth,
        total_tasks: analytics.totalTasks,
        total_done: analytics.totalDone,
        velocity_7d: analytics.velocity_7d,
        workstreams: analytics.perWorkstream.map((a) => ({
          id: a.workstream.id, name: a.workstream.name, status: a.workstream.status,
          health: a.health, pct: a.tasks.pct, velocity_7d: a.velocity_7d, trend: a.trend,
          headline: a.headline, feedback_top: a.feedback.topLabels,
        })),
      },
    });
  }, [state, analytics, dispatch]);

  const missionHistory = useMemo(
    () => ((state as Record<string, unknown>)?.mission_history ?? []) as Array<{ date: string; overall_health: number }>,
    [state],
  );

  const topRisk = useMemo(() => {
    if (!m) return null;
    const sev = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    return [...m.risks].sort((a, b) => sev[a.severity] - sev[b.severity])[0] ?? null;
  }, [m]);

  const priorityWS = useMemo(
    () => (analytics ? [...analytics.perWorkstream].sort((a, b) => a.health - b.health) : []),
    [analytics],
  );

  /* Create task helper */
  const createTaskFromProof = (workstreamId: string, proof: string) => {
    if (!state) return;
    dispatch({
      type: "task/add",
      payload: {
        id: crypto.randomUUID(),
        title: proof.length > 80 ? `${proof.slice(0, 78)}…` : proof,
        description: "",
        status: "pending",
        priority: "high",
        goal_id: state.active_goal?.id ?? "",
        domain_id: "",
        workstream_id: workstreamId,
        estimated_minutes: 30,
        category: "goal_direct",
        created_at: new Date().toISOString(),
        completed_at: "",
        due_date: "",
        created_by: "ai",
        why_now: "Surfaced from Mission — this is the next proof for your workstream.",
        proof_of_completion: proof,
      } as Task,
    });
    navigate("/app/tasks");
  };

  if (!state || !m)
    return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;

  if (!m.hasModel) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 py-4">
        <section className="rounded-2xl border border-border bg-card p-8">
          <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">/ mission</div>
          <h1 className="mt-3 text-2xl font-semibold">No goal mapped yet.</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-prose leading-relaxed">
            Tell Moment what you're chasing in Chat. The system will map it into workstreams, proofs,
            and a command model — so Mission becomes the clearest page in the app.
          </p>
          <button
            onClick={() => navigate("/app/chat")}
            className="mt-5 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Set goal in Chat →
          </button>
        </section>
      </div>
    );
  }

  const name = state.profile?.display_name?.trim();
  const goalStatement = m.goal.statement;
  const goalHorizons = [m.goal.shortTerm, m.goal.mediumTerm, m.goal.longTerm].filter((g) => g.trim());
  const rawStage = state.active_goal?.current_stage ?? "";
  const stage = readableStage(rawStage);
  const stageBrief = stage ? STAGE_BRIEF[stage] ?? null : null;

  /* Top workstream by priority */
  const sev: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const topProofWs = [...m.workstreams]
    .filter((w) => w.next_proof?.trim())
    .sort((a, b) => (sev[a.priority] ?? 4) - (sev[b.priority] ?? 4))[0] ?? null;
  const nextProof = topProofWs?.next_proof ?? "";

  /* State signals for evidence section */
  const allTasks = state.tasks ?? [];
  const doneTasks = allTasks.filter((t) => t.status === "done");
  const forgeSignals = (state.forge_state?.forge_signals ?? []) as Array<Record<string, string>>;
  const recentReflections = [...(state.reflections ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
  const hasAnyEvidence = doneTasks.length > 0 || forgeSignals.length > 0 || recentReflections.length > 0;
  const portfolio = buildLearningPortfolio(state);
  const wsNameById = new Map((m.workstreams ?? []).map((w) => [w.id, w.name]));

  /* Trend delta vs yesterday */
  const trendDelta = missionHistory.length >= 2 && analytics
    ? analytics.overallHealth - (missionHistory[missionHistory.length - 2]?.overall_health ?? analytics.overallHealth)
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-10 py-2">

      {/* ── 1. MISSION BRIEF HERO ────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-7 md:p-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/8 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full bg-accent/8 blur-3xl" />

        <div className="relative space-y-6">
          {/* Identity */}
          <div>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                <Flag className="h-3.5 w-3.5" /> mission brief
              </div>
              <StreakFlame tasks={allTasks} />
            </div>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight md:text-4xl">
              {name ? `${name}'s path` : "Your path"}
            </h1>
            {goalStatement && (
              <p className="mt-1.5 text-lg text-muted-foreground leading-snug">{goalStatement}</p>
            )}
            {goalHorizons.length > 0 && (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <GoalHorizonCard label="Short-term · next proof" value={m.goal.shortTerm} emphasis />
                <GoalHorizonCard label="Medium-term · milestone" value={m.goal.mediumTerm} />
                <GoalHorizonCard label="Long-term · anchor" value={m.goal.longTerm} />
              </div>
            )}
            {stage && (
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-3.5 py-1 text-sm font-medium text-primary">
                <Layers className="h-3.5 w-3.5" />
                {stage} stage
              </div>
            )}
          </div>

          {/* Stage explanation — only render when we actually know the stage */}
          {stageBrief && (
            <div className="rounded-xl border border-border/60 bg-background/30 p-5 space-y-2.5">
              <p className="text-[15px] leading-relaxed text-muted-foreground">{stageBrief.description}</p>
              <div className="flex items-start gap-2 pt-1">
                <BookOpen className="mt-0.5 h-4 w-4 shrink-0 text-primary/60" />
                <p className="text-sm text-foreground font-medium">{stageBrief.focus}</p>
              </div>
            </div>
          )}

          {/* Action row */}
          {nextProof && (
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => topProofWs && createTaskFromProof(topProofWs.id, nextProof)}
                className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
              >
                Start next proof
              </button>
              <button onClick={() => navigate("/app/tasks")} className="rounded-lg border border-border bg-background/50 px-4 py-2.5 text-sm text-foreground hover:bg-secondary/60">
                Open Tasks
              </button>
              <button onClick={() => navigate("/app/plan")} className="rounded-lg border border-border bg-background/50 px-4 py-2.5 text-sm text-foreground hover:bg-secondary/60">
                Open Plan
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── 2. NEXT PROOF (dominant card) ────────────────────────────────────── */}
      <NextProofCard
        proof={nextProof}
        workstream={topProofWs}
        hasGoal={Boolean(goalStatement)}
        onStart={() => topProofWs && createTaskFromProof(topProofWs.id, nextProof)}
        onAddToTasks={() => navigate("/app/tasks")}
      />

      {/* ── 3. INTERPRETED SIGNALS STRIP ─────────────────────────────────────── */}
      {analytics && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Path health */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Path health</div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${healthColor(analytics.overallHealth)}`}>
                {analytics.overallHealth}
              </span>
              {trendDelta !== null && (
                <span className={`font-mono text-xs ${trendDelta > 0 ? "text-emerald-400" : trendDelta < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                  {trendDelta > 0 ? "+" : ""}{trendDelta} vs last
                </span>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className={`h-full rounded-full ${healthBarColor(analytics.overallHealth)}`} style={{ width: `${analytics.overallHealth}%` }} />
            </div>
            <p className="text-[12px] text-muted-foreground leading-snug">
              {analytics.overallHealth >= 70 ? "Strong momentum — keep compounding." : analytics.overallHealth >= 45 ? "Some workstreams need attention this week." : "Several areas are stalling — one proof today restarts momentum."}
            </p>
          </div>

          {/* Proofs this week */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Proofs this week</div>
            <div className={`text-3xl font-bold ${analytics.velocity_7d === 0 ? "text-muted-foreground" : "text-foreground"}`}>
              {analytics.velocity_7d}
            </div>
            <p className="text-[12px] text-muted-foreground leading-snug">
              {analytics.velocity_7d === 0 ? "No proof completed yet this week. One small proof today starts the signal." : analytics.velocity_7d >= 3 ? `${analytics.velocity_7d} proofs completed — good compounding.` : `${analytics.velocity_7d} proof${analytics.velocity_7d === 1 ? "" : "s"} completed. Keep building.`}
            </p>
            {analytics.velocity_7d === 0 && (
              <button onClick={() => navigate("/app/tasks")} className="text-[11px] text-primary hover:underline">Open Tasks →</button>
            )}
          </div>

          {/* Bottleneck */}
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-wider text-amber-400/60">Current bottleneck</div>
            <div className="text-sm font-semibold text-amber-200 leading-snug">
              {topProofWs?.bottleneck || topRisk?.name || "None identified yet"}
            </div>
            <p className="text-[12px] text-amber-300/60 leading-snug">
              {topProofWs?.bottleneck ? "Your top priority workstream has a specific blocker." : topRisk ? "Your highest-severity risk may be creating drag." : "Complete a few proofs and Moment will surface your bottleneck."}
            </p>
          </div>

          {/* Top risk */}
          <div className={`rounded-xl border p-4 space-y-2 ${topRisk ? `${riskBorder[topRisk.severity]} ${riskBg[topRisk.severity]}` : "border-border bg-card"}`}>
            <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Top risk</div>
            <div className={`text-sm font-semibold leading-snug ${topRisk ? riskTextColor[topRisk.severity] : "text-muted-foreground"}`}>
              {topRisk?.name ?? "No risks logged"}
            </div>
            <p className="text-[12px] text-muted-foreground leading-snug">
              {topRisk?.mitigation ? `→ ${topRisk.mitigation}` : topRisk ? `Severity: ${topRisk.severity}.` : "Keep logging proofs and risks will surface from patterns."}
            </p>
          </div>
        </div>
      )}

      <PatternBanner />

      {/* ── PORTFOLIO · concrete evidence of progress ──────────────────────── */}
      {(portfolio.lifetime_stats.tasks_completed > 0 ||
        portfolio.mini_lessons_learned.length > 0 ||
        portfolio.milestones.length > 0) && (
        <section>
          <SectionLabel>Your portfolio · concrete evidence</SectionLabel>

          {/* Lifetime stats strip */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 mb-4">
            {[
              { label: "active days", value: portfolio.lifetime_stats.days_active },
              { label: "proofs done", value: portfolio.lifetime_stats.tasks_completed },
              { label: "notes written", value: portfolio.lifetime_stats.notes_written },
              { label: "reflections", value: portfolio.lifetime_stats.reflections_logged },
              { label: "lessons banked", value: portfolio.mini_lessons_learned.length },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</div>
                <div className="mt-1 text-2xl font-bold text-foreground">{s.value}</div>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Recently completed proofs */}
            {portfolio.completed_work.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <Trophy className="h-3.5 w-3.5 text-emerald-400/70" /> proofs delivered
                </div>
                <ul className="space-y-2.5">
                  {portfolio.completed_work.slice(0, 6).map((c, i) => (
                    <li key={i} className="flex items-start gap-2.5 border-l-2 border-emerald-500/30 pl-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-foreground leading-snug">{c.title}</div>
                        {c.proof && (
                          <div className="mt-0.5 text-[11px] text-emerald-300/80 leading-snug">→ {c.proof}</div>
                        )}
                        <div className="mt-0.5 flex items-center gap-2 text-[10px] text-muted-foreground">
                          {c.completed_at && <span>{new Date(c.completed_at).toLocaleDateString()}</span>}
                          {c.workstream && wsNameById.get(c.workstream) && (
                            <span>· {wsNameById.get(c.workstream)}</span>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                {portfolio.completed_work.length > 6 && (
                  <button onClick={() => navigate("/app/tasks")} className="text-[11px] text-primary hover:underline">
                    + {portfolio.completed_work.length - 6} more →
                  </button>
                )}
              </div>
            )}

            {/* Mini-lessons banked + milestones */}
            <div className="space-y-4">
              {portfolio.mini_lessons_learned.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Lightbulb className="h-3.5 w-3.5 text-amber-300/80" /> lessons banked
                  </div>
                  <ul className="space-y-3">
                    {portfolio.mini_lessons_learned.slice(0, 4).map((l, i) => (
                      <li key={i} className="border-l-2 border-amber-400/30 pl-3">
                        <div className="text-[13px] font-medium text-foreground">{l.title}</div>
                        <p className="mt-0.5 text-[11px] text-muted-foreground leading-snug line-clamp-2">{l.body}</p>
                        <div className="mt-0.5 text-[10px] text-muted-foreground/70">from "{l.from_task}"</div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {portfolio.milestones.length > 0 && (
                <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
                  <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <Award className="h-3.5 w-3.5 text-primary/80" /> milestones
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {portfolio.milestones.map((mi, i) => (
                      <span key={i} className="rounded-full border border-primary/20 bg-primary/5 px-2.5 py-1 text-[11px] text-primary">
                        {mi.replace(/_/g, " ")}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* ── 4. WHAT MATTERS NOW ──────────────────────────────────────────────── */}
      {analytics && analytics.needsAttention.length > 0 && (
        <section>
          <SectionLabel>What matters now</SectionLabel>
          <div className="grid gap-4 md:grid-cols-2">
            {analytics.needsAttention.slice(0, 4).map((a) => (
              <MattersCard key={a.workstream.id} a={a} allTasks={allTasks} onCreateTask={createTaskFromProof} />
            ))}
          </div>
        </section>
      )}

      {/* ── 5. MOMENT NOTICES ────────────────────────────────────────────────── */}
      <AIInsight
        label="moment notices"
        loading={insight.loading}
        error={insight.error}
        onRun={() =>
          insight.run({
            pursuit: state.pursuit_model,
            analytics: analytics?.perWorkstream.map((a) => ({
              name: a.workstream.name, health: a.health, trend: a.trend,
              velocity_7d: a.velocity_7d, headline: a.headline, feedback_top: a.feedback.topLabels,
            })),
            history: missionHistory.slice(-7),
          })
        }
        cta={insight.result ? "Re-read" : "Read mission"}
      >
        {insight.result && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <p className="text-sm">{insight.result.observation}</p>
              {insight.result.suggestion && <p className="text-xs text-muted-foreground">→ {insight.result.suggestion}</p>}
            </div>
            {insight.result.notices && insight.result.notices.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {insight.result.notices.map((n, i) => {
                  const dot = n.tone === "good" ? "bg-emerald-400"
                    : n.tone === "warn" ? "bg-amber-400"
                    : n.tone === "bad" ? "bg-red-400"
                    : "bg-muted-foreground/50";
                  return (
                    <div key={i} className="rounded-lg border border-border bg-background/40 p-3">
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
                        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{n.kind.replace(/_/g, " ")}</span>
                      </div>
                      <p className="mt-1.5 text-sm font-medium text-foreground">{n.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{n.detail}</p>
                      {n.next_step && <p className="mt-1.5 text-xs text-foreground/80">→ {n.next_step}</p>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </AIInsight>

      {/* ── 6. CONSTELLATION + WORKSTREAMS ───────────────────────────────────── */}
      {state.pursuit_model && analytics && (
        <section>
          <SectionLabel>Operating lanes</SectionLabel>
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Constellation */}
            <div className="lg:col-span-3">
              <MissionConstellation
                model={state.pursuit_model}
                analytics={analytics.perWorkstream}
                onWorkstreamClick={(id) => setOpenWs((o) => (o === id ? null : id))}
              />
              {/* Constellation detail panel */}
              {openWs && (() => {
                const ws = m.workstreams.find((w) => w.id === openWs);
                const a = analytics.perWorkstream.find((x) => x.workstream.id === openWs);
                if (!ws) return null;
                const wsDone = allTasks.filter((t) => t.workstream_id === ws.id && t.status === "done");
                return (
                  <div className="mt-3 rounded-xl border border-primary/20 bg-card p-5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-semibold">{ws.name}</div>
                        {ws.description && <p className="mt-0.5 text-[12px] text-muted-foreground">{ws.description}</p>}
                      </div>
                      <button onClick={() => setOpenWs(null)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1">×</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "health", value: a?.health ?? "—", color: healthColor(a?.health ?? 0) },
                        { label: "tasks done", value: `${a?.tasks.done ?? 0}/${a?.tasks.total ?? 0}` },
                        { label: "this week", value: a?.velocity_7d ?? 0 },
                      ].map((c) => (
                        <div key={c.label} className="rounded-lg border border-border bg-background/60 p-2 text-center">
                          <div className="font-mono text-[9px] uppercase text-muted-foreground">{c.label}</div>
                          <div className={`mt-0.5 font-mono text-sm font-medium ${c.color ?? ""}`}>{String(c.value)}</div>
                        </div>
                      ))}
                    </div>
                    {ws.bottleneck && (
                      <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[12px] text-amber-300">
                        ⚠ {ws.bottleneck}
                      </div>
                    )}
                    {ws.next_proof && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] uppercase font-mono text-muted-foreground">next proof</div>
                        <p className="text-[13px] text-emerald-300 leading-snug">{ws.next_proof}</p>
                        <button
                          onClick={() => createTaskFromProof(ws.id, ws.next_proof)}
                          className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                        >
                          <PlusCircle className="h-3 w-3" /> Create task
                        </button>
                      </div>
                    )}
                    {wsDone.length > 0 && (
                      <div>
                        <div className="mb-1 text-[10px] uppercase font-mono text-muted-foreground">evidence logged</div>
                        {wsDone.slice(0, 3).map((t) => (
                          <div key={t.id} className="flex items-start gap-1.5 text-[11px] text-muted-foreground py-0.5">
                            <Zap className="mt-px h-3 w-3 shrink-0 text-primary/50" />
                            {t.proof_of_completion || t.title}
                          </div>
                        ))}
                        {wsDone.length === 0 && (
                          <p className="text-[11px] text-muted-foreground">No evidence yet. Complete one proof task to start.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Workstream operating lanes */}
            <div className="lg:col-span-2 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-muted-foreground">workstreams · {priorityWS.length}</span>
              </div>
              <ul className="overflow-hidden rounded-2xl border border-border bg-card divide-y divide-border">
                {priorityWS.map((a) => {
                  const ws = a.workstream;
                  const isOpen = openWs === ws.id;
                  const Trend = trendIcon(a.trend);
                  const wsDone = allTasks.filter((t) => t.workstream_id === ws.id && t.status === "done").length;
                  return (
                    <li key={ws.id}>
                      <button
                        onClick={() => setOpenWs(isOpen ? null : ws.id)}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-secondary/30 transition-colors"
                      >
                        <div className="flex w-10 shrink-0 flex-col items-center">
                          <span className={`font-mono text-sm font-bold ${healthColor(a.health)}`}>{a.health}</span>
                          <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground/60">health</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{ws.name}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground flex items-center gap-1.5">
                            <Trend className="h-3 w-3" />
                            <span>{wsDone} proof{wsDone !== 1 ? "s" : ""} done</span>
                            {ws.status === "stalled" && <span className="text-amber-400">· stalled</span>}
                          </div>
                        </div>
                        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`} />
                      </button>

                      {isOpen && (
                        <div className="border-t border-border bg-background/40 px-4 py-3 space-y-2.5 text-sm">
                          {ws.description && <p className="text-[12px] text-muted-foreground">{ws.description}</p>}
                          {ws.bottleneck && (
                            <div className="text-[12px] text-amber-300">⚠ {ws.bottleneck}</div>
                          )}
                          {ws.next_proof ? (
                            <div className="space-y-1.5">
                              <div className="text-[10px] uppercase font-mono text-muted-foreground">next proof</div>
                              <p className="text-[12px] text-emerald-300">{ws.next_proof}</p>
                              <button
                                onClick={() => createTaskFromProof(ws.id, ws.next_proof)}
                                className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                              >
                                <PlusCircle className="h-3 w-3" /> Create task
                              </button>
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">
                              No next proof defined for this lane yet — name one in Chat.
                            </p>
                          )}
                          {a.feedback.total > 0 && (
                            <div className="text-[11px] text-muted-foreground">
                              Signals: {a.feedback.topLabels.map((l) => FEEDBACK_LABELS[l as keyof typeof FEEDBACK_LABELS] ?? l).join(" · ")}
                            </div>
                          )}
                          <FeedbackChips
                            source="mission"
                            targetId={ws.id}
                            taskTitle={ws.name}
                            groups={["fit", "value", "tone"]}
                            prompt="How does this workstream feel?"
                          />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ── 7. STANDARDS ─────────────────────────────────────────────────────── */}
      {m.standards.length > 0 && (
        <section>
          <SectionLabel>Standards</SectionLabel>
          <div className="grid gap-4 md:grid-cols-2">
            {m.standards.map((s) => {
              const Icon = stdIcons[s.trajectory];
              const hasEvidence = s.current_value?.trim();
              return (
                <div key={s.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-semibold">{s.name}</div>
                    <span className={`inline-flex shrink-0 items-center gap-1 text-[11px] font-medium ${stdColors[s.trajectory]}`}>
                      <Icon className="h-3 w-3" />
                      {s.trajectory.replace("_", " ")}
                    </span>
                  </div>
                  {s.description && <p className="text-[13px] text-muted-foreground leading-relaxed">{s.description}</p>}
                  <div className="rounded-lg bg-secondary/50 px-3 py-2 space-y-0.5">
                    <div className="text-[10px] uppercase font-mono text-muted-foreground">evidence</div>
                    <p className="text-[12px] text-foreground">
                      {hasEvidence ? s.current_value : "No evidence logged yet — complete a proof task that satisfies this standard."}
                    </p>
                    {s.target_value && <p className="text-[11px] text-muted-foreground">Target: {s.target_value}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── 8. RISKS → INTERVENTIONS ─────────────────────────────────────────── */}
      {m.risks.length > 0 && (
        <section>
          <SectionLabel>Risks · interventions</SectionLabel>
          <div className="space-y-3">
            {m.risks.map((r) => (
              <div key={r.id} className={`rounded-xl border p-5 space-y-3 ${riskBorder[r.severity]} ${riskBg[r.severity]}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className={`text-sm font-semibold ${riskTextColor[r.severity]}`}>{r.name}</div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">{r.severity}</span>
                </div>
                {r.description && <p className="text-[13px] text-muted-foreground leading-relaxed">{r.description}</p>}
                {r.mitigation ? (
                  <div className="rounded-xl border border-current/15 bg-background/30 px-4 py-3 space-y-2">
                    <div className="text-[10px] uppercase font-mono text-muted-foreground">intervention</div>
                    <p className="text-[13px] text-foreground">→ {r.mitigation}</p>
                    {(r.severity === "critical" || r.severity === "high") && (
                      <button
                        onClick={() => createTaskFromProof(m.workstreams[0]?.id ?? "", r.mitigation)}
                        className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/10"
                      >
                        <PlusCircle className="h-3 w-3" /> Create mitigation task
                      </button>
                    )}
                  </div>
                ) : (
                  <p className="text-[12px] text-muted-foreground">No intervention defined — describe one in Chat and Moment will record it.</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 9. EVIDENCE SIGNALS ──────────────────────────────────────────────── */}
      <section>
        <SectionLabel>Evidence trail</SectionLabel>
        {!hasAnyEvidence ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 space-y-4 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background">
              <BarChart2 className="h-5 w-5 text-muted-foreground/50" />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">No evidence yet.</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Evidence starts when you complete a proof task, save a Forge run, or submit a reflection.
                One proof today starts the trail.
              </p>
            </div>
            <div className="flex justify-center flex-wrap gap-2">
              <button onClick={() => navigate("/app/tasks")} className="rounded-lg border border-border bg-background/60 px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Open Tasks</button>
              <button onClick={() => navigate("/app/forge")} className="rounded-lg border border-border bg-background/60 px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Open Forge</button>
              <button onClick={() => navigate("/app/reflect")} className="rounded-lg border border-border bg-background/60 px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Reflect</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Pursuit model signals */}
            {m.evidenceSignals.length > 0 && (
              <ul className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
                {m.evidenceSignals.map((s: EvidenceSignal) => (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${s.kind === "leading" ? "bg-primary" : "bg-muted-foreground/50"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm">{s.name}</div>
                      {s.description && <div className="text-[11px] text-muted-foreground">{s.description}</div>}
                    </div>
                    <span className="font-mono text-[10px] uppercase text-muted-foreground shrink-0">{s.kind}</span>
                    <span className="font-mono text-xs shrink-0">{s.last_value || "—"}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Completed tasks */}
            {doneTasks.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] text-muted-foreground">{doneTasks.length} task{doneTasks.length !== 1 ? "s" : ""} completed</div>
                <div className="space-y-1">
                  {doneTasks.slice(0, 6).map((t) => (
                    <div key={t.id} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                      <CheckCircle2 className="mt-px h-3 w-3 shrink-0 text-emerald-500/60" />
                      {t.proof_of_completion || t.title}
                    </div>
                  ))}
                  {doneTasks.length > 6 && (
                    <button onClick={() => navigate("/app/tasks")} className="ml-5 text-[11px] text-primary hover:underline">
                      + {doneTasks.length - 6} more →
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Forge signals */}
            {forgeSignals.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] text-muted-foreground">{forgeSignals.length} Forge signal{forgeSignals.length !== 1 ? "s" : ""}</div>
                <div className="space-y-1">
                  {forgeSignals.slice(0, 4).map((s, i) => (
                    <div key={i} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                      <Zap className="mt-px h-3 w-3 shrink-0 text-primary/50" />
                      {s.content || s.signal || `Forge signal ${i + 1}`}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reflections */}
            {recentReflections.length > 0 && (
              <div>
                <div className="mb-2 text-[11px] text-muted-foreground">{recentReflections.length} recent reflection{recentReflections.length !== 1 ? "s" : ""}</div>
                <div className="space-y-1">
                  {recentReflections.map((r) => (
                    <div key={r.date} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                      <Circle className="mt-px h-3 w-3 shrink-0 text-muted-foreground/40" />
                      {r.date}: {r.accomplishment || r.win || "Reflection logged"}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

    </div>
  );
};

export default Mission;
