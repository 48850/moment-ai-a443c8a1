import { useEffect, useMemo, useState } from "react";
import { Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { useStateStore } from "@/stores/state-store";
import { selectHomeViewModel } from "@/lib/selectors/home";
import { applyRule, type CoreFeedback } from "@/lib/adaptation/rules";
import {
  CORE_FEEDBACK_KEYS,
  CORE_FEEDBACK_LABELS,
} from "@/lib/feedback/core-labels";
import type { ExecutionFeedbackItem, Task } from "@/lib/types";
import { toast } from "sonner";

/**
 * Moment Core v1 — Today (Now Card state machine).
 *
 * Card states:
 *   ready          → one obvious next move (Done / Not this)
 *   progress_saved → brief acknowledgement after Done
 *   feedback       → six core feedback chips, inline (no modal)
 *   adapted        → next move visibly changed + one-line "why this changed"
 *   not_this       → tiny reason picker; after 2 rejections → starter offer
 *
 * No cockpit. No dashboards. No analytics surface. No hype copy.
 */

type CardState = "ready" | "progress_saved" | "feedback" | "adapted" | "not_this";

type RejectReason = "too_hard_now" | "wrong_priority" | "need_quicker";
const REJECT_LABEL: Record<RejectReason, string> = {
  too_hard_now: "Too hard right now",
  wrong_priority: "Wrong priority",
  need_quicker: "Need something quicker",
};
const SESSION_REJECT_KEY = "moment.notthis.count";

const Dashboard = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [card, setCard] = useState<CardState>("ready");
  const [justCompleted, setJustCompleted] = useState<Task | null>(null);
  const [pick, setPick] = useState<CoreFeedback | null>(null);
  const [rejectCount, setRejectCount] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(sessionStorage.getItem(SESSION_REJECT_KEY) || "0");
  });
  const [adaptedSummary, setAdaptedSummary] = useState<string>("");
  const [coachSupport, setCoachSupport] = useState(false);

  const vm = state ? selectHomeViewModel(state) : null;
  const dm = vm?.decisiveMove ?? null;
  const dmTask = useMemo(
    () => (dm && state ? state.tasks.find((t) => t.id === dm.id) ?? null : null),
    [dm, state]
  );
  const alsoToday = vm?.tasks.filter((t) => t.id !== dm?.id && t.status !== "done") ?? [];

  // Lazy consume pending_adaptation when a next move appears.
  useEffect(() => {
    if (!state) return;
    const pending = (state as any).pending_adaptation;
    if (!pending || !dmTask) return;
    if (pending.from_feedback !== "hard_to_start") {
      // No active v1 rule for other labels — just clear.
      dispatch({ type: "adaptation/setPending", payload: null });
      return;
    }
    const recent = recentCoreFeedback(state.execution_feedback ?? []);
    const result = applyRule({
      completedTask: { id: pending.from_task_id, title: pending.from_task_title },
      feedback: "hard_to_start",
      nextCandidate: dmTask,
      recentFeedback: recent,
    });
    if (result.next_task_changes) {
      dispatch({ type: "task/update", payload: { id: dmTask.id, changes: result.next_task_changes } });
    }
    if (result.summary) {
      dispatch({
        type: "adaptation/set",
        payload: {
          from_task_id: result.from_task_id,
          from_task_title: result.from_task_title,
          from_feedback: result.from_feedback,
          rule_id: result.rule_id,
          summary: result.summary,
          created_at: result.created_at,
        },
      });
    }
    dispatch({ type: "adaptation/setPending", payload: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmTask?.id]);

  if (!state || !vm) {
    return <div className="mx-auto max-w-xl py-12 text-sm text-muted-foreground">Loading…</div>;
  }

  const showAdaptedBanner =
    state.last_adaptation?.summary &&
    state.last_adaptation.from_task_id !== dm?.id &&
    card === "ready";

  const onDone = () => {
    if (!dmTask) return;
    const completedAt = new Date().toISOString();
    dispatch({ type: "task/complete", payload: { id: dmTask.id, completed_at: completedAt } });
    setJustCompleted({ ...dmTask, status: "done", completed_at: completedAt });
    setCard("progress_saved");
    // Brief acknowledgement, then move to feedback.
    window.setTimeout(() => setCard("feedback"), 650);
  };

  const onNotThisClick = () => setCard("not_this");

  const onReject = (reason: RejectReason) => {
    if (!dmTask) return;
    dispatch({
      type: "task/update",
      payload: { id: dmTask.id, changes: { status: "skipped" } as Partial<Task> },
    });
    const next = rejectCount + 1;
    setRejectCount(next);
    if (typeof window !== "undefined") sessionStorage.setItem(SESSION_REJECT_KEY, String(next));
    setCard("ready");
    toast(`Skipped — ${REJECT_LABEL[reason].toLowerCase()}.`, { duration: 1800 });
  };

  const onStarterFromRejection = () => {
    if (!dmTask) return;
    const minutes = Math.min(dmTask.estimated_minutes || 10, 3);
    const STARTER = "First 3 min: ";
    const title = dmTask.title.startsWith(STARTER) ? dmTask.title : `${STARTER}${dmTask.title}`;
    dispatch({
      type: "task/update",
      payload: { id: dmTask.id, changes: { title, estimated_minutes: minutes } },
    });
    if (typeof window !== "undefined") sessionStorage.removeItem(SESSION_REJECT_KEY);
    setRejectCount(0);
    setCard("ready");
    toast.success("Made it a 3-minute starter.", { duration: 1800 });
  };

  const submitFeedback = (signal: CoreFeedback | null) => {
    if (!justCompleted) {
      setCard("ready");
      return;
    }
    if (!signal) {
      // Skip: no signal, no adaptation, no hype.
      setCard("ready");
      setJustCompleted(null);
      setPick(null);
      return;
    }

    // Save the signal.
    const item: ExecutionFeedbackItem = {
      id: crypto.randomUUID(),
      task_id: justCompleted.id,
      task_title: justCompleted.title,
      completed_at: justCompleted.completed_at || new Date().toISOString(),
      feedback: signal,
      note: "",
      created_at: new Date().toISOString(),
      source: "task",
      target_id: justCompleted.id,
    };
    dispatch({ type: "feedback/add", payload: item });

    // Get latest state to find next candidate AFTER completion was applied.
    const live = useStateStore.getState().state!;
    const liveVm = selectHomeViewModel(live);
    const nextCandidate = liveVm.decisiveMove
      ? live.tasks.find((t) => t.id === liveVm.decisiveMove!.id) ?? null
      : null;

    const recent = recentCoreFeedback(live.execution_feedback ?? []);
    const result = applyRule({
      completedTask: { id: justCompleted.id, title: justCompleted.title },
      feedback: signal,
      nextCandidate,
      recentFeedback: recent,
    });

    if (result.next_task_changes && nextCandidate) {
      dispatch({
        type: "task/update",
        payload: { id: nextCandidate.id, changes: result.next_task_changes },
      });
    }

    if (result.pending) {
      dispatch({
        type: "adaptation/setPending",
        payload: {
          from_task_id: result.from_task_id,
          from_task_title: result.from_task_title,
          from_feedback: result.from_feedback,
          rule_id: result.rule_id,
          reason: result.pending_reason,
          created_at: result.created_at,
        },
      });
    }

    if (result.summary) {
      dispatch({
        type: "adaptation/set",
        payload: {
          from_task_id: result.from_task_id,
          from_task_title: result.from_task_title,
          from_feedback: result.from_feedback,
          rule_id: result.rule_id,
          summary: result.summary,
          created_at: result.created_at,
        },
      });
    }

    setAdaptedSummary(result.summary || "");
    setCoachSupport(result.coach_support);
    setJustCompleted(null);
    setPick(null);

    if (result.summary || result.coach_support) {
      setCard("adapted");
    } else {
      setCard("ready");
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-160px)] max-w-xl flex-col justify-center space-y-6">
      <div>
        <div className="text-xs text-muted-foreground">{vm.greeting}</div>
        <h1 className="mt-1 font-display text-2xl font-medium tracking-tight">
          {state.profile.display_name ? `Hey ${state.profile.display_name}.` : "Hey."}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {card === "ready" && "Here's the one move that matters now."}
          {card === "progress_saved" && "Nice — that one's logged."}
          {card === "feedback" && "How did that land?"}
          {card === "adapted" && "Your next move just changed."}
          {card === "not_this" && "Quick reason — I'll use it."}
        </p>
      </div>

      {/* READY state */}
      {card === "ready" && (
        dm ? (
          <section className="rounded-2xl border border-primary/40 bg-gradient-to-b from-primary/10 to-transparent p-6">
            <h2 className="text-xl font-semibold leading-snug">{dm.title}</h2>

            {showAdaptedBanner && (
              <p className="mt-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs leading-relaxed">
                <span className="mr-1 font-medium uppercase tracking-[0.14em] text-primary">
                  Why this changed →
                </span>
                {state.last_adaptation!.summary}
              </p>
            )}

            {dmTask?.why_now && (
              <p className="mt-3 text-sm text-muted-foreground">{dmTask.why_now}</p>
            )}

            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> about {dm.estimatedMinutes} min
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                onClick={onDone}
                className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Done ✓
              </button>
              <button
                onClick={onNotThisClick}
                className="rounded-lg border border-border bg-background/40 px-4 py-2.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground"
              >
                Not this
              </button>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Nothing queued. Open Coach to set the next move.
            </p>
          </section>
        )
      )}

      {/* PROGRESS SAVED state */}
      {card === "progress_saved" && (
        <section className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
          <p className="text-sm font-medium">Progress saved.</p>
        </section>
      )}

      {/* FEEDBACK state — inline, no modal */}
      {card === "feedback" && (
        <section className="rounded-2xl border border-border bg-card p-6">
          <p className="text-xs text-muted-foreground">One tap shapes your next move.</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {CORE_FEEDBACK_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setPick(k)}
                className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
                  pick === k
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary/50 text-foreground hover:border-primary/50"
                }`}
              >
                {CORE_FEEDBACK_LABELS[k]}
              </button>
            ))}
          </div>
          <div className="mt-5 flex items-center justify-between">
            <button
              onClick={() => submitFeedback(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Skip
            </button>
            <button
              onClick={() => submitFeedback(pick)}
              disabled={!pick}
              className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
            >
              Save
            </button>
          </div>
        </section>
      )}

      {/* ADAPTED state — show the visible change */}
      {card === "adapted" && (
        <section className="rounded-2xl border border-primary/40 bg-gradient-to-b from-primary/10 to-transparent p-6">
          {coachSupport ? (
            <>
              <h2 className="text-lg font-semibold leading-snug">Let's bring Coach in.</h2>
              <p className="mt-2 text-sm text-muted-foreground">{adaptedSummary}</p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <Link
                  to="/app/chat"
                  className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Talk to Coach
                </Link>
                <button
                  onClick={() => setCard("ready")}
                  className="rounded-lg border border-border bg-background/40 px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  Later
                </button>
              </div>
            </>
          ) : dm ? (
            <>
              <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs leading-relaxed">
                <span className="mr-1 font-medium uppercase tracking-[0.14em] text-primary">
                  Why this changed →
                </span>
                {adaptedSummary}
              </p>
              <h2 className="mt-4 text-xl font-semibold leading-snug">{dm.title}</h2>
              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" /> about {dm.estimatedMinutes} min
              </div>
              <div className="mt-5">
                <button
                  onClick={() => setCard("ready")}
                  className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Got it
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm">{adaptedSummary || "Progress saved."}</p>
              <button
                onClick={() => setCard("ready")}
                className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Got it
              </button>
            </>
          )}
        </section>
      )}

      {/* NOT THIS state — reason picker, with bounded loop */}
      {card === "not_this" && (
        <section className="rounded-2xl border border-border bg-card p-6">
          {rejectCount >= 2 ? (
            <>
              <p className="text-sm">
                You've passed on a couple in a row. Want to start tiny instead?
              </p>
              <button
                onClick={onStarterFromRejection}
                className="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                Try a 3-minute starter
              </button>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <Link to="/app/chat" className="hover:text-foreground">
                  Talk to Coach
                </Link>
                <button onClick={() => setCard("ready")} className="hover:text-foreground">
                  Back
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Why not this one?</p>
              <div className="mt-3 flex flex-col gap-1.5">
                {(Object.keys(REJECT_LABEL) as RejectReason[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => onReject(r)}
                    className="rounded-md border border-border bg-secondary/30 px-3 py-2 text-left text-sm hover:border-primary/40 hover:text-foreground"
                  >
                    {REJECT_LABEL[r]}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setCard("ready")}
                className="mt-4 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </>
          )}
        </section>
      )}

      {alsoToday.length > 0 && card === "ready" && (
        <p className="text-center text-[11px] text-muted-foreground/70">
          Also today: {alsoToday.slice(0, 3).map((t) => t.title).join(" · ")}
          {alsoToday.length > 3 ? ` · +${alsoToday.length - 3}` : ""}
        </p>
      )}
    </div>
  );
};

function recentCoreFeedback(items: ExecutionFeedbackItem[]): CoreFeedback[] {
  const CORE = new Set(CORE_FEEDBACK_KEYS as readonly string[]);
  return items
    .slice()
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .filter((f) => CORE.has(f.feedback))
    .slice(0, 10)
    .map((f) => f.feedback as CoreFeedback);
}

export default Dashboard;
