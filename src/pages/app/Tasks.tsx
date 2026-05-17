import { useMemo, useState } from "react";
import { Check, Plus, Sparkles, Trash2, User as UserIcon, Zap, Loader2, ExternalLink, NotebookPen, X } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { FeedbackChips } from "@/components/app/FeedbackChips";
import { AIInsight } from "@/components/app/AIInsight";
import { useAI } from "@/lib/ai/useAI";
import { DoneCheckIn } from "@/components/app/DoneCheckIn";
import type { Task } from "@/lib/types";
import { COMPLIMENTS } from "@/components/app/StreakFlame";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";

type Filter = "all" | "pending" | "completed";

type SuggestedTask = {
  title: string;
  estimated_minutes: number;
  category: string;
  priority: string;
  why_now?: string;
  proof_of_completion?: string;
  user_stage_fit?: string;
  resource_url?: string;
  resource_label?: string;
};

type RefinedTask = {
  refined_title: string;
  why_now: string;
  proof_of_completion: string;
  estimated_minutes: number;
  priority: "high" | "medium" | "low";
  category: Task["category"];
  resource_url?: string;
  resource_label?: string;
};

function normaliseTaskTitle(title: unknown): string {
  if (typeof title === "string" && title.trim()) return title.trim();
  if (title && typeof title === "object") {
    const r = title as Record<string, unknown>;
    for (const key of ["title", "name", "label"]) {
      const v = r[key];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return "Untitled task";
}

function inferCategory(title: string): Task["category"] {
  const t = title.toLowerCase();
  if (/study|revise|review|read|learn|memoris|recall|flash/.test(t)) return "discovery";
  if (/practice|drill|quiz|exercise|test yourself/.test(t)) return "goal_direct";
  if (/write|essay|draft|report|document/.test(t)) return "goal_direct";
  if (/map|plan|prereq|pathway|subject|confirm/.test(t)) return "bottleneck_removal";
  return "goal_direct";
}

const Tasks = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [filter, setFilter] = useState<Filter>("all");
  const [composer, setComposer] = useState("");
  const [composerMins, setComposerMins] = useState(30);
  const [checkInTask, setCheckInTask] = useState<Task | null>(null);
  const [refiningIds, setRefiningIds] = useState<Set<string>>(new Set());
  const [notesTaskId, setNotesTaskId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const suggest = useAI<{ tasks: SuggestedTask[] }>("suggest_tasks");
  const refine = useAI<RefinedTask>("refine_user_task");

  const tasks = state?.tasks ?? [];
  const goalText = state?.active_goal?.statement ?? "";
  const currentStage = state?.active_goal?.current_stage ?? "";
  const educationSystem = state?.profile?.education_system ?? "";
  const country = state?.profile?.country ?? "";
  const schoolYear = state?.profile?.school_year ?? "";

  const sections = useMemo(() => {
    const pending: Task[] = [];
    const completed: Task[] = [];
    for (const t of tasks) {
      if (t.status === "done") completed.push(t);
      else if (t.status === "skipped") continue;
      else pending.push(t);
    }
    completed.sort((a, b) => (b.completed_at || "").localeCompare(a.completed_at || ""));
    return { pending, completed };
  }, [tasks]);

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
      setCheckInTask({ ...t, status: "done", completed_at: completedAt });
      // Fire flame burst + compliment
      window.dispatchEvent(new CustomEvent("streak:burst"));
      const msg = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];
      toast.success(msg, { duration: 2400, icon: "🔥" });
    }
  };

  const removeTask = (id: string) => {
    if (!confirm("Remove this task?")) return;
    dispatch({ type: "task/delete", payload: { id } });
  };

  // Pick the first 30+ min open slot tomorrow between 16:00 and 21:30.
  const scheduleIntoWeek = (title: string, mins: number) => {
    if (!state) return;
    const JS_TO_IDX = [6, 0, 1, 2, 3, 4, 5]; // Sun..Sat -> Mon..Sun index
    const today = JS_TO_IDX[new Date().getDay()];
    const tomorrow = (today + 1) % 7;
    const dayBlocks = (state.schedule_state.week_plan ?? [])
      .filter((b) => b.day_index === tomorrow)
      .map((b) => {
        const [sh, sm] = b.start_time.split(":").map(Number);
        const [eh, em] = b.end_time.split(":").map(Number);
        return { start: sh * 60 + sm, end: eh * 60 + em };
      })
      .sort((a, b) => a.start - b.start);
    const duration = Math.max(15, Math.min(120, mins));
    let startMin = 16 * 60;
    const latestStart = 21 * 60 + 30 - duration;
    for (let probe = startMin; probe <= latestStart; probe += 15) {
      const end = probe + duration;
      const overlaps = dayBlocks.some((b) => probe < b.end && end > b.start);
      if (!overlaps) { startMin = probe; break; }
      startMin = probe + 15;
    }
    if (startMin > latestStart) startMin = 21 * 60 + 30 - duration;
    const endMin = startMin + duration;
    const fmt = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    dispatch({
      type: "week/addBlock",
      payload: {
        id: `wb_${Math.random().toString(36).slice(2, 10)}`,
        day_index: tomorrow,
        start_time: fmt(startMin),
        end_time: fmt(endMin),
        title,
        category: "goal",
        notes: "",
        is_locked: false,
      },
    });
  };

  const refineUserTask = async (id: string, rawTitle: string, mins: number) => {
    setRefiningIds((s) => new Set(s).add(id));
    try {
      const result = await refine.run({
        raw_title: rawTitle,
        estimated_minutes: mins,
        priority: "medium",
        goal: goalText,
        current_stage: currentStage,
      });
      if (result && result.refined_title) {
        dispatch({
          type: "task/update",
          payload: {
            id,
            changes: {
              title: result.refined_title,
              why_now: result.why_now ?? "",
              proof_of_completion: result.proof_of_completion ?? "",
              estimated_minutes: result.estimated_minutes ?? mins,
              priority: result.priority ?? "medium",
              category: result.category ?? inferCategory(rawTitle),
              resource_url: result.resource_url ?? "",
              resource_label: result.resource_label ?? "",
            },
          },
        });
        scheduleIntoWeek(result.refined_title, result.estimated_minutes ?? mins);
      } else {
        scheduleIntoWeek(rawTitle, mins);
      }
    } finally {
      setRefiningIds((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
    }
  };

  const addManual = () => {
    const title = composer.trim();
    if (!title) return;
    const id = crypto.randomUUID();
    dispatch({
      type: "task/add",
      payload: {
        id,
        title,
        description: "",
        status: "pending",
        priority: "medium",
        goal_id: state?.active_goal?.id ?? "",
        domain_id: "",
        estimated_minutes: composerMins,
        category: inferCategory(title),
        created_at: new Date().toISOString(),
        completed_at: "",
        due_date: "",
        created_by: "user",
        why_now: "",
      } as Task,
    });
    setComposer("");
    setComposerMins(30);
    // Fire-and-forget AI refinement so the task syncs with the goal and plan.
    if (goalText) void refineUserTask(id, title, composerMins);
  };

  const addSuggested = (t: SuggestedTask) => {
    dispatch({
      type: "task/add",
      payload: {
        id: crypto.randomUUID(),
        title: normaliseTaskTitle(t.title),
        description: "",
        status: "pending",
        priority: (t.priority as "high" | "medium" | "low") ?? "medium",
        goal_id: state?.active_goal?.id ?? "",
        domain_id: "",
        estimated_minutes: t.estimated_minutes ?? 30,
        category: (t.category as Task["category"]) ?? "goal_direct",
        created_at: new Date().toISOString(),
        completed_at: "",
        due_date: "",
        created_by: "ai",
        why_now: t.why_now ?? "",
        proof_of_completion: t.proof_of_completion ?? "",
        resource_url: t.resource_url ?? "",
        resource_label: t.resource_label ?? "",
      } as Task,
    });
  };

  const notesTask = useMemo(
    () => (notesTaskId ? tasks.find((t) => t.id === notesTaskId) ?? null : null),
    [notesTaskId, tasks],
  );

  const addNoteToTask = (taskId: string, content: string) => {
    const text = content.trim();
    if (!text) return;
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;
    const existing = target.notes ?? [];
    dispatch({
      type: "task/update",
      payload: {
        id: taskId,
        changes: {
          notes: [
            ...existing,
            { id: crypto.randomUUID(), content: text, created_at: new Date().toISOString() },
          ],
        },
      },
    });
    setNoteDraft("");
  };

  const removeNoteFromTask = (taskId: string, noteId: string) => {
    const target = tasks.find((t) => t.id === taskId);
    if (!target) return;
    dispatch({
      type: "task/update",
      payload: {
        id: taskId,
        changes: { notes: (target.notes ?? []).filter((n) => n.id !== noteId) },
      },
    });
  };

  const visible: Task[] =
    filter === "all"
      ? [...sections.pending, ...sections.completed]
      : filter === "pending"
        ? sections.pending
        : sections.completed;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
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
          {goalText
            ? "We'll refine the wording, tie it to your goal, and sync it into your plan."
            : "Set a goal in Chat to unlock auto-refinement and plan sync."}
        </p>
      </div>

      {/* Section counts / filter */}
      <div className="sticky top-0 z-10 -mx-1 flex items-center gap-3 bg-background/95 px-1 py-2 text-[11px] backdrop-blur">
        {(["all", "pending", "completed"] as Filter[]).map((f) => {
          const count =
            f === "all"
              ? sections.pending.length + sections.completed.length
              : f === "pending"
                ? sections.pending.length
                : sections.completed.length;
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
        onRun={() =>
          suggest.run({
            goal: goalText,
            current_stage: currentStage,
            education_system: educationSystem,
            country,
            school_year: schoolYear,
            existing_tasks: tasks.map((t) => ({ title: t.title, status: t.status })),
          })
        }
        cta={suggest.result ? "Refresh" : "Suggest"}
      >
        {suggest.result?.tasks?.length ? (
          <ul className="space-y-2">
            {suggest.result.tasks.map((t, i) => (
              <li key={i} className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5">
                <div className="flex-1">
                  <div className="text-sm font-medium">{normaliseTaskTitle(t.title)}</div>
                  {t.why_now && <div className="mt-0.5 text-xs text-muted-foreground">{t.why_now}</div>}
                  {t.proof_of_completion && (
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-emerald-500/80">
                      <Zap className="h-2.5 w-2.5" />
                      {t.proof_of_completion}
                    </div>
                  )}
                  {t.resource_url && (
                    <a
                      href={t.resource_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 inline-flex items-center gap-1 text-[10px] text-primary underline-offset-2 hover:underline"
                    >
                      <ExternalLink className="h-2.5 w-2.5" />
                      {t.resource_label || "Open link"}
                    </a>
                  )}
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
          const byUser = (t.created_by ?? "user") === "user";
          const isRefining = refiningIds.has(t.id);
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
                  {isRefining && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> refining
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
                <button
                  onClick={() => removeTask(t.id)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-destructive"
                  aria-label="Remove task"
                  title="Remove task"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              {t.why_now && !done && (
                <p className="mt-1 pl-8 text-[11px] text-muted-foreground">{t.why_now}</p>
              )}
              {t.proof_of_completion && !done && (
                <p className="mt-0.5 pl-8 flex items-center gap-1 text-[10px] text-emerald-500/70">
                  <Zap className="h-2.5 w-2.5 shrink-0" />
                  {t.proof_of_completion}
                </p>
              )}
              {t.resource_url && !done && (
                <a
                  href={t.resource_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-0.5 pl-8 flex items-center gap-1 text-[11px] text-primary underline-offset-2 hover:underline"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  {t.resource_label || t.resource_url}
                </a>
              )}
              <div className="mt-2 pl-8">
                <button
                  onClick={() => setNotesTaskId(t.id)}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-background/40 px-2 py-1 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary"
                >
                  <NotebookPen className="h-3 w-3" />
                  Notes
                  {(t.notes?.length ?? 0) > 0 && (
                    <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                      {t.notes!.length}
                    </span>
                  )}
                </button>
              </div>
            </li>
          );
        })}
        {visible.length === 0 && (
          <li className="px-4 py-8 text-center">
            {goalText ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">No next proof queued.</p>
                <button
                  onClick={() =>
                    suggest.run({
                      goal: goalText,
                      current_stage: currentStage,
                      education_system: educationSystem,
                      country,
                      school_year: schoolYear,
                      existing_tasks: tasks.map((t) => ({ title: t.title, status: t.status })),
                    })
                  }
                  className="rounded-md border border-primary/40 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10"
                >
                  Generate next proof
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">No goal set yet.</p>
                <p className="text-xs text-muted-foreground">Set your goal in Chat to start generating tasks.</p>
              </div>
            )}
          </li>
        )}
      </ul>

      <DoneCheckIn task={checkInTask} onClose={() => setCheckInTask(null)} />
    </div>
  );
};

export default Tasks;
