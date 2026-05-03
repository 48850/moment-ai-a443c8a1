import { useMemo, useState } from "react";
import { Check, Plus } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { FeedbackChips } from "@/components/app/FeedbackChips";
import { AIInsight } from "@/components/app/AIInsight";
import { useAI } from "@/lib/ai/useAI";

type Filter = "all" | "pending" | "completed";

const Tasks = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [filter, setFilter] = useState<Filter>("all");
  const suggest = useAI<{ tasks: Array<{ title: string; estimated_minutes: number; category: string; priority: string; why?: string }> }>("suggest_tasks");

  const tasks = state?.tasks ?? [];

  const visible = useMemo(
    () =>
      tasks.filter((t) => {
        if (filter === "all") return true;
        if (filter === "completed") return t.status === "done";
        return t.status !== "done" && t.status !== "skipped";
      }),
    [tasks, filter],
  );

  if (!state)
    return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;

  const toggle = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    if (t.status === "done") {
      dispatch({ type: "task/update", payload: { id, changes: { status: "pending", completed_at: "" } } });
    } else {
      dispatch({ type: "task/complete", payload: { id, completed_at: new Date().toISOString() } });
    }
  };

  const addSuggested = (t: { title: string; estimated_minutes: number; category: string; priority: string }) => {
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
      },
    });
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <div className="text-xs text-muted-foreground">/ tasks</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Everything on your list</h1>
      </div>

      <div className="inline-flex rounded-lg border border-border bg-card p-1">
        {(["all", "pending", "completed"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-xs capitalize transition-colors ${
              filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <AIInsight
        label="ai task suggestions"
        loading={suggest.loading}
        error={suggest.error}
        onRun={() => suggest.run({ tasks: tasks.map(t => ({ title: t.title, status: t.status })) })}
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
                <span className={`flex-1 text-sm ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {t.title}
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                  {t.estimated_minutes}m
                </span>
                <FeedbackChips source="task" targetId={t.id} taskId={t.id} taskTitle={t.title} compact />
              </div>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">All clear here.</li>
        )}
      </ul>
    </div>
  );
};

export default Tasks;
