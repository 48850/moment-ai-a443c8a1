import { useEffect, useState } from "react";
import { Check, Clock, ExternalLink, NotebookPen, Sparkles } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { selectHomeViewModel } from "@/lib/selectors/home";
import { JourneyConstellation } from "@/components/app/JourneyConstellation";
import { FeedbackChips } from "@/components/app/FeedbackChips";
import { PatternBanner } from "@/components/app/PatternBanner";
import { AIInsight } from "@/components/app/AIInsight";
import { useAI } from "@/lib/ai/useAI";
import type { ExecutionFeedbackItem } from "@/lib/types";

const DONE_FEEDBACK = [
  { key: "easy" as const, label: "Easy" },
  { key: "hard" as const, label: "Tough" },
  { key: "valuable" as const, label: "Moved my goal" },
  { key: "not_relevant" as const, label: "Not sure it helped" },
];

function DmDoneFeedback({
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
    <div className="mt-3 flex flex-wrap items-center gap-1.5">
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

const Dashboard = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);
  const rationale = useAI<{ why_now: string; next_proof?: string }>("next_move_rationale");

  const vm = state ? selectHomeViewModel(state) : null;
  const dm = vm?.decisiveMove;

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
      setJustCompletedId(null);
    } else {
      dispatch({ type: "task/complete", payload: { id, completed_at: new Date().toISOString() } });
      setJustCompletedId(id);
    }
  };

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
          {state.tasks.find((t) => t.id === dm.id)?.resource_url && (
            <a
              href={state.tasks.find((t) => t.id === dm.id)?.resource_url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
              {state.tasks.find((t) => t.id === dm.id)?.resource_label || "Open source"}
            </a>
          )}

          {justCompletedId === dm.id ? (
            <DmDoneFeedback
              taskId={dm.id}
              taskTitle={dm.title}
              onDone={() => setJustCompletedId(null)}
            />
          ) : (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <button
                onClick={() => onComplete(dm.id)}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Done ✓
              </button>
              <FeedbackChips source="home" targetId={dm.id} taskId={dm.id} taskTitle={dm.title} />
            </div>
          )}
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
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {vm.tasks.map((t) => {
            const done = t.status === "done";
            const expanded = expandedId === t.id;
            const showFeedback = justCompletedId === t.id;
            const hasDetail = !!t.resource_url || (t.notes?.length ?? 0) > 0;
            return (
              <li key={t.id} className="px-4 py-3">
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : t.id)}
                  className="flex w-full items-center gap-3 text-left"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                      done ? "border-primary bg-primary text-primary-foreground" : "border-border"
                    }`}
                    aria-hidden
                  >
                    {done && <Check className="h-3 w-3" strokeWidth={3} />}
                  </span>
                  <span className={`flex-1 text-sm ${done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                    {t.title}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                    {t.estimated_minutes}m
                  </span>
                </button>

                {expanded && (
                  <div className="mt-3 space-y-2 pl-8">
                    {t.resource_url && (
                      <a
                        href={t.resource_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3 shrink-0" />
                        {t.resource_label || "Open source"}
                      </a>
                    )}
                    {(t.notes?.length ?? 0) > 0 && (
                      <div className="flex items-start gap-2 text-xs text-muted-foreground">
                        <NotebookPen className="mt-0.5 h-3 w-3 shrink-0" />
                        <div className="space-y-1.5 whitespace-pre-wrap leading-relaxed">
                          {t.notes!.map((n) => (
                            <p key={n.id}>{n.content}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    {!hasDetail && (
                      <div className="text-[11px] italic text-muted-foreground">No notes attached.</div>
                    )}

                    {showFeedback ? (
                      <DmDoneFeedback
                        taskId={t.id}
                        taskTitle={t.title}
                        onDone={() => setJustCompletedId(null)}
                      />
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onComplete(t.id);
                          }}
                          className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          {done ? "Mark incomplete" : "Done ✓"}
                        </button>
                        <FeedbackChips source="task" targetId={t.id} taskId={t.id} taskTitle={t.title} compact />
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
};

export default Dashboard;
