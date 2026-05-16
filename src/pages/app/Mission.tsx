// @ts-nocheck
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown, AlertTriangle, Target, TrendingUp, TrendingDown, Activity,
  Sparkles, Flag, ArrowUpRight, ArrowDownRight, Minus, Zap,
} from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { selectMissionViewModel } from "@/lib/selectors/mission";
import { analyzeMission, type WorkstreamAnalytics } from "@/lib/selectors/mission-analytics";
import { MissionConstellation } from "@/components/app/MissionConstellation";
import type { CapabilityCluster, EvidenceSignal, PursuitRisk, PursuitStandard } from "@/lib/types";
import { FeedbackChips } from "@/components/app/FeedbackChips";
import { PatternBanner } from "@/components/app/PatternBanner";
import { AIInsight } from "@/components/app/AIInsight";
import { useAI } from "@/lib/ai/useAI";
import { FEEDBACK_LABELS } from "@/lib/feedback/labels";

const ccProgress: Record<CapabilityCluster["status"], number> = {
  not_started: 5, emerging: 25, developing: 50, solid: 78, mastered: 100,
};

const riskTone: Record<PursuitRisk["severity"], string> = {
  critical: "border-red-500/40 bg-red-500/10 text-red-300",
  high:     "border-amber-500/40 bg-amber-500/10 text-amber-300",
  medium:   "border-border bg-secondary text-foreground",
  low:      "border-border bg-secondary/50 text-muted-foreground",
};

const stdTone: Record<PursuitStandard["trajectory"], { label: string; cls: string; icon: typeof TrendingUp }> = {
  ahead:    { label: "ahead",    cls: "text-emerald-300", icon: TrendingUp },
  on_track: { label: "on track", cls: "text-primary",     icon: Activity },
  at_risk:  { label: "at risk",  cls: "text-amber-300",   icon: AlertTriangle },
  below:    { label: "below",    cls: "text-red-300",     icon: TrendingDown },
};

const trendIcon = (t: WorkstreamAnalytics["trend"]) =>
  t === "rising" ? ArrowUpRight : t === "falling" ? ArrowDownRight : Minus;

const healthColor = (h: number) =>
  h >= 70 ? "text-primary" : h >= 45 ? "text-amber-300" : "text-red-300";
const healthBar = (h: number) =>
  h >= 70 ? "bg-primary" : h >= 45 ? "bg-amber-400" : "bg-red-400";

const Mission = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [open, setOpen] = useState<string | null>(null);
  const insight = useAI<{ observation: string; suggestion?: string }>("mission_insight");

  const m = useMemo(() => state ? selectMissionViewModel(state) : null, [state]);
  const analytics = useMemo(() => state ? analyzeMission(state) : null, [state]);

  // Daily snapshot — fires once per day, persisted via state store (cloud-synced).
  const snapshotDateRef = useRef<string | null>(null);
  useEffect(() => {
    if (!state || !analytics || analytics.perWorkstream.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    const last = (state as any).mission_history?.slice(-1)[0];
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

  const priorityWS = useMemo(() => {
    if (!analytics) return [];
    return [...analytics.perWorkstream].sort((a, b) => a.health - b.health);
  }, [analytics]);

  const topRisk = useMemo(() => {
    if (!m) return null;
    const sev = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    return [...m.risks].sort((a, b) => sev[a.severity] - sev[b.severity])[0] ?? null;
  }, [m]);

  if (!state || !m) return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;

  const nextProof = m.workstreams.find((w) => w.next_proof)?.next_proof ?? "";

  if (!m.hasModel) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">/ mission</div>
          <h1 className="mt-1 text-xl font-semibold leading-snug">No goal set yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tell Moment what you're chasing in chat. We'll map it out together.
          </p>
        </section>
      </div>
    );
  }

  const history = ((state as any).mission_history ?? []) as Array<{ date: string; overall_health: number }>;
  const trendDelta = (() => {
    if (history.length < 2 || !analytics) return null;
    const prev = history[history.length - 2]?.overall_health;
    if (typeof prev !== "number") return null;
    return analytics.overallHealth - prev;
  })();

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* HERO BRIEF */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <Flag className="h-3 w-3" /> mission brief
          </div>
          <h1 className="mt-3 max-w-3xl font-display text-2xl font-semibold leading-tight md:text-3xl">
            {state?.profile.display_name ? `${state.profile.display_name}'s path` : "Your path"}
          </h1>
          <p className="mt-1 max-w-3xl text-base text-muted-foreground">{m.goal.statement}</p>
          {state?.active_goal?.current_stage && (
            <p className="mt-1 text-xs text-muted-foreground">
              Stage: <span className="text-foreground">{state.active_goal.current_stage}</span>
            </p>
          )}
          {m.goal.whyItMatters && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{m.goal.whyItMatters}</p>
          )}

          {/* Quant header strip */}
          {analytics && (
            <div className="mt-5 grid gap-3 md:grid-cols-4">
              <div className="rounded-xl border border-border bg-background/50 p-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">overall health</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={`text-2xl font-semibold ${healthColor(analytics.overallHealth)}`}>{analytics.overallHealth}</span>
                  {trendDelta !== null && (
                    <span className={`font-mono text-[10px] ${trendDelta > 0 ? "text-emerald-300" : trendDelta < 0 ? "text-red-300" : "text-muted-foreground"}`}>
                      {trendDelta > 0 ? "+" : ""}{trendDelta} vs last
                    </span>
                  )}
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                  <div className={`h-full rounded-full ${healthBar(analytics.overallHealth)}`} style={{ width: `${analytics.overallHealth}%` }} />
                </div>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">tasks done</div>
                <div className="mt-1 text-2xl font-semibold">{analytics.totalDone}<span className="text-sm text-muted-foreground"> / {analytics.totalTasks}</span></div>
                <div className="mt-1 text-[11px] text-muted-foreground">across {analytics.perWorkstream.length} workstreams</div>
              </div>
              <div className="rounded-xl border border-border bg-background/50 p-3">
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">velocity · 7d</div>
                <div className="mt-1 flex items-baseline gap-2"><Zap className="h-4 w-4 text-primary" /><span className="text-2xl font-semibold">{analytics.velocity_7d}</span></div>
                <div className="mt-1 text-[11px] text-muted-foreground">tasks completed this week</div>
              </div>
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
                <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  <AlertTriangle className="h-3 w-3" /> top risk
                </div>
                <div className="mt-1 truncate text-sm font-medium">{topRisk?.name ?? "None logged"}</div>
                {topRisk?.mitigation && (<div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">→ {topRisk.mitigation}</div>)}
              </div>
            </div>
          )}

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">operating mode</div>
              <div className="mt-1 text-sm font-medium text-primary">{m.activeOperatingMode?.name ?? "—"}</div>
              {m.activeOperatingMode?.stance && (
                <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{m.activeOperatingMode.stance}</div>
              )}
            </div>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <Target className="h-3 w-3" /> next proof
              </div>
              <div className="mt-1 text-sm font-medium line-clamp-2">{nextProof || "Define one in a workstream"}</div>
            </div>
          </div>
        </div>
      </section>

      <PatternBanner />

      {/* What matters now */}
      {analytics && analytics.needsAttention.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> what matters now
          </div>
          <ul className="mt-3 grid gap-2 md:grid-cols-2">
            {analytics.needsAttention.slice(0, 4).map((a) => {
              const Trend = trendIcon(a.trend);
              return (
                <li key={a.workstream.id} className="rounded-lg border border-border bg-background/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{a.workstream.name}</span>
                    <span className={`flex items-center gap-1 font-mono text-[10px] ${healthColor(a.health)}`}>
                      <Trend className="h-3 w-3" /> {a.health}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{a.headline}</div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <AIInsight
        label="moment notices"
        loading={insight.loading}
        error={insight.error}
        onRun={() => insight.run({
          pursuit: state.pursuit_model,
          analytics: analytics?.perWorkstream.map((a) => ({
            name: a.workstream.name, health: a.health, trend: a.trend,
            velocity_7d: a.velocity_7d, headline: a.headline, feedback_top: a.feedback.topLabels,
          })),
          history: ((state as any).mission_history ?? []).slice(-7),
        })}
        cta={insight.result ? "Re-read" : "Read mission"}
      >
        {insight.result && (
          <div className="space-y-1.5">
            <div className="text-sm">{insight.result.observation}</div>
            {insight.result.suggestion && <div className="text-xs text-muted-foreground">→ {insight.result.suggestion}</div>}
          </div>
        )}
      </AIInsight>

      {/* CONSTELLATION + WORKSTREAMS */}
      {state.pursuit_model && analytics && (
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3">
            <MissionConstellation
              model={state.pursuit_model}
              analytics={analytics.perWorkstream}
              onWorkstreamClick={(id) => setOpen((o) => o === id ? null : id)}
            />
          </div>

          <section className="lg:col-span-2">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                workstreams · sorted by health
              </div>
              <div className="text-[10px] text-muted-foreground">{priorityWS.length} total</div>
            </div>
            <ul className="overflow-hidden rounded-2xl border border-border bg-card">
              {priorityWS.map((a) => {
                const w = a.workstream;
                const isOpen = open === w.id;
                const Trend = trendIcon(a.trend);
                return (
                  <li key={w.id} className="border-b border-border last:border-b-0">
                    <button
                      onClick={() => setOpen(isOpen ? null : w.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
                    >
                      <div className="flex w-12 shrink-0 flex-col items-center">
                        <span className={`font-mono text-sm font-semibold ${healthColor(a.health)}`}>{a.health}</span>
                        <span className="font-mono text-[8px] uppercase tracking-wider text-muted-foreground">health</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm">{w.name}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1"><Trend className="h-3 w-3" />{a.velocity_7d}/wk</span>
                          <span>·</span>
                          <span>{a.tasks.done}/{a.tasks.total} done</span>
                        </div>
                      </div>
                      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`} />
                    </button>

                    {isOpen && (
                      <div className="space-y-3 border-t border-border bg-background/40 px-4 py-3 text-sm">
                        <div className="text-muted-foreground italic">{a.headline}</div>

                        {/* mini quant grid */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="rounded-lg border border-border bg-background/60 p-2">
                            <div className="font-mono text-[9px] uppercase text-muted-foreground">progress</div>
                            <div className={`mt-0.5 font-mono text-sm ${healthColor(a.tasks.pct)}`}>{a.tasks.pct}%</div>
                          </div>
                          <div className="rounded-lg border border-border bg-background/60 p-2">
                            <div className="font-mono text-[9px] uppercase text-muted-foreground">7d / prev</div>
                            <div className="mt-0.5 font-mono text-sm">{a.velocity_7d}<span className="text-muted-foreground"> / {a.velocity_prev_7d}</span></div>
                          </div>
                          <div className="rounded-lg border border-border bg-background/60 p-2">
                            <div className="font-mono text-[9px] uppercase text-muted-foreground">signals</div>
                            <div className="mt-0.5 font-mono text-sm">{a.signalScore ?? "—"}</div>
                          </div>
                        </div>

                        {w.bottleneck && (
                          <div className="rounded-md border border-amber-500/25 bg-amber-500/5 p-2 text-[12px] text-amber-300/90">
                            ⚠ {w.bottleneck}
                          </div>
                        )}
                        {w.next_proof && (
                          <div className="text-[12px]"><span className="text-foreground">Next proof: </span><span className="text-muted-foreground">{w.next_proof}</span></div>
                        )}

                        {a.feedback.total > 0 && (
                          <div className="text-[11px] text-muted-foreground">
                            <span className="font-mono uppercase tracking-wider text-foreground/70">recent feedback · </span>
                            {a.feedback.topLabels.map((l) => FEEDBACK_LABELS[l as keyof typeof FEEDBACK_LABELS] ?? l).join(" · ")}
                          </div>
                        )}
                        {a.reflectionMentions > 0 && (
                          <div className="text-[11px] text-muted-foreground">
                            Mentioned in {a.reflectionMentions} reflection{a.reflectionMentions === 1 ? "" : "s"}.
                          </div>
                        )}

                        <div className="pt-1">
                          <FeedbackChips
                            source="mission"
                            targetId={w.id}
                            taskTitle={w.name}
                            groups={["fit", "value", "tone"]}
                            prompt="How does this workstream feel?"
                          />
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}

      {/* STANDARDS */}
      {m.standards.length > 0 && (
        <section>
          <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Standards</div>
          <div className="grid gap-3 md:grid-cols-2">
            {m.standards.map((s) => {
              const t = stdTone[s.trajectory]; const Icon = t.icon;
              return (
                <div key={s.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-medium">{s.name}</div>
                    <span className={`inline-flex items-center gap-1 font-mono text-[10px] uppercase ${t.cls}`}>
                      <Icon className="h-3 w-3" /> {t.label}
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2 font-mono text-xs">
                    <span className="text-foreground">{s.current_value || "—"}</span>
                    <span className="text-muted-foreground">/ {s.target_value || "—"}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* CAPABILITIES */}
      {m.capabilityClusters.length > 0 && (
        <section>
          <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Capability clusters</div>
          <div className="grid gap-2 md:grid-cols-2">
            {m.capabilityClusters.map((c) => {
              const pct = ccProgress[c.status];
              return (
                <div key={c.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm">{c.name}</div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{c.status.replace("_", " ")}</span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* RISKS */}
      {m.risks.length > 0 && (
        <section>
          <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Risks</div>
          <ul className="space-y-2">
            {m.risks.map((r) => (
              <li key={r.id} className={`rounded-xl border px-3 py-2 ${riskTone[r.severity]}`}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium">{r.name}</div>
                  <span className="font-mono text-[10px] uppercase tracking-wider opacity-80">{r.severity}</span>
                </div>
                {r.mitigation && <div className="mt-1 text-[11px] opacity-80">→ {r.mitigation}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* SIGNALS */}
      {m.evidenceSignals.length > 0 && (
        <section>
          <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Evidence signals</div>
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {m.evidenceSignals.map((s: EvidenceSignal) => (
              <li key={s.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
                <span className={`h-1.5 w-1.5 rounded-full ${s.kind === "leading" ? "bg-primary" : "bg-muted-foreground"}`} />
                <span className="flex-1 truncate text-sm">{s.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{s.kind}</span>
                <span className="w-16 text-right font-mono text-xs">{s.last_value || "—"}</span>
                <span className="hidden w-20 text-right font-mono text-[10px] text-muted-foreground sm:inline">/ {s.target || "—"}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default Mission;