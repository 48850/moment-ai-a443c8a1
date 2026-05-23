import { Mote } from "@/components/app/Mote";
import { useMemo } from "react";
import { useStateStore } from "@/stores/state-store";
import { computeGoalProgress } from "@/lib/engine/next-best-task";
import { FEEDBACK_OPTIONS } from "@/lib/state/schema";
import { FEEDBACK_LABELS } from "@/lib/feedback/labels";
import { PatternBanner } from "@/components/app/PatternBanner";
import { AIInsight } from "@/components/app/AIInsight";
import { useAI } from "@/lib/ai/useAI";
import { selectAuditMetrics } from "@/lib/selectors/audit";

const Audit = () => {
  const state = useStateStore((s) => s.state);

  const audit = useAI<{ drift_score: number; status: string; reasons: string[]; recommendation: string }>(
    "goal_audit",
  );

  const metrics = useMemo(() => (state ? selectAuditMetrics(state) : null), [state]);
  const goalProgress = useMemo(() => (state ? computeGoalProgress(state) : 0), [state]);

  if (!state || !metrics)
    return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="text-xs text-muted-foreground">/ audit</div>
        <h1 className="mt-1 flex items-center gap-3 text-2xl font-semibold tracking-tight"><Mote size={56} bounce mood="focused" />How you're really doing</h1>
        <p className="mt-1 text-sm text-muted-foreground">An honest snapshot. No vanity metrics.</p>
      </div>

      <PatternBanner />

      {/* Bottleneck hypothesis derived from real state — always visible */}
      <section className="rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/5 to-transparent p-5">
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
          where you're stuck right now
        </div>
        <p className="mt-2 text-sm font-medium text-foreground">{metrics.bottleneck_hypothesis}</p>
        <p className="mt-2 text-xs text-muted-foreground">{metrics.recommended_adjustment}</p>
      </section>

      <AIInsight
        label="goal audit"
        loading={audit.loading}
        error={audit.error}
        onRun={() =>
          audit.run({
            metrics,
            feedback: state.execution_feedback?.slice(-30),
            reflections: state.reflections?.slice(-14),
            rescue_signals: state.rescue_signals?.slice(-10),
          })
        }
        cta={audit.result ? "Re-run" : "Run deeper audit"}
      >
        {audit.result && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs">
              <span className="rounded-full border border-border bg-card px-2 py-0.5">
                drift {audit.result.drift_score}
              </span>
              <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-primary">
                {audit.result.status}
              </span>
            </div>
            {audit.result.reasons?.length > 0 && (
              <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
                {audit.result.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
            <div className="text-sm">{audit.result.recommendation}</div>
          </div>
        )}
      </AIInsight>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Goal progress" value={`${goalProgress}%`} />
        <Stat
          label="Tasks done"
          value={`${metrics.tasks_done}/${metrics.tasks_total}`}
          sub={`${metrics.task_completion_pct}% · ${metrics.tasks_done_today} today`}
        />
        <Stat label="Reflections (7d)" value={`${metrics.reflections_7d}`} />
        <Stat
          label="Avg energy"
          value={metrics.avg_energy_7d ? `${metrics.avg_energy_7d}/5` : "—"}
        />
        <Stat
          label="Rescue (7d)"
          value={`${metrics.rescue_signals_7d}`}
          sub={metrics.most_recent_rescue ?? undefined}
        />
        <Stat
          label="Plan"
          value={metrics.plan_b_active ? "Plan B" : "Plan A"}
          sub={metrics.plan_b_active ? "softened today" : undefined}
        />
        <Stat
          label="Forge modules"
          value={`${metrics.forge_modules_active}`}
          sub={`${metrics.forge_entries_7d} runs / 7d`}
        />
        <Stat label="Active goal" value={state.active_goal.status} />
        <Stat
          label="Top signal"
          value={
            metrics.most_common_feedback
              ? FEEDBACK_LABELS[metrics.most_common_feedback as keyof typeof FEEDBACK_LABELS] ??
                metrics.most_common_feedback
              : "—"
          }
          sub={
            metrics.most_common_feedback ? `${metrics.most_common_feedback_count}×` : undefined
          }
        />
      </section>

      {metrics.feedback_total > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Task feedback patterns
          </div>
          <div className="mt-3 space-y-2">
            {FEEDBACK_OPTIONS.map((opt) => {
              const c = metrics.feedback_breakdown[opt] ?? 0;
              const pct = metrics.feedback_total > 0 ? (c / metrics.feedback_total) * 100 : 0;
              if (c === 0) return null;
              return (
                <div key={opt}>
                  <div className="flex items-center justify-between text-xs">
                    <span>{FEEDBACK_LABELS[opt]}</span>
                    <span className="text-muted-foreground">{c}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Honest signals
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {metrics.task_completion_pct < 30 && metrics.tasks_total > 3 && (
            <li>↘ You're starting more than you're finishing. Try shrinking tasks.</li>
          )}
          {(metrics.feedback_breakdown.too_big ?? 0) > 1 && (
            <li>
              ⚠ You've flagged tasks as "too big" {metrics.feedback_breakdown.too_big}× — Tune
              chips already shrunk them. Watch if it sticks.
            </li>
          )}
          {metrics.rescue_signals_7d >= 2 && (
            <li>↘ Rescue fired {metrics.rescue_signals_7d}× this week — capacity is the constraint.</li>
          )}
          {metrics.reflections_7d >= 5 && <li>✓ Strong reflection streak this week.</li>}
          {metrics.avg_energy_7d > 0 && metrics.avg_energy_7d < 2.5 && (
            <li>↘ Your energy has been low. Rescue → "I'm wiped out" might help.</li>
          )}
          {metrics.tasks_done === 0 && metrics.tasks_total === 0 && (
            <li>Nothing tracked yet. Start with one task in Plan.</li>
          )}
          {metrics.forge_modules_active > 0 && metrics.forge_entries_7d === 0 && (
            <li>
              ⚠ {metrics.forge_modules_active} Forge module{metrics.forge_modules_active > 1 ? "s" : ""}{" "}
              active but no entries this week. They're not earning their place yet.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
};

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
    {sub && <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>}
  </div>
);

export default Audit;
