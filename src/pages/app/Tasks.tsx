import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { homeMock, planMock, type Task } from "@/lib/mockData";

type Filter = "all" | "pending" | "completed";

const allTasksSeed: Task[] = [
  ...homeMock.tasks,
  ...planMock.unscheduledTasks,
  { id: "x1", title: "Read 'Why Stanford' supplement examples (3)", status: "pending", estimated_minutes: 20 },
  { id: "x2", title: "Update activities list with robotics state result", status: "completed", estimated_minutes: 15 },
];

const Tasks = () => {
  const [tasks, setTasks] = useState<Task[]>(allTasksSeed);
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(
    () => tasks.filter((t) => (filter === "all" ? true : t.status === filter)),
    [tasks, filter],
  );

  const toggle = (id: string) =>
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status: t.status === "completed" ? "pending" : "completed" } : t)));

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
        {visible.map((t) => (
          <li key={t.id}>
            <button onClick={() => toggle(t.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                  t.status === "completed" ? "border-primary bg-primary text-primary-foreground" : "border-border"
                }`}
              >
                {t.status === "completed" && <Check className="h-3 w-3" strokeWidth={3} />}
              </span>
              <span className={`flex-1 text-sm ${t.status === "completed" ? "text-muted-foreground line-through" : "text-foreground"}`}>
                {t.title}
              </span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{t.estimated_minutes}m</span>
            </button>
          </li>
        ))}
        {visible.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing here yet.</li>
        )}
      </ul>
    </div>
  );
};

export default Tasks;
