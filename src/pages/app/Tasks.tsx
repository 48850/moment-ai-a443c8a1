import { useMemo, useState } from "react";
import { Check, Plus, Sparkles, User as UserIcon, AlertCircle } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { FeedbackChips } from "@/components/app/FeedbackChips";
import { AIInsight } from "@/components/app/AIInsight";
import { useAI } from "@/lib/ai/useAI";
import { DoneCheckIn } from "@/components/app/DoneCheckIn";
import type { Task } from "@/lib/types";

type Filter = "all" | "pending" | "completed" | "missed";

const Tasks = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [filter, setFilter] = useState<Filter>("all");
  const [composer, setComposer] = useState("");
  const [composerMins, setComposerMins] = useState(30);
  const [checkInTask, setCheckInTask] = useState<Task | null>(null);
  const suggest = useAI<{ tasks: Array<{ title: string; estimated_minutes: number; category: string; priority: string; why?: string }> }>("suggest_tasks");

  const tasks = state?.tasks ?? [];
  const goalText = state?.active_goal?.statement ?? "";

  // Pending = not done & not skipped & not past due
  // Missed = past due_date and still pending
  // Completed = done
  const today = new Date().toISOString().slice(0, 10);
  const sections = useMemo(() => {
    const pending: Task[] = [];
    const completed: Task[] = [];
    const missed: Task[] = [];
    for (const t of tasks) {
      if (t.status === "done") completed.push(t);
      else if (t.status === "skipped") continue;
      else if (t.due_date && t.due_date < today) missed.push(t);
      else pending.push(t);
    }
    completed.sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || ""));
    return { pending, completed, missed };
  }, [tasks, today]);

  if (!state)
    return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;

  const toggle = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    if (t.status === "done") {
      dispatch({ type: "task/update", payload: { id, changes: { status: "pending", completed_at: "" } } });
    } else {
      const completedAt = new Date().toISOString();
      dispatch({ type: "task/complete", payload: { id, completed_at: completedAt } });
      // Open the check-in immediately with the freshly completed task.
      setCheckInTask({ ...t, status: "done", completed_at: completedAt });
    }
  };

  const addManual = () => {
    const title = composer.trim();
    if (!title) return;
    dispatch({
      type: "task/add",
      payload: {
        id: crypto.randomUUID(),
        title,
        description: "",
        status: "pending",
        priority: "medium",
        goal_id: "primary",
        domain_id: "",
        estimated_minutes: composerMins,
        category: "goal_direct",
        created_at: new Date().toISOString(),
        completed_at: "",
        due_date: "",
        created_by: "user",
        why_now: goalText ? `User-added; tied to: ${goalText}` : "",
      } as Task,
    });
    setComposer("");
    setComposerMins(30);
  };

  const addSuggested = (t: { title: string; estimated_minutes: number; category: string; priority: string; why?: string }) => {
    dispatch({
      type: "task/add",
      payload: {
        id: crypto.randomUUID(),
        title: t.title,
        description: "",
        status: "pending",
        priority: (t.priority as "high" | "medium" | "low") ?? "medium",
        goal_id: "primary",
        domain_id: "",
        estimated_minutes: t.estimated_minutes ?? 30,
        category: (t.category as any) ?? "goal_direct",
        created_at: new Date().toISOString(),
        completed_at: "",
        due_date: "",
        created_by: "ai",
        why_now: t.why ?? "",
      } as Task,
    });
  };

  const visible: Task[] =
    filter === "all"
      ? [...sections.pending, ...sections.missed, ...sections.completed]
      : filter === "pending"
        ? sections.pending
        : filter === "completed"
          ? sections.completed
          : sections.missed;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <div className="text-xs text-muted-foreground">/ tasks</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Everything on your list</h1>
        {goalText && (
          <p className="mt-1 text-xs text-muted-foreground">
            Goal: <span className="text-foreground">{goalText}</span>
          </p>
        )}
      </div>

      {/* Manual composer */}
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <input
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addManual()}
            placeholder="Add your own task…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <input
            type="number"
            value={composerMins}
            min={5}
            step={5}
            onChange={(e) => setComposerMins(Math.max(5, Number(e.target.value) || 30))}
            className="w-16 rounded-md border border-border bg-background px-2 py-1 text-xs"
            aria-label="Estimated minutes"
          />
          <span className="text-[10px] text-muted-foreground">min</span>
          <button
            onClick={addManual}
            disabled={!composer.trim()}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-40"
          >
            Add
          </button>
        </div>
        <p className="mt-1.5 text-[10px] text-muted-foreground">
          Yours stay tagged as “you” and feed Chat, Plan and Mission.
        </p>
      </div>

      {/* Section counts / filter */}
      <div className="flex items-center gap-3 text-[11px]">
        {(["all", "pending", "completed", "missed"] as Filter[]).map((f) => {
          const count =
            f === "all"
              ? sections.pending.length + sections.missed.length + sections.completed.length
              : f === "pending"
                ? sections.pending.length
                : f === "completed"
                  ? sections.completed.length
                  : sections.missed.length;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1 capitalize transition-colors ${
                filter === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f} <span className="opacity-70">· {count}</span>
            </button>
          );
        })}
      </div>

      <AIInsight
        label="ai task suggestions"
        loading={suggest.loading}
        error={suggest.error}
        onRun={() => suggest.run({ tasks: tasks.map((t) => ({ title: t.title, status: t.status })) })}
        cta={suggest.result ? "Refresh" : "Suggest"}
      >
        {suggest.result?.tasks?.length ? (
          <ul className="space-y-2">
            {suggest.result.tasks.map((t, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5">
                <div className="flex-1">
                  <div className="text-sm font-medium">{t.title}</div>
                  {t.why && <div className="text-xs text-muted-foreground">{t.why}</div>}
                  <div className="mt-1 flex gap-1.5 text-[10px] text-muted-foreground">
                    <span>{t.estimated_minutes}m</span>·<span>{t.priority}</span>·<span>{t.category}</span>
                  </div>
                </div>
                <button
                  onClick={() => addSuggested(t)}
                  className="rounded-md border border-border bg-background p-1 hover:border-primary"
                  aria-label="Add"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </AIInsight>

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {visible.map((t) => {
          const done = t.status === "done";
          const isMissed = !done && t.due_date && t.due_date < today;
          const byUser = (t.created_by ?? "user") === "user";
          return (
            <li key={t.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggle(t.id)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    done ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                  aria-label={done ? "Mark incomplete" : "Mark complete"}
                >
                  {done && <Check className="h-3 w-3" strokeWidth={3} />}
                </button>
                <div className="flex flex-1 items-center gap-2">
                  <span className={`text-sm ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {t.title}
                  </span>
                  {isMissed && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-amber-400">
                      <AlertCircle className="h-2.5 w-2.5" />
                      missed
                    </span>
                  )}
                </div>
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-background/40 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground"
                  title={byUser ? "Added by you" : "Added by AI"}
                >
                  {byUser ? <UserIcon className="h-2.5 w-2.5" /> : <Sparkles className="h-2.5 w-2.5" />}
                  {byUser ? "you" : "ai"}
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                  {t.estimated_minutes}m
                </span>
                <FeedbackChips source="task" targetId={t.id} taskId={t.id} taskTitle={t.title} compact />
              </div>
              {t.why_now && !done && (
                <p className="mt-1 pl-8 text-[11px] text-muted-foreground">{t.why_now}</p>
              )}
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">All clear here.</li>
        )}
      </ul>

      <DoneCheckIn task={checkInTask} onClose={() => setCheckInTask(null)} />
    </div>
  );
};

export default Tasks;
