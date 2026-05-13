import { useMemo, useState, useEffect } from "react";
import { Check, Plus, X } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { FeedbackChips } from "@/components/app/FeedbackChips";
import { AIInsight } from "@/components/app/AIInsight";
import { useAI } from "@/lib/ai/useAI";
import type { ExecutionFeedbackItem } from "@/lib/types";

type Filter = "all" | "pending" | "completed";

const DONE_FEEDBACK = [
  { key: "easy" as const, label: "Easy" },
  { key: "hard" as const, label: "Tough" },
  { key: "valuable" as const, label: "Moved my goal" },
  { key: "not_relevant" as const, label: "Not sure it helped" },
];

function DoneFeedback({
  taskId,
  taskTitle,
  onDone,
}: {
  taskId: string;
  taskTitle: string;
  onDone: () => void;
}) {
  const dispatch = useStateStore((s) => s.dispatch);

  useEffect(() => {
    const t = setTimeout(onDone, 8000);
    return () => clearTimeout(t);
  }, [onDone]);

  const pick = (fb: ExecutionFeedbackItem["feedback"]) => {
    dispatch({
      type: "feedback/add",
      payload: {
        id: crypto.randomUUID(),
        task_id: taskId,
        task_title: taskTitle,
        completed_at: new Date().toISOString(),
        feedback: fb,
        note: "",
        created_at: new Date().toISOString(),
        source: "task",
        target_id: taskId,
      },
    });
    onDone();
  };

  return (
    <div className="mt-2 pb-1 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] text-muted-foreground mr-1">How was it?</span>
      {DONE_FEEDBACK.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => pick(key)}
          className="rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          {label}
        </button>
      ))}
      <button
        onClick={onDone}
        className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
        aria-label="Skip feedback"
      >
        skip
      </button>
    </div>
  );
}

const Tasks = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [filter, setFilter] = useState<Filter>("all");
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const suggest = useAI<{
    tasks: Array<{
      title: string;
      estimated_minutes: number;
      category: string;
      priority: string;
      why?: string;
    }>;
  }>("suggest_tasks");

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
    return (
      <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">
        Loading…
      </div>
    );

  const toggle = (id: string) => {
    const t = tasks.find((x) => x.id === id);
    if (!t) return;
    if (t.status === "done") {
      dispatch({
        type: "task/update",
        payload: { id, changes: { status: "pending", completed_at: "" } },
      });
    } else {
      dispatch({
        type: "task/complete",
        payload: { id, completed_at: new Date().toISOString() },
      });
      setJustCompletedId(id);
    }
  };

  const addManualTask = () => {
    const title = newTaskTitle.trim();
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
        estimated_minutes: 30,
        category: "goal_direct",
        created_at: new Date().toISOString(),
        completed_at: "",
        due_date: "",
        created_by: "user",
      },
    });
    setNewTaskTitle("");
  };

  const addSuggested = (t: {
    title: string;
    estimated_minutes: number;
    category: string;
    priority: string;
  }) => {
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
      },
    });
  };

  const pendingCount = tasks.filter(
    (t) => t.status !== "done" && t.status !== "skipped",
  ).length;
  const doneCount = tasks.filter((t) => t.status === "done").length;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <div className="text-xs text-muted-foreground">/ tasks</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Everything on your list
        </h1>
        <p className="mt-1 text-xs text-muted-foreground">
          {pendingCount} pending · {doneCount} done
        </p>
      </div>

      {/* Manual add form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addManualTask();
        }}
        className="flex gap-2"
      >
        <input
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Add a task…"
          className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          disabled={!newTaskTitle.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </form>

      {/* Filter tabs */}
      <div className="inline-flex rounded-lg border border-border bg-card p-1">
        {(["all", "pending", "completed"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-xs capitalize transition-colors ${
              filter === f
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* AI suggestions */}
      <AIInsight
        label="ai task suggestions"
        loading={suggest.loading}
        error={suggest.error}
        onRun={() =>
          suggest.run({
            tasks: tasks.map((t) => ({ title: t.title, status: t.status })),
          })
        }
        cta={suggest.result ? "Refresh" : "Suggest"}
      >
        {suggest.result?.tasks?.length ? (
          <ul className="space-y-2">
            {suggest.result.tasks.map((t, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5"
              >
                <div className="flex-1">
                  <div className="text-sm font-medium">{t.title}</div>
                  {t.why && (
                    <div className="text-xs text-muted-foreground">{t.why}</div>
                  )}
                  <div className="mt-1 flex gap-1.5 text-[10px] text-muted-foreground">
                    <span>{t.estimated_minutes}m</span>·
                    <span>{t.priority}</span>·<span>{t.category}</span>
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

      {/* Task list */}
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {visible.map((t) => {
          const done = t.status === "done";
          const isAI = t.created_by === "ai";
          const isJustDone = justCompletedId === t.id;

          return (
            <li
              key={t.id}
              className={`px-4 py-3 transition-colors ${done ? "bg-secondary/30" : ""}`}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => toggle(t.id)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                    done
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-primary/60"
                  }`}
                  aria-label={done ? "Mark incomplete" : "Mark complete"}
                >
                  {done && <Check className="h-3 w-3" strokeWidth={3} />}
                </button>
                <span
                  className={`flex-1 text-sm ${
                    done
                      ? "text-muted-foreground/60 line-through"
                      : "text-foreground"
                  }`}
                >
                  {t.title}
                </span>
                <div className="flex items-center gap-1.5">
                  {isAI && (
                    <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-primary/70">
                      AI
                    </span>
                  )}
                  {!done && t.priority === "high" && (
                    <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-amber-400">
                      high
                    </span>
                  )}
                  {done && t.completed_at && (
                    <span className="text-[10px] text-muted-foreground/60">
                      done {new Date(t.completed_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </span>
                  )}
                  {!done && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                      {t.estimated_minutes}m
                    </span>
                  )}
                  {!done && (
                    <FeedbackChips
                      source="task"
                      targetId={t.id}
                      taskId={t.id}
                      taskTitle={t.title}
                      compact
                    />
                  )}
                </div>
              </div>
              {isJustDone && (
                <DoneFeedback
                  taskId={t.id}
                  taskTitle={t.title}
                  onDone={() => setJustCompletedId(null)}
                />
              )}
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            {filter === "completed" ? "No completed tasks yet." : "All clear here."}
          </li>
        )}
      </ul>
    </div>
  );
};

export default Tasks;
