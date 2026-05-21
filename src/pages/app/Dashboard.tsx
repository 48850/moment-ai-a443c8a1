import { useEffect, useMemo, useState } from "react";
import { Check, Clock, ExternalLink, NotebookPen, Plus, Sparkles, X } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { selectHomeViewModel } from "@/lib/selectors/home";
import { JourneyConstellation } from "@/components/app/JourneyConstellation";
import { FeedbackChips } from "@/components/app/FeedbackChips";
import { PatternBanner } from "@/components/app/PatternBanner";
import { AIInsight } from "@/components/app/AIInsight";
import { useAI } from "@/lib/ai/useAI";
import { DoneCheckIn } from "@/components/app/DoneCheckIn";
import { COMPLIMENTS } from "@/components/app/StreakFlame";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { toast } from "sonner";
import { QuickReviewNotes } from "@/components/app/QuickReviewNotes";
import type { Task } from "@/lib/types";

type SavedNoteReview = {
  headline: string;
  key_insights: string[];
  gaps?: string[];
  mini_lesson: { title: string; body: string };
  next_step: string;
};

const Dashboard = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [checkInTask, setCheckInTask] = useState<Task | null>(null);
  const [notesTaskId, setNotesTaskId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const rationale = useAI<{ why_now: string; next_proof?: string }>("next_move_rationale");

  const vm = state ? selectHomeViewModel(state) : null;
  const dm = vm?.decisiveMove;

  const notesTask = useMemo(
    () => (notesTaskId ? state?.tasks.find((t) => t.id === notesTaskId) ?? null : null),
    [notesTaskId, state?.tasks],
  );

  useEffect(() => {
    if (dm && state?.active_goal?.statement && !rationale.loading) {
      rationale.run({ task: { title: dm.title, estimated_minutes: dm.estimatedMinutes } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dm?.id]);

  if (!state || !vm) return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;

  const onComplete = (id: string) => {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    if (t.status === "done") {
      dispatch({ type: "task/update", payload: { id, changes: { status: "pending", completed_at: "" } } });
    } else {
      const completedAt = new Date().toISOString();
      dispatch({ type: "task/complete", payload: { id, completed_at: completedAt } });
      setCheckInTask({ ...t, status: "done", completed_at: completedAt });
      window.dispatchEvent(new CustomEvent("streak:burst"));
      const msg = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];
      toast.success(msg, { duration: 2400, icon: "🔥" });
    }
  };

  const addNoteToTask = (taskId: string, content: string) => {
    const text = content.trim();
    if (!text) return;
    const target = state.tasks.find((t) => t.id === taskId);
    if (!target) return;
    dispatch({
      type: "task/update",
      payload: {
        id: taskId,
        changes: {
          notes: [
            ...(target.notes ?? []),
            { id: crypto.randomUUID(), content: text, created_at: new Date().toISOString() },
          ],
        },
      },
    });
    setNoteDraft("");
  };

  const removeNoteFromTask = (taskId: string, noteId: string) => {
    const target = state.tasks.find((t) => t.id === taskId);
    if (!target) return;
    dispatch({
      type: "task/update",
      payload: {
        id: taskId,
        changes: { notes: (target.notes ?? []).filter((n) => n.id !== noteId) },
      },
    });
  };

  const dmTask = dm ? state.tasks.find((t) => t.id === dm.id) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="text-xs text-muted-foreground">{vm.greeting}</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {state.profile.display_name ? `Hey ${state.profile.display_name}` : "Hey"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Here's the one move that matters most right now.</p>
      </div>

      <PatternBanner />

      <JourneyConstellation state={state} />

      {/* Decisive move */}
      {dm && (
        <section className="rounded-2xl border border-primary/40 bg-gradient-to-b from-primary/10 to-transparent p-5 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
            <Sparkles className="h-3 w-3" /> your next move
          </div>
          <h2 className="mt-2 text-xl font-semibold leading-tight">{dm.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {rationale.result?.why_now ?? <>Why this? It moves you toward <span className="text-foreground">{vm.goalSnippet}</span>.</>}
          </p>
          {rationale.result?.next_proof && (
            <p className="mt-1 text-xs text-muted-foreground">Unlocks: <span className="text-foreground">{rationale.result.next_proof}</span></p>
          )}
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> about {dm.estimatedMinutes} min
          </div>
          {dmTask?.resource_url && (
            <a
              href={dmTask.resource_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {dmTask.resource_label || "Open source"}
            </a>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              onClick={() => onComplete(dm.id)}
              className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Done ✓
            </button>
            <button
              onClick={() => { setNotesTaskId(dm.id); setNoteDraft(""); }}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-background/40 px-3 py-2 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"
            >
              <NotebookPen className="h-3 w-3" />
              Notes
              {(dmTask?.notes?.length ?? 0) > 0 && (
                <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                  {dmTask!.notes!.length}
                </span>
              )}
            </button>
            <FeedbackChips source="home" targetId={dm.id} taskId={dm.id} taskTitle={dm.title} />
          </div>
        </section>
      )}

      {/* Why this mattered */}
      {vm.whyThisMattered.populated && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> why that mattered
          </div>
          <div className="mt-2 text-sm font-medium">{vm.whyThisMattered.taskTitle}</div>
          <p className="mt-2 text-sm text-muted-foreground">{vm.whyThisMattered.rationale}</p>
          {vm.whyThisMattered.nextProof && (
            <div className="mt-3 text-xs">
              <span className="text-muted-foreground">What's next: </span>
              <span className="text-foreground">{vm.whyThisMattered.nextProof}</span>
            </div>
          )}
        </section>
      )}

      {/* Task list */}
      <section>
        <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Today</div>
        <ul className="space-y-3">
          {vm.tasks.map((t) => {
            const done = t.status === "done";
            return (
              <li
                key={t.id}
                className="rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => onComplete(t.id)}
                    className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      done ? "border-primary bg-primary text-primary-foreground" : "border-border hover:border-primary/50"
                    }`}
                    aria-label={done ? "Mark incomplete" : "Mark complete"}
                  >
                    {done && <Check className="h-3 w-3" strokeWidth={3} />}
                  </button>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className={`text-sm font-medium leading-snug ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                        {t.title}
                      </h3>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                        {t.estimated_minutes}m
                      </span>
                    </div>

                    {t.why_now && !done && (
                      <p className="text-xs leading-relaxed text-muted-foreground">{t.why_now}</p>
                    )}

                    {t.proof_of_completion && !done && (
                      <div className="flex items-start gap-1.5 text-[11px] text-emerald-500/80">
                        <Sparkles className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{t.proof_of_completion}</span>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        onClick={() => onComplete(t.id)}
                        className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        {done ? "Mark incomplete" : "Done ✓"}
                      </button>
                      <button
                        onClick={() => { setNotesTaskId(t.id); setNoteDraft(""); }}
                        className="inline-flex items-center gap-1 rounded-md border border-border bg-background/40 px-2 py-1.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary"
                      >
                        <NotebookPen className="h-3 w-3" />
                        Notes
                        {(t.notes?.length ?? 0) > 0 && (
                          <span className="ml-0.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                            {t.notes!.length}
                          </span>
                        )}
                      </button>
                      {t.resource_url && (
                        <a
                          href={t.resource_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-border bg-background/40 px-2 py-1.5 text-[11px] text-primary hover:border-primary/40"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {t.resource_label || "Open source"}
                        </a>
                      )}
                      <FeedbackChips source="task" targetId={t.id} taskId={t.id} taskTitle={t.title} compact />
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <DoneCheckIn task={checkInTask} onClose={() => setCheckInTask(null)} />

      <Sheet
        open={!!notesTaskId}
        onOpenChange={(open) => {
          if (!open) {
            setNotesTaskId(null);
            setNoteDraft("");
          }
        }}
      >
        <SheetContent side="right" className="flex w-full flex-col gap-4 sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="text-base">Notes</SheetTitle>
            <SheetDescription className="line-clamp-2 text-xs">
              {notesTask?.title ?? "Task notes"}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 space-y-2 overflow-y-auto pr-1">
            {(notesTask?.notes ?? []).length === 0 ? (
              <p className="rounded-md border border-dashed border-border bg-background/40 p-4 text-center text-xs text-muted-foreground">
                No notes yet. Capture what you learned, what got in the way, or what to try next.
              </p>
            ) : (
              [...(notesTask?.notes ?? [])]
                .sort((a, b) => b.created_at.localeCompare(a.created_at))
                .map((n) => (
                  <div
                    key={n.id}
                    className="group relative rounded-md border border-border bg-card p-3 text-sm"
                  >
                    <p className="whitespace-pre-wrap pr-6 leading-relaxed">{n.content}</p>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                    </div>
                    <button
                      onClick={() => notesTask && removeNoteFromTask(notesTask.id, n.id)}
                      className="absolute right-1.5 top-1.5 rounded-md p-1 text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-secondary hover:text-destructive"
                      aria-label="Delete note"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (notesTask) addNoteToTask(notesTask.id, noteDraft);
            }}
            className="space-y-2 border-t border-border pt-3"
          >
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Write a note for this task…"
              rows={3}
              className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none"
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!noteDraft.trim()}
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                <Plus className="h-3 w-3" /> Add note
              </button>
            </div>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default Dashboard;
