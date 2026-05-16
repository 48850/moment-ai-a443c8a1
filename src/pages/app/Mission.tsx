import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, Target, TrendingUp, TrendingDown, Activity,
  Sparkles, Flag, ArrowUpRight, ArrowDownRight, Minus, Zap,
  ChevronDown, ChevronRight, PlusCircle, BookOpen, Layers,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useStateStore } from "@/stores/state-store";
import { selectMissionViewModel } from "@/lib/selectors/mission";
import { analyzeMission, type WorkstreamAnalytics } from "@/lib/selectors/mission-analytics";
import { MissionConstellation } from "@/components/app/MissionConstellation";
import type { CapabilityCluster, EvidenceSignal, PursuitRisk, PursuitStandard, PursuitWorkstream, Task } from "@/lib/types";
import { FeedbackChips } from "@/components/app/FeedbackChips";
import { PatternBanner } from "@/components/app/PatternBanner";
import { AIInsight } from "@/components/app/AIInsight";
import { useAI } from "@/lib/ai/useAI";
import { FEEDBACK_LABELS } from "@/lib/feedback/labels";

/* ─── Stage normalisation ────────────────────────────────────────────────── */

const STAGE_LABEL_MAP: Array<[RegExp, string]> = [
  [/found|beginn|basic|start|minim/i, "Foundation"],
  [/early.?expo|intro|orient|discov/i, "Early Exposure"],
  [/skill.?build|develop|practi|intermed/i, "Skill Building"],
  [/proof.?build|evidence|produc|demonstr/i, "Proof Building"],
  [/advanc|final|polish|near|almost/i, "Advanced Preparation"],
];

function readableStage(raw: string): string {
  if (!raw) return "Foundation";
  for (const [re, label] of STAGE_LABEL_MAP) {
    if (re.test(raw)) return label;
  }
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

const STAGE_META: Record<string, { description: string; focus: string }> = {
  "Foundation": {
    description:
      "Your job at this stage is not to act like an expert — it is to build the foundations that keep this path open: prerequisites, basic understanding, and proof you can stick with this.",
    focus: "Confirm prerequisites, build foundational literacy, and create your first repeatable study rhythm.",
  },
  "Early Exposure": {
    description:
      "You are starting to encounter the real territory. Your job is to test whether this path fits — not to optimise yet, but to get genuine exposure and log what you find.",
    focus: "Explore the domain, meet real examples, and start producing early evidence of engagement.",
  },
  "Skill Building": {
    description:
      "You have confirmed the path. Now the work is about capability — deliberately practising what your goal actually requires, and closing the gap between where you are and where you need to be.",
    focus: "Identify your weakest skill, drill it deliberately, and produce proof of improvement.",
  },
  "Proof Building": {
    description:
      "You have the skills. Now you need to make them visible. The goal is artefacts, credentials, and track records that others can see and verify.",
    focus: "Produce tangible outputs: essays, results, projects, certificates, or portfolio entries.",
  },
  "Advanced Preparation": {
    description:
      "You are in the final stretch. Every move should directly close the gap between your current state and the target outcome.",
    focus: "Sharpen the edges, run practice at full difficulty, and protect your energy for what counts.",
  },
};

/* ─── Colour helpers ─────────────────────────────────────────────────────── */

const riskTone: Record<PursuitRisk["severity"], string> = {
  critical: "border-red-500/40 bg-red-500/10 text-red-300",
  high:     "border-amber-500/40 bg-amber-500/10 text-amber-300",
  medium:   "border-border bg-secondary text-foreground",
  low:      "border-border bg-secondary/50 text-muted-foreground",
};

const stdTone: Record<PursuitStandard["trajectory"], { label: string; cls: string; icon: typeof TrendingUp }> = {
  ahead:    { label: "ahead",    cls: "text-emerald-400", icon: TrendingUp },
  on_track: { label: "on track", cls: "text-primary",     icon: Activity },
  at_risk:  { label: "at risk",  cls: "text-amber-300",   icon: AlertTriangle },
  below:    { label: "below",    cls: "text-red-400",     icon: TrendingDown },
};

const ccProgress: Record<CapabilityCluster["status"], number> = {
  not_started: 5, emerging: 25, developing: 50, solid: 78, mastered: 100,
};

const healthColor = (h: number) =>
  h >= 70 ? "text-emerald-400" : h >= 45 ? "text-amber-300" : "text-red-400";
const healthBar = (h: number) =>
  h >= 70 ? "bg-emerald-500" : h >= 45 ? "bg-amber-400" : "bg-red-400";
const trendIcon = (t: WorkstreamAnalytics["trend"]) =>
  t === "rising" ? ArrowUpRight : t === "falling" ? ArrowDownRight : Minus;

/* ─── Sub-components ─────────────────────────────────────────────────────── */

function MetricCard({
  label, value, explanation, tone = "default",
}: {
  label: string;
  value: string | number;
  explanation: string;
  tone?: "default" | "risk" | "success";
}) {
  const valueClass =
    tone === "risk" ? "text-amber-300" : tone === "success" ? "text-emerald-400" : "text-foreground";
  return (
    <div className={`rounded-xl border bg-background/50 p-3 ${tone === "risk" ? "border-amber-500/25 bg-amber-500/5" : "border-border"}`}>
      <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${valueClass}`}>{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground leading-snug">{explanation}</div>
    </div>
  );
}

function WorkstreamCard({
  ws, analytics, tasksForWs, isOpen, onToggle, onCreateTask,
}: {
  ws: PursuitWorkstream;
  analytics: WorkstreamAnalytics | undefined;
  tasksForWs: Task[];
  isOpen: boolean;
  onToggle: () => void;
  onCreateTask: (workstreamId: string, nextProof: string) => void;
}) {
  const Trend = analytics ? trendIcon(analytics.trend) : Minus;
  const h = analytics?.health ?? 30;
  const doneCount = analytics?.tasks.done ?? 0;
  const totalCount = analytics?.tasks.total ?? 0;

  const nextProof = ws.next_proof?.trim();
  const hasEvidence = doneCount > 0 || tasksForWs.some((t) => t.proof_of_completion?.trim());
  const evidenceItems = tasksForWs
    .filter((t) => t.status === "done" && t.proof_of_completion?.trim())
    .slice(0, 2);

  return (
    <li className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
      >
        <div className="flex w-10 shrink-0 flex-col items-center">
          <span className={`font-mono text-sm font-semibold ${healthColor(h)}`}>{h}</span>
          <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground">health</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{ws.name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-0.5"><Trend className="h-3 w-3" /></span>
            <span>{doneCount}/{totalCount} tasks done</span>
            {ws.status === "stalled" && (
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-px text-[9px] text-amber-300">stalled</span>
            )}
          </div>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`} />
      </button>

      {isOpen && (
        <div className="space-y-3 border-t border-border bg-background/40 px-4 py-3">
          {ws.description && (
            <p className="text-[12px] text-muted-foreground leading-relaxed">{ws.description}</p>
          )}

          {ws.bottleneck && (
            <div className="flex gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-400" />
              <div>
                <div className="text-[10px] uppercase tracking-wider text-amber-400/70 font-mono">bottleneck</div>
                <div className="mt-0.5 text-[12px] text-amber-300">{ws.bottleneck}</div>
              </div>
            </div>
          )}

          {nextProof ? (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">next proof</div>
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2">
                <p className="text-[12px] text-emerald-300">{nextProof}</p>
              </div>
              <button
                onClick={() => onCreateTask(ws.id, nextProof)}
                className="flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/10"
              >
                <PlusCircle className="h-3 w-3" /> Create task from this proof
              </button>
            </div>
          ) : !hasEvidence ? (
            <div className="rounded-lg border border-dashed border-border px-3 py-2">
              <p className="text-[11px] text-muted-foreground">No evidence yet.</p>
              <button
                onClick={() => onCreateTask(ws.id, `First proof for: ${ws.name}`)}
                className="mt-1.5 flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <PlusCircle className="h-3 w-3" /> Create one small proof
              </button>
            </div>
          ) : null}

          {evidenceItems.length > 0 && (
            <div className="space-y-1">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono">evidence logged</div>
              {evidenceItems.map((t) => (
                <div key={t.id} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                  <Zap className="mt-px h-3 w-3 shrink-0 text-primary/60" />
                  {t.proof_of_completion}
                </div>
              ))}
            </div>
          )}

          {analytics && analytics.feedback.total > 0 && (
            <div className="text-[11px] text-muted-foreground">
              <span className="font-mono uppercase tracking-wider text-foreground/50">signals · </span>
              {analytics.feedback.topLabels
                .map((l) => FEEDBACK_LABELS[l as keyof typeof FEEDBACK_LABELS] ?? l)
                .join(" · ")}
            </div>
          )}

          <div className="pt-1">
            <FeedbackChips
              source="mission"
              targetId={ws.id}
              taskTitle={ws.name}
              groups={["fit", "value", "tone"]}
              prompt="How does this workstream feel?"
            />
          </div>
        </div>
      )}
    </li>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */

const Mission = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const navigate = useNavigate();
  const [openWs, setOpenWs] = useState<string | null>(null);
  const insight = useAI<{ observation: string; suggestion?: string }>("mission_insight");

  const m = useMemo(() => (state ? selectMissionViewModel(state) : null), [state]);
  const analytics = useMemo(() => (state ? analyzeMission(state) : null), [state]);

  /* Daily snapshot — fires once per calendar day */
  const snapshotDateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!state || !analytics || analytics.perWorkstream.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const last = (state as Record<string, unknown> & { mission_history?: Array<{ date: string }> })
      .mission_history?.slice(-1)[0];
    if (last?.date === today || snapshotDateRef.current === today) return;
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
          id: a.workstream.id,
          name: a.workstream.name,
          status: a.workstream.status,
          health: a.health,
          pct: a.tasks.pct,
          velocity_7d: a.velocity_7d,
          trend: a.trend,
          headline: a.headline,
          feedback_top: a.feedback.topLabels,
        })),
      },
    });
  }, [state, analytics, dispatch]);

  const priorityWS = useMemo(
    () => (analytics ? [...analytics.perWorkstream].sort((a, b) => a.health - b.health) : []),
    [analytics],
  );

  const topRisk = useMemo(() => {
    if (!m) return null;
    const sev = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    return [...m.risks].sort((a, b) => sev[a.severity] - sev[b.severity])[0] ?? null;
  }, [m]);

  const missionHistory = useMemo(
    () =>
      ((state as Record<string, unknown>)?.mission_history ?? []) as Array<{
        date: string;
        overall_health: number;
      }>,
    [state],
  );

  const trendDelta = useMemo(() => {
    if (missionHistory.length < 2 || !analytics) return null;
    const prev = missionHistory[missionHistory.length - 2]?.overall_health;
    return typeof prev === "number" ? analytics.overallHealth - prev : null;
  }, [missionHistory, analytics]);

  /* Create task from workstream next_proof */
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
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">/ mission</div>
          <h1 className="mt-2 text-2xl font-semibold">No goal mapped yet.</h1>
          <p className="mt-2 text-sm text-muted-foreground max-w-prose">
            Tell Moment what you're chasing in Chat. The system will map it into workstreams, standards,
            and a living operating model — so Mission becomes your command centre, not just a stats page.
          </p>
          <button
            onClick={() => navigate("/app/chat")}
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
          >
            Go to Chat →
          </button>
        </section>
      </div>
    );
  }

  /* Derived values for the Mission Brief */
  const name = state.profile?.display_name?.trim();
  const goalStatement = m.goal.statement;
  const rawStage = state.active_goal?.current_stage ?? "";
  const stage = readableStage(rawStage);
  const stageMeta = STAGE_META[stage] ?? STAGE_META["Foundation"];

  /* Top bottleneck: highest-priority workstream with a bottleneck, else risk name */
  const sev: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  const topBottleneckWs = [...(m.workstreams ?? [])]
    .filter((w) => w.bottleneck?.trim())
    .sort((a, b) => (sev[a.priority] ?? 4) - (sev[b.priority] ?? 4))[0];
  const bottleneck = topBottleneckWs?.bottleneck || topRisk?.name || "";

  /* Top next proof: highest-priority workstream with next_proof */
  const topProofWs = [...(m.workstreams ?? [])]
    .filter((w) => w.next_proof?.trim())
    .sort((a, b) => (sev[a.priority] ?? 4) - (sev[b.priority] ?? 4))[0];
  const nextProof = topProofWs?.next_proof || "";

  /* Evidence signals: tasks done + forge signals + reflections */
  const allTasks = state.tasks ?? [];
  const doneTasks = allTasks.filter((t) => t.status === "done");
  const forgeSignals = (state.forge_state?.forge_signals ?? []).slice(-5);
  const recentReflections = [...(state.reflections ?? [])]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 3);

  const hasAnyEvidence = doneTasks.length > 0 || forgeSignals.length > 0 || recentReflections.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-8">

      {/* ── MISSION BRIEF HERO ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative space-y-5">
          {/* Top line */}
          <div>
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              <Flag className="h-3 w-3" /> mission brief
            </div>
            <h1 className="mt-2 text-2xl font-semibold leading-tight md:text-3xl">
              {name ? `${name}'s path` : "Your path"}
              {goalStatement ? (
                <span className="text-muted-foreground font-normal">
                  {" "}— {goalStatement}
                </span>
              ) : null}
            </h1>
            <div className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-2.5 py-0.5 text-xs font-medium text-primary">
              <Layers className="h-3 w-3" />
              {stage} stage
            </div>
          </div>

          {/* Stage explanation */}
          <div className="rounded-xl border border-border bg-background/40 p-4 space-y-2">
            <p className="text-sm text-muted-foreground leading-relaxed">{stageMeta.description}</p>
            <div className="flex items-start gap-2">
              <BookOpen className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
              <p className="text-xs text-foreground">{stageMeta.focus}</p>
            </div>
          </div>

          {/* Bottleneck + Next Proof side by side */}
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-amber-400/70">
                <AlertTriangle className="h-3 w-3" /> current bottleneck
              </div>
              <p className="mt-1.5 text-sm text-amber-200">
                {bottleneck || "No bottleneck identified yet — complete a few tasks and check back."}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-emerald-400/70">
                <Target className="h-3 w-3" /> next proof
              </div>
              <p className="mt-1.5 text-sm text-emerald-200">
                {nextProof || "Define one in a workstream below."}
              </p>
              {nextProof && topProofWs && (
                <button
                  onClick={() => createTaskFromProof(topProofWs.id, nextProof)}
                  className="mt-2 flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300"
                >
                  <PlusCircle className="h-3 w-3" /> Add to tasks
                </button>
              )}
            </div>
          </div>

          {/* Action row */}
          <div className="flex flex-wrap gap-2">
            {nextProof && topProofWs && (
              <button
                onClick={() => { createTaskFromProof(topProofWs.id, nextProof); }}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Start next proof
              </button>
            )}
            <button
              onClick={() => navigate("/app/tasks")}
              className="rounded-lg border border-border bg-background/50 px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/60"
            >
              Open Tasks
            </button>
            <button
              onClick={() => navigate("/app/plan")}
              className="rounded-lg border border-border bg-background/50 px-4 py-2 text-sm font-medium text-foreground hover:bg-secondary/60"
            >
              Open Plan
            </button>
          </div>
        </div>
      </section>

      <PatternBanner />

      {/* ── METRICS STRIP ──────────────────────────────────────────────────── */}
      {analytics && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Path health"
            value={analytics.overallHealth}
            explanation={
              analytics.overallHealth >= 70
                ? "Strong momentum across workstreams."
                : analytics.overallHealth >= 45
                  ? "Some areas need attention — see What matters now."
                  : "Several workstreams are stalling — prioritise one proof today."
            }
            tone={analytics.overallHealth < 45 ? "risk" : analytics.overallHealth >= 70 ? "success" : "default"}
          />
          <MetricCard
            label="Tasks this week"
            value={`${analytics.velocity_7d} done`}
            explanation={
              analytics.velocity_7d === 0
                ? "No tasks completed this week. Complete one small proof to start the signal."
                : analytics.velocity_7d >= 3
                  ? `${analytics.velocity_7d} proofs completed — good momentum.`
                  : `${analytics.velocity_7d} proof${analytics.velocity_7d === 1 ? "" : "s"} completed. Keep building.`
            }
            tone={analytics.velocity_7d === 0 ? "risk" : analytics.velocity_7d >= 3 ? "success" : "default"}
          />
          <MetricCard
            label="Overall progress"
            value={`${analytics.totalDone} / ${analytics.totalTasks}`}
            explanation={
              analytics.totalTasks === 0
                ? "No tasks yet — generate some from Tasks or the workstreams below."
                : `${analytics.totalDone} of ${analytics.totalTasks} tasks completed across all workstreams.`
            }
          />
          <MetricCard
            label="Top risk"
            value={topRisk?.name ?? "None logged"}
            explanation={
              topRisk?.mitigation
                ? `→ ${topRisk.mitigation}`
                : topRisk
                  ? `Severity: ${topRisk.severity}. Check the Risks section below.`
                  : "No critical risks identified. Keep logging proofs."
            }
            tone={topRisk?.severity === "critical" || topRisk?.severity === "high" ? "risk" : "default"}
          />
        </div>
      )}

      {/* ── WHAT MATTERS NOW ───────────────────────────────────────────────── */}
      {analytics && analytics.needsAttention.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> what matters now
          </div>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {analytics.needsAttention.slice(0, 4).map((a) => {
              const ws = a.workstream;
              const Trend = trendIcon(a.trend);
              const nextAction = ws.next_proof?.trim()
                || (ws.bottleneck ? `Address: ${ws.bottleneck}` : `Start a task in ${ws.name}`);
              return (
                <li key={ws.id} className="rounded-lg border border-border bg-background/40 p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{ws.name}</span>
                    <span className={`flex items-center gap-1 font-mono text-[10px] ${healthColor(a.health)}`}>
                      <Trend className="h-3 w-3" /> {a.health}
                    </span>
                  </div>
                  {ws.bottleneck ? (
                    <p className="text-[11px] text-amber-300/80">{ws.bottleneck}</p>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">{a.headline}</p>
                  )}
                  <div className="rounded-md border border-primary/20 bg-primary/5 px-2.5 py-1.5">
                    <div className="text-[10px] uppercase tracking-wider text-primary/60 font-mono">next action</div>
                    <p className="mt-0.5 text-[12px] text-foreground">{nextAction}</p>
                  </div>
                  <button
                    onClick={() => createTaskFromProof(ws.id, nextAction)}
                    className="flex items-center gap-1 text-[11px] text-primary hover:underline"
                  >
                    <PlusCircle className="h-3 w-3" /> Create task
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── MOMENT NOTICES ─────────────────────────────────────────────────── */}
      <AIInsight
        label="moment notices"
        loading={insight.loading}
        error={insight.error}
        onRun={() =>
          insight.run({
            pursuit: state.pursuit_model,
            analytics: analytics?.perWorkstream.map((a) => ({
              name: a.workstream.name,
              health: a.health,
              trend: a.trend,
              velocity_7d: a.velocity_7d,
              headline: a.headline,
              feedback_top: a.feedback.topLabels,
            })),
            history: missionHistory.slice(-7),
          })
        }
        cta={insight.result ? "Re-read" : "Read mission"}
      >
        {insight.result && (
          <div className="space-y-1.5">
            <div className="text-sm">{insight.result.observation}</div>
            {insight.result.suggestion && (
              <div className="text-xs text-muted-foreground">→ {insight.result.suggestion}</div>
            )}
          </div>
        )}
      </AIInsight>

      {/* ── CONSTELLATION + WORKSTREAMS ────────────────────────────────────── */}
      {state.pursuit_model && analytics && (
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Constellation */}
          <div className="lg:col-span-3">
            <MissionConstellation
              model={state.pursuit_model}
              analytics={analytics.perWorkstream}
              onWorkstreamClick={(id) => setOpenWs((o) => (o === id ? null : id))}
            />
            {openWs && (() => {
              const ws = m.workstreams.find((w) => w.id === openWs);
              const a = analytics.perWorkstream.find((x) => x.workstream.id === openWs);
              if (!ws) return null;
              const wsTasksDone = allTasks.filter(
                (t) => t.workstream_id === ws.id && t.status === "done",
              );
              return (
                <div className="mt-3 rounded-xl border border-primary/20 bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{ws.name}</div>
                    <button onClick={() => setOpenWs(null)} className="text-xs text-muted-foreground hover:text-foreground">close ×</button>
                  </div>
                  {ws.description && <p className="text-[12px] text-muted-foreground">{ws.description}</p>}
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg border border-border bg-background/60 p-2">
                      <div className="font-mono text-[9px] uppercase text-muted-foreground">health</div>
                      <div className={`mt-0.5 font-mono text-sm ${healthColor(a?.health ?? 0)}`}>{a?.health ?? "—"}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-background/60 p-2">
                      <div className="font-mono text-[9px] uppercase text-muted-foreground">tasks done</div>
                      <div className="mt-0.5 font-mono text-sm">{a?.tasks.done ?? 0}/{a?.tasks.total ?? 0}</div>
                    </div>
                    <div className="rounded-lg border border-border bg-background/60 p-2">
                      <div className="font-mono text-[9px] uppercase text-muted-foreground">this week</div>
                      <div className="mt-0.5 font-mono text-sm">{a?.velocity_7d ?? 0}</div>
                    </div>
                  </div>
                  {ws.bottleneck && (
                    <div className="rounded-md border border-amber-500/20 bg-amber-500/5 px-2.5 py-1.5 text-[12px] text-amber-300">
                      ⚠ {ws.bottleneck}
                    </div>
                  )}
                  {ws.next_proof && (
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
                  )}
                  {wsTasksDone.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">evidence logged</div>
                      {wsTasksDone.slice(0, 3).map((t) => (
                        <div key={t.id} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                          <Zap className="mt-px h-3 w-3 shrink-0 text-primary/50" />
                          {t.proof_of_completion || t.title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Workstreams list */}
          <section className="lg:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                workstreams · by priority
              </div>
              <div className="text-[10px] text-muted-foreground">{priorityWS.length} total</div>
            </div>
            <ul className="overflow-hidden rounded-2xl border border-border bg-card">
              {priorityWS.map((a) => (
                <WorkstreamCard
                  key={a.workstream.id}
                  ws={a.workstream}
                  analytics={a}
                  tasksForWs={allTasks.filter((t) => t.workstream_id === a.workstream.id)}
                  isOpen={openWs === a.workstream.id}
                  onToggle={() => setOpenWs((o) => (o === a.workstream.id ? null : a.workstream.id))}
                  onCreateTask={createTaskFromProof}
                />
              ))}
            </ul>
          </section>
        </div>
      )}

      {/* ── STANDARDS ──────────────────────────────────────────────────────── */}
      {m.standards.length > 0 && (
        <section>
          <div className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Standards</div>
          <div className="grid gap-3 md:grid-cols-2">
            {m.standards.map((s) => {
              const t = stdTone[s.trajectory];
              const Icon = t.icon;
              const hasEvidence = s.current_value?.trim();
              return (
                <div key={s.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-sm font-medium">{s.name}</div>
                    <span className={`inline-flex shrink-0 items-center gap-1 font-mono text-[10px] uppercase ${t.cls}`}>
                      <Icon className="h-3 w-3" /> {t.label}
                    </span>
                  </div>
                  {s.description && (
                    <p className="text-[12px] text-muted-foreground leading-relaxed">{s.description}</p>
                  )}
                  <div className="rounded-md bg-secondary/50 px-2.5 py-1.5">
                    <div className="text-[10px] uppercase font-mono text-muted-foreground">
                      {hasEvidence ? "current" : "target"} · <span className="text-foreground/70">{s.current_value || s.target_value || "not measured yet"}</span>
                      {s.target_value && hasEvidence && (
                        <span className="text-muted-foreground"> / {s.target_value}</span>
                      )}
                    </div>
                  </div>
                  {!hasEvidence && (
                    <p className="text-[11px] text-muted-foreground">
                      No evidence logged yet. Complete a task that proves this standard to update it.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── CAPABILITY CLUSTERS ────────────────────────────────────────────── */}
      {m.capabilityClusters.length > 0 && (
        <section>
          <div className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Capability clusters</div>
          <div className="grid gap-3 md:grid-cols-2">
            {m.capabilityClusters.map((c) => {
              const pct = ccProgress[c.status];
              return (
                <div key={c.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{c.name}</div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {c.status.replace("_", " ")}
                    </span>
                  </div>
                  {c.why_it_matters && (
                    <p className="text-[12px] text-muted-foreground">{c.why_it_matters}</p>
                  )}
                  {c.description && !c.why_it_matters && (
                    <p className="text-[12px] text-muted-foreground">{c.description}</p>
                  )}
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground">{pct}% — {c.status.replace("_", " ")}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── RISKS ──────────────────────────────────────────────────────────── */}
      {m.risks.length > 0 && (
        <section>
          <div className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Risks</div>
          <ul className="space-y-2">
            {m.risks.map((r) => (
              <li key={r.id} className={`rounded-xl border px-4 py-3 space-y-1.5 ${riskTone[r.severity]}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-medium">{r.name}</div>
                  <span className="font-mono text-[10px] uppercase tracking-wider opacity-70 shrink-0">{r.severity}</span>
                </div>
                {r.description && (
                  <p className="text-[12px] opacity-80">{r.description}</p>
                )}
                {r.mitigation ? (
                  <div className="rounded-md border border-current/20 bg-current/5 px-2.5 py-1.5">
                    <div className="text-[10px] uppercase font-mono opacity-60">intervention</div>
                    <p className="mt-0.5 text-[12px]">→ {r.mitigation}</p>
                  </div>
                ) : (
                  <p className="text-[12px] opacity-70">No mitigation defined — consider adding one in Chat.</p>
                )}
                {(r.severity === "critical" || r.severity === "high") && r.mitigation && (
                  <button
                    onClick={() =>
                      createTaskFromProof(
                        m.workstreams[0]?.id ?? "",
                        r.mitigation,
                      )
                    }
                    className="flex items-center gap-1 text-[11px] opacity-80 hover:opacity-100 hover:underline"
                  >
                    <PlusCircle className="h-3 w-3" /> Create mitigation task
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── EVIDENCE SIGNALS ───────────────────────────────────────────────── */}
      <section>
        <div className="mb-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Evidence signals</div>

        {!hasAnyEvidence ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center space-y-2">
            <p className="text-sm text-muted-foreground">No evidence signals yet.</p>
            <p className="text-xs text-muted-foreground">
              Complete a proof task, save a Forge run, or submit a reflection to start building your evidence trail.
            </p>
            <div className="flex justify-center gap-2 mt-2">
              <button
                onClick={() => navigate("/app/tasks")}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Open Tasks
              </button>
              <button
                onClick={() => navigate("/app/forge")}
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Open Forge
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Formal evidence signals from pursuit model */}
            {m.evidenceSignals.length > 0 && (
              <ul className="overflow-hidden rounded-xl border border-border bg-card divide-y divide-border">
                {m.evidenceSignals.map((s: EvidenceSignal) => (
                  <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${s.kind === "leading" ? "bg-primary" : "bg-muted-foreground"}`} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm">{s.name}</div>
                      {s.description && <div className="text-[11px] text-muted-foreground truncate">{s.description}</div>}
                    </div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{s.kind}</span>
                    <span className="w-16 text-right font-mono text-xs">{s.last_value || "—"}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Completed tasks as evidence */}
            {doneTasks.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] text-muted-foreground">
                  {doneTasks.length} task{doneTasks.length === 1 ? "" : "s"} completed
                </div>
                <ul className="space-y-1">
                  {doneTasks.slice(0, 5).map((t) => (
                    <li key={t.id} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                      <Zap className="mt-px h-3 w-3 shrink-0 text-primary/60" />
                      <span>{t.proof_of_completion || t.title}</span>
                    </li>
                  ))}
                  {doneTasks.length > 5 && (
                    <li className="text-[11px] text-muted-foreground pl-5">
                      + {doneTasks.length - 5} more — <button onClick={() => navigate("/app/tasks")} className="text-primary hover:underline">view all tasks</button>
                    </li>
                  )}
                </ul>
              </div>
            )}

            {/* Forge signals */}
            {forgeSignals.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] text-muted-foreground">
                  {forgeSignals.length} Forge signal{forgeSignals.length === 1 ? "" : "s"} this week
                </div>
                <ul className="space-y-1">
                  {forgeSignals.map((s: Record<string, string>, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                      <ChevronRight className="mt-px h-3 w-3 shrink-0 text-primary/50" />
                      {s.content || s.signal || `Forge signal ${i + 1}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Reflections */}
            {recentReflections.length > 0 && (
              <div>
                <div className="mb-1.5 text-[11px] text-muted-foreground">
                  {recentReflections.length} recent reflection{recentReflections.length === 1 ? "" : "s"}
                </div>
                <ul className="space-y-1">
                  {recentReflections.map((r) => (
                    <li key={r.date} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                      <Activity className="mt-px h-3 w-3 shrink-0 text-muted-foreground/50" />
                      {r.date}: {r.accomplishment || r.win || "Reflection logged"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

    </div>
  );
};

export default Mission;
