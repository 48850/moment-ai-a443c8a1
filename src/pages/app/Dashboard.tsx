import { useState } from "react";
import { Check, Clock, Sparkles } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { selectHomeViewModel } from "@/lib/selectors/home";
import { FEEDBACK_OPTIONS } from "@/lib/state/schema";
import type { ExecutionFeedbackItem } from "@/lib/types";

const FEEDBACK_LABELS: Record<(typeof FEEDBACK_OPTIONS)[number], string> = {
  easy: "Easy",
  hard: "Hard",
  too_vague: "Too vague",
  too_big: "Too big",
  valuable: "Valuable",
  not_relevant: "Not relevant",
  need_help: "Need help",
  do_differently: "Do differently",
};

const Dashboard = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [picked, setPicked] = useState<(typeof FEEDBACK_OPTIONS)[number] | null>(null);
  const [note, setNote] = useState("");

  if (!state) return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;

  const vm = selectHomeViewModel(state);
  const dm = vm.decisiveMove;

  const onComplete = (id: string) => {
    const t = state.tasks.find((x) => x.id === id);
    if (!t) return;
    if (t.status === "done") {
      dispatch({ type: "task/update", payload: { id, changes: { status: "pending", completed_at: "" } } });
    } else {
      dispatch({ type: "task/complete", payload: { id, completed_at: new Date().toISOString() } });
    }
  };

  const onDecisive = () => {
    if (!dm) return;
    dispatch({ type: "task/complete", payload: { id: dm.id, completed_at: new Date().toISOString() } });
    setFeedbackOpen(true);
  };

  const submitFeedback = () => {
    if (!picked || !dm) return;
    const item: ExecutionFeedbackItem = {
      id: crypto.randomUUID(),
      task_id: dm.id,
      task_title: dm.title,
      completed_at: new Date().toISOString(),
      feedback: picked,
      note,
      created_at: new Date().toISOString(),
    };
    dispatch({ type: "feedback/add", payload: item });
    setFeedbackOpen(false);
    setPicked(null);
    setNote("");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="text-xs text-muted-foreground">{vm.greeting}</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          Good afternoon, {state.profile.display_name}.
        </h1>
      </div>

      {/* Decisive move */}
      {dm && (
        <section className="rounded-2xl border border-primary/40 bg-gradient-to-b from-primary/10 to-transparent p-5 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
            <Sparkles className="h-3 w-3" /> decisive move
          </div>
          <h2 className="mt-2 text-xl font-semibold leading-tight">{dm.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Best next move toward <span className="text-foreground">{vm.goalSnippet}</span>
          </p>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" /> {dm.estimatedMinutes} min
          </div>

          {!feedbackOpen && (
            <button
              onClick={onDecisive}
              className="mt-5 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Mark done
            </button>
          )}

          {feedbackOpen && (
            <div className="mt-5 rounded-xl border border-border bg-card p-4">
              <div className="text-xs text-muted-foreground">How did that go?</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {FEEDBACK_OPTIONS.map((o) => (
                  <button
                    key={o}
                    onClick={() => setPicked(o)}
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      picked === o
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-secondary text-foreground hover:border-primary/60"
                    }`}
                  >
                    {FEEDBACK_LABELS[o]}
                  </button>
                ))}
              </div>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note…"
                rows={2}
                className="mt-3 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
              <div className="mt-3 flex justify-end gap-2">
                <button
                  onClick={() => setFeedbackOpen(false)}
                  className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Skip
                </button>
                <button
                  onClick={submitFeedback}
                  disabled={!picked}
                  className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                >
                  Submit
                </button>
              </div>
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
              <span className="text-muted-foreground">Next proof: </span>
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
            return (
              <li key={t.id}>
                <button
                  onClick={() => onComplete(t.id)}
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
        </ul>
      </section>
    </div>
  );
};

export default Dashboard;
