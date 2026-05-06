import { useMemo, useState } from "react";
import { ChevronDown, AlertTriangle, Target, TrendingUp, TrendingDown, Activity, Sparkles, Flag } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { selectMissionViewModel } from "@/lib/selectors/mission";
import { RelationshipGraph } from "@/components/app/RelationshipGraph";
import type { CapabilityCluster, EvidenceSignal, PursuitRisk, PursuitStandard, PursuitWorkstream } from "@/lib/types";
import { FeedbackChips } from "@/components/app/FeedbackChips";
import { PatternBanner } from "@/components/app/PatternBanner";
import { AIInsight } from "@/components/app/AIInsight";
import { useAI } from "@/lib/ai/useAI";

const wsStatusTone: Record<PursuitWorkstream["status"], { dot: string; label: string; ring: string }> = {
  on_track:    { dot: "bg-emerald-400", label: "text-emerald-300", ring: "ring-emerald-400/30" },
  slipping:    { dot: "bg-amber-400",   label: "text-amber-300",   ring: "ring-amber-400/30" },
  stalled:     { dot: "bg-red-400",     label: "text-red-300",     ring: "ring-red-400/40" },
  complete:    { dot: "bg-muted-foreground", label: "text-muted-foreground", ring: "ring-border" },
  not_started: { dot: "bg-muted-foreground/50", label: "text-muted-foreground", ring: "ring-border" },
};

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

const Mission = () => {
  const state = useStateStore((s) => s.state);
  const [open, setOpen] = useState<string | null>(null);
  const insight = useAI<{ observation: string; suggestion?: string }>("mission_insight");

  if (!state) return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;
  const m = selectMissionViewModel(state);

  const priorityWS = useMemo(() => {
    return [...m.workstreams].sort((a, b) => {
      const order = { stalled: 0, slipping: 1, on_track: 2, not_started: 3, complete: 4 } as const;
      return order[a.status] - order[b.status];
    });
  }, [m.workstreams]);

  const topRisk = useMemo(() => {
    const sev = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    return [...m.risks].sort((a, b) => sev[a.severity] - sev[b.severity])[0] ?? null;
  }, [m.risks]);

  const nextProof = priorityWS.find((w) => w.next_proof)?.next_proof ?? "";

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

  const slipping = m.workstreams.filter((w) => w.status === "slipping" || w.status === "stalled");
  const offTargetSignals = m.evidenceSignals.filter((s) => s.last_value && s.target && s.last_value !== s.target).slice(0, 3);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* HERO BRIEF */}
      <section className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 md:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-accent/10 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <Flag className="h-3 w-3" /> mission brief
          </div>
          <h1 className="mt-3 max-w-3xl font-display text-2xl font-semibold leading-tight md:text-3xl">
            {m.goal.statement}
          </h1>
          {m.goal.whyItMatters && (
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{m.goal.whyItMatters}</p>
          )}

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">mode</div>
              <div className="mt-1 text-sm font-medium text-primary">
                {m.activeOperatingMode?.name ?? "—"}
              </div>
              {m.activeOperatingMode?.stance && (
                <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">{m.activeOperatingMode.stance}</div>
              )}
            </div>
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <AlertTriangle className="h-3 w-3" /> top risk
              </div>
              <div className="mt-1 text-sm font-medium">{topRisk?.name ?? "No risks logged"}</div>
              {topRisk?.mitigation && (
                <div className="mt-1 text-[11px] text-muted-foreground line-clamp-2">→ {topRisk.mitigation}</div>
              )}
            </div>
            <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
              <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                <Target className="h-3 w-3" /> next proof
              </div>
              <div className="mt-1 text-sm font-medium line-clamp-3">{nextProof || "Define one in a workstream"}</div>
            </div>
          </div>
        </div>
      </section>

      <PatternBanner />

      {/* WHAT MATTERS NOW */}
      {(slipping.length > 0 || offTargetSignals.length > 0) && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" /> what matters now
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {slipping.length > 0 && (
              <div>
                <div className="mb-2 text-xs text-muted-foreground">Workstreams needing attention</div>
                <ul className="space-y-1.5">
                  {slipping.map((w) => (
                    <li key={w.id} className="flex items-start gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${wsStatusTone[w.status].dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm">{w.name}</div>
                        {w.bottleneck && <div className="truncate text-[11px] text-amber-300/80">⚠ {w.bottleneck}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {offTargetSignals.length > 0 && (
              <div>
                <div className="mb-2 text-xs text-muted-foreground">Signals off target</div>
                <ul className="space-y-1.5">
                  {offTargetSignals.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2">
                      <span className="flex-1 truncate text-sm">{s.name}</span>
                      <span className="font-mono text-xs text-amber-300">{s.last_value}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">/ {s.target}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </section>
      )}

      <AIInsight
        label="moment notices"
        loading={insight.loading}
        error={insight.error}
        onRun={() => insight.run({ pursuit: state.pursuit_model, workstreams: m.workstreams.map(w => ({ name: w.name, status: w.status, bottleneck: w.bottleneck })) })}
        cta={insight.result ? "Re-read" : "Read mission"}
      >
        {insight.result && (
          <div className="space-y-1.5">
            <div className="text-sm">{insight.result.observation}</div>
            {insight.result.suggestion && <div className="text-xs text-muted-foreground">→ {insight.result.suggestion}</div>}
          </div>
        )}
      </AIInsight>

      {/* MAP + WORKSTREAMS side-by-side on desktop */}
      <div className="grid gap-6 lg:grid-cols-5">
        {state.pursuit_model && (
          <div className="lg:col-span-2">
            <RelationshipGraph model={state.pursuit_model} />
          </div>
        )}

        {priorityWS.length > 0 && (
          <section className="lg:col-span-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Workstreams
              </div>
              <div className="text-[10px] text-muted-foreground">{priorityWS.length} total</div>
            </div>
            <ul className="overflow-hidden rounded-2xl border border-border bg-card">
              {priorityWS.map((w) => {
                const isOpen = open === w.id;
                const tone = wsStatusTone[w.status];
                return (
                  <li key={w.id} className="border-b border-border last:border-b-0">
                    <button
                      onClick={() => setOpen(isOpen ? null : w.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/40"
                    >
                      <span className={`h-2 w-2 shrink-0 rounded-full ring-2 ${tone.dot} ${tone.ring}`} />
                      <span className="flex-1 truncate text-sm">{w.name}</span>
                      {w.bottleneck && (
                        <span className="hidden max-w-[40%] truncate text-xs text-amber-300/80 sm:block">⚠ {w.bottleneck}</span>
                      )}
                      <span className={`font-mono text-[10px] uppercase tracking-wider ${tone.label}`}>
                        {w.status.replace("_", " ")}
                      </span>
                      <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${isOpen ? "rotate-0" : "-rotate-90"}`} />
                    </button>
                    {isOpen && (
                      <div className="space-y-2 border-t border-border bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                        {w.description && <div>{w.description}</div>}
                        {w.next_proof && (
                          <div><span className="text-foreground">Next proof: </span>{w.next_proof}</div>
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
        )}
      </div>

      {/* STANDARDS */}
      {m.standards.length > 0 && (
        <section>
          <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Standards
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {m.standards.map((s) => {
              const t = stdTone[s.trajectory];
              const Icon = t.icon;
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

      {/* CAPABILITIES with progress */}
      {m.capabilityClusters.length > 0 && (
        <section>
          <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Capability clusters
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {m.capabilityClusters.map((c) => {
              const pct = ccProgress[c.status];
              return (
                <div key={c.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm">{c.name}</div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      {c.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary transition-all"
                      style={{ width: `${pct}%` }}
                    />
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
          <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Risks
          </div>
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
          <div className="mb-2 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Evidence signals
          </div>
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {m.evidenceSignals.map((s: EvidenceSignal) => (
              <li key={s.id} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
                <span className={`h-1.5 w-1.5 rounded-full ${s.kind === "leading" ? "bg-primary" : "bg-muted-foreground"}`} />
                <span className="flex-1 truncate text-sm">{s.name}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{s.kind}</span>
                <span className="w-16 text-right font-mono text-xs">{s.last_value || "—"}</span>
                <span className="hidden w-20 text-right font-mono text-[10px] text-muted-foreground sm:inline">
                  / {s.target || "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default Mission;
