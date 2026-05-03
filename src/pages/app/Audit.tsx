import { useMemo } from "react";
import { useStateStore } from "@/stores/state-store";
import { computeGoalProgress } from "@/lib/engine/next-best-task";
import { FEEDBACK_OPTIONS } from "@/lib/state/schema";

const FEEDBACK_LABELS: Record<(typeof FEEDBACK_OPTIONS)[number], string> = {
  easy: "Easy", hard: "Hard", too_vague: "Too vague", too_big: "Too big",
  valuable: "Valuable", not_relevant: "Not relevant", need_help: "Need help", do_differently: "Do differently",
};

const Audit = () => {
  const state = useStateStore((s) => s.state);

  const stats = useMemo(() => {
    if (!state) return null;
    const tasks = state.tasks ?? [];
    const done = tasks.filter((t) => t.status === "done").length;
    const total = tasks.length;
    const reflections = state.reflections ?? [];
    const lastWeek = reflections.filter((r) => {
      const d = new Date(r.date).getTime();
      return Date.now() - d <= 7 * 86400000;
    });
    const avgEnergy = lastWeek.length
      ? Math.round((lastWeek.reduce((a, r) => a + r.energy_rating, 0) / lastWeek.length) * 10) / 10
      : 0;

    const fb = state.execution_feedback ?? [];
    const counts: Record<string, number> = {};
    fb.forEach((f) => { counts[f.feedback] = (counts[f.feedback] ?? 0) + 1; });

    return {
      goalProgress: computeGoalProgress(state),
      taskCompletion: total > 0 ? Math.round((done / total) * 100) : 0,
      tasksDone: done,
      tasksTotal: total,
      avgEnergy,
      reflectionStreak: lastWeek.length,
      feedbackCounts: counts,
      feedbackTotal: fb.length,
    };
  }, [state]);

  if (!state || !stats) return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <div className="text-xs text-muted-foreground">/ audit</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">How you're really doing</h1>
        <p className="mt-1 text-sm text-muted-foreground">An honest snapshot. No vanity metrics.</p>
      </div>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Stat label="Goal progress" value={`${stats.goalProgress}%`} />
        <Stat label="Tasks done" value={`${stats.tasksDone}/${stats.tasksTotal}`} sub={`${stats.taskCompletion}%`} />
        <Stat label="Reflections (7d)" value={`${stats.reflectionStreak}`} />
        <Stat label="Avg energy" value={stats.avgEnergy ? `${stats.avgEnergy}/5` : "—"} />
        <Stat label="Active goal" value={state.active_goal.status} />
        <Stat label="Plan" value={state.home.active_plan === "plan_b" ? "Plan B" : "Plan A"} />
      </section>

      {stats.feedbackTotal > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Task feedback patterns
          </div>
          <div className="mt-3 space-y-2">
            {FEEDBACK_OPTIONS.map((opt) => {
              const c = stats.feedbackCounts[opt] ?? 0;
              const pct = stats.feedbackTotal > 0 ? (c / stats.feedbackTotal) * 100 : 0;
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
          {stats.taskCompletion < 30 && stats.tasksTotal > 3 && (
            <li>↘ You're starting more than you're finishing. Try shrinking tasks.</li>
          )}
          {stats.feedbackCounts.too_big > 1 && (
            <li>⚠ You've flagged tasks as "too big" {stats.feedbackCounts.too_big}× — break them down in chat.</li>
          )}
          {stats.reflectionStreak >= 5 && <li>✓ Strong reflection streak this week.</li>}
          {stats.avgEnergy && stats.avgEnergy < 2.5 && (
            <li>↘ Your energy has been low. Rescue → "I'm wiped out" might help.</li>
          )}
          {stats.tasksDone === 0 && stats.tasksTotal === 0 && <li>Nothing tracked yet. Start with one task in Plan.</li>}
        </ul>
      </section>
    </div>
  );
};

const Stat = ({ label, value, sub }: { label: string; value: string; sub?: string }) => (
  <div className="rounded-xl border border-border bg-card p-4">
    <div className="text-xs text-muted-foreground">{label}</div>
    <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
    {sub && <div className="text-[10px] text-muted-foreground">{sub}</div>}
  </div>
);

export default Audit;
