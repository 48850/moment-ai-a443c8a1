import { useState } from "react";
import { Check, Clock, Sparkles } from "lucide-react";
import { FEEDBACK_OPTIONS, homeMock, type FeedbackValue, type Task } from "@/lib/mockData";

const Dashboard = () => {
  const [tasks, setTasks] = useState<Task[]>(homeMock.tasks);
  const [decisiveDone, setDecisiveDone] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [picked, setPicked] = useState<FeedbackValue | null>(null);
  const [note, setNote] = useState("");
  const [why, setWhy] = useState(homeMock.whyThisMattered);

  const dm = homeMock.decisiveMove;

  const onComplete = (id: string) => {
    setTasks((ts) => ts.map((t) => (t.id === id ? { ...t, status: t.status === "completed" ? "pending" : "completed" } : t)));
  };

  const onDecisive = () => {
    setDecisiveDone(true);
    setFeedbackOpen(true);
  };

  const submitFeedback = () => {
    setFeedbackOpen(false);
    setWhy({
      populated: true,
      taskTitle: dm.title,
      workstreamName: "Personal essays",
      rationale: "An opener you're scared of usually means you've hit something true. That's the seed of the whole essay — and the essay is the lever for Stanford this cycle.",
      nextProof: "Submit opener for mentor review by Sunday.",
    });
    setPicked(null);
    setNote("");
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="text-xs text-muted-foreground">{homeMock.greeting}</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Good afternoon, Alex.</h1>
      </div>

      {/* Decisive move */}
      <section className="rounded-2xl border border-primary/40 bg-gradient-to-b from-primary/10 to-transparent p-5 shadow-[0_0_0_1px_hsl(var(--primary)/0.15)]">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
          <Sparkles className="h-3 w-3" /> decisive move
        </div>
        <h2 className="mt-2 text-xl font-semibold leading-tight">{dm.title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Best next move toward <span className="text-foreground">{homeMock.goalSnippet}</span>
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" /> {dm.estimatedMinutes} min
        </div>

        {!decisiveDone && (
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
                  key={o.value}
                  onClick={() => setPicked(o.value)}
                  className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                    picked === o.value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary text-foreground hover:border-primary/60"
                  }`}
                >
                  {o.label}
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
              <button onClick={() => setFeedbackOpen(false)} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
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

      {/* Why this mattered */}
      {why.populated && (
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> why that mattered
          </div>
          <div className="mt-2 text-sm font-medium">{why.taskTitle}</div>
          <p className="mt-2 text-sm text-muted-foreground">{why.rationale}</p>
          <div className="mt-3 text-xs">
            <span className="text-muted-foreground">Next proof: </span>
            <span className="text-foreground">{why.nextProof}</span>
          </div>
        </section>
      )}

      {/* Task list */}
      <section>
        <div className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Today</div>
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {tasks.map((t) => (
            <li key={t.id}>
              <button
                onClick={() => onComplete(t.id)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50"
              >
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
        </ul>
      </section>
    </div>
  );
};

export default Dashboard;
