import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { useStateStore } from "@/stores/state-store";

type Filter = "all" | "pending" | "completed";

const Tasks = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [filter, setFilter] = useState<Filter>("all");

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

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <div className="text-xs text-muted-foreground">/ tasks</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">All tasks</h1>
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

      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {visible.map((t) => {
          const done = t.status === "done";
          return (
            <li key={t.id}>
              <button
                onClick={() => toggle(t.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50"
              >
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                    done ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                >
                  {done && <Check className="h-3 w-3" strokeWidth={3} />}
                </span>
                <span
                  className={`flex-1 text-sm ${
                    done ? "text-muted-foreground line-through" : "text-foreground"
                  }`}
                >
                  {t.title}
                </span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                  {t.estimated_minutes}m
                </span>
              </button>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing here yet.</li>
        )}
      </ul>
    </div>
  );
};

export default Tasks;
