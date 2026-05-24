import { useState } from "react";
import { Clock } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { selectHomeViewModel } from "@/lib/selectors/home";
import { DoneCheckIn } from "@/components/app/DoneCheckIn";
import { toast } from "sonner";
import type { Task } from "@/lib/types";

/**
 * Moment Core v1 — Today.
 *
 * One obvious next move. Done. Not this. That's it.
 * No constellation. No path/mission dashboard. No analytics. No task list
 * masquerading as "Today". The "also today" footnote is optional + tiny.
 *
 * Acceptance: user opens app and sees the next move without scrolling.
 */
const Dashboard = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [checkInTask, setCheckInTask] = useState<Task | null>(null);

  const vm = state ? selectHomeViewModel(state) : null;
  const dm = vm?.decisiveMove;

  if (!state || !vm) {
    return <div className="mx-auto max-w-xl py-12 text-sm text-muted-foreground">Loading…</div>;
  }

  const dmTask = dm ? state.tasks.find((t) => t.id === dm.id) ?? null : null;
  const alsoToday = vm.tasks.filter((t) => t.id !== dm?.id && t.status !== "done");

  const onDone = () => {
    if (!dmTask) return;
    const completedAt = new Date().toISOString();
    dispatch({ type: "task/complete", payload: { id: dmTask.id, completed_at: completedAt } });
    setCheckInTask({ ...dmTask, status: "done", completed_at: completedAt });
  };

  const onNotThis = () => {
    if (!dmTask) return;
    dispatch({
      type: "task/update",
      payload: { id: dmTask.id, changes: { status: "skipped" } as Partial<Task> },
    });
    toast("Skipped — I'll surface a different next move.", { duration: 1800 });
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-160px)] max-w-xl flex-col justify-center space-y-6">
      <div>
        <div className="text-xs text-muted-foreground">{vm.greeting}</div>
        <h1 className="mt-1 font-display text-2xl font-medium tracking-tight">
          {state.profile.display_name ? `Hey ${state.profile.display_name}.` : "Hey."}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Here's the one move that matters now.</p>
      </div>

      {dm ? (
        <section className="rounded-2xl border border-primary/40 bg-gradient-to-b from-primary/10 to-transparent p-6">
          <h2 className="text-xl font-semibold leading-snug">{dm.title}</h2>

          {state.last_adaptation?.summary && state.last_adaptation.from_task_id !== dm.id && (
            <p className="mt-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs leading-relaxed">
              <span className="mr-1 font-medium uppercase tracking-[0.14em] text-primary">Why this changed →</span>
              {state.last_adaptation.summary}
            </p>
          )}

          {dmTask?.why_now && (
            <p className="mt-3 text-sm text-muted-foreground">{dmTask.why_now}</p>
          )}

          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> about {dm.estimatedMinutes} min
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <button
              onClick={onDone}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Done ✓
            </button>
            <button
              onClick={onNotThis}
              className="rounded-lg border border-border bg-background/40 px-4 py-2.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
            >
              Not this
            </button>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-border bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Nothing queued. Open Coach to set the next move.
          </p>
        </section>
      )}

      {alsoToday.length > 0 && (
        <p className="text-center text-[11px] text-muted-foreground/70">
          Also today: {alsoToday.slice(0, 3).map((t) => t.title).join(" · ")}
          {alsoToday.length > 3 ? ` · +${alsoToday.length - 3}` : ""}
        </p>
      )}

      <DoneCheckIn task={checkInTask} onClose={() => setCheckInTask(null)} />
    </div>
  );
};

export default Dashboard;
