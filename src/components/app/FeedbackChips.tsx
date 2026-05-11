import { useState } from "react";
import { MessageCircleHeart } from "lucide-react";
import { toast } from "sonner";
import { useStateStore } from "@/stores/state-store";
import {
  FEEDBACK_LABELS,
  FEEDBACK_RESPONSE,
  FEEDBACK_GROUPS,
  type FeedbackKey,
} from "@/lib/feedback/labels";
import type { ExecutionFeedbackItem } from "@/lib/types";
import { tuneTaskFromFeedback, isToneFeedback } from "@/lib/feedback/tune-engine";
import { supabase } from "@/integrations/supabase/client";
import { buildContextPacket } from "@/lib/ai/context-packet";

interface Props {
  source: ExecutionFeedbackItem["source"];
  targetId?: string;
  taskId?: string;
  taskTitle?: string;
  /** Limit the chip set; useful for tight surfaces (chat bubbles, etc.). */
  groups?: string[];
  /** Compact = label-only trigger, no surrounding card. */
  compact?: boolean;
  /** Override the small prompt shown above the chips. */
  prompt?: string;
}

/**
 * Calm, optional, expandable feedback strip.
 * - Never asks "how do you feel" — it asks how the *plan* landed.
 * - Single tap is enough; no required note, no streak guilt.
 * - Now: a Tune tap on a task INSTANTLY mutates that task (heuristic),
 *   then asynchronously asks the AI to refine it further (hybrid mode).
 */
export const FeedbackChips = ({
  source,
  targetId = "",
  taskId = "",
  taskTitle = "",
  groups,
  compact = false,
  prompt = "How did this land?",
}: Props) => {
  const dispatch = useStateStore((s) => s.dispatch);
  const state = useStateStore((s) => s.state);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<FeedbackKey | null>(null);

  const visibleGroups = groups
    ? FEEDBACK_GROUPS.filter((g) => groups.includes(g.id))
    : FEEDBACK_GROUPS;

  const submit = async (key: FeedbackKey) => {
    setPicked(key);

    // 1. Always log the feedback signal.
    const item: ExecutionFeedbackItem = {
      id: crypto.randomUUID(),
      task_id: taskId,
      task_title: taskTitle,
      completed_at: "",
      feedback: key,
      note: "",
      created_at: new Date().toISOString(),
      source,
      target_id: targetId,
    };
    dispatch({ type: "feedback/add", payload: item });

    // 2. Tone signals → update chat preferences (system-wide).
    if (isToneFeedback(key)) {
      dispatch({
        type: "chat/setPreferences",
        payload: { tone: key === "be_gentler" ? "gentler" : "more_direct" },
      });
    }

    // 3. Task-targeted feedback → instant heuristic mutation + async AI refine.
    let toastShown = false;
    if (taskId && state) {
      const task = state.tasks.find((t) => t.id === taskId);
      if (task) {
        const outcome = tuneTaskFromFeedback(task, key);
        if (outcome) {
          dispatch({
            type: "task/tune",
            payload: {
              id: taskId,
              feedback: key,
              change: outcome.change_summary,
              changes: outcome.changes,
            },
          });
          toast.message(outcome.change_summary, {
            description: FEEDBACK_RESPONSE[key],
            duration: 4000,
          });
          toastShown = true;

          // Async AI refinement — silent on failure.
          supabase.functions
            .invoke("app-intelligence", {
              body: {
                intent: "refine_task",
                snapshot: buildContextPacket(state),
                payload: {
                  task: { ...task, ...outcome.changes },
                  feedback: key,
                  goal: state.active_goal?.statement ?? "",
                },
              },
            })
            .then(({ data, error }) => {
              if (error || !data) return;
              const refined = (data as any).result?.changes;
              if (refined && typeof refined === "object") {
                // Strip empty strings so we don't blank fields.
                const clean: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(refined)) {
                  if (v === "" || v === null || v === undefined) continue;
                  clean[k] = v;
                }
                if (Object.keys(clean).length) {
                  dispatch({
                    type: "task/update",
                    payload: { id: taskId, changes: clean as any },
                  });
                }
              }
            })
            .catch(() => {
              /* silent — heuristic already applied */
            });
        }
      }
    }
    if (!toastShown) {
      toast.message(FEEDBACK_RESPONSE[key], { duration: 3500 });
    }

    // auto-close after a beat
    setTimeout(() => {
      setOpen(false);
      setPicked(null);
    }, 700);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className={`inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground ${
          compact ? "" : ""
        }`}
        aria-label="Give feedback"
      >
        <MessageCircleHeart className="h-3 w-3" />
        Tune this
      </button>
    );
  }

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="rounded-xl border border-border bg-background/70 p-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">{prompt}</p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          close
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {visibleGroups.map((g) => (
          <div key={g.id}>
            <div className="mb-1 text-[9px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
              {g.label}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {g.keys.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => submit(k)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                    picked === k
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary/50 text-foreground hover:border-primary/50"
                  }`}
                >
                  {FEEDBACK_LABELS[k]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
        Useful signal — not a verdict. We adjust the plan, not the goal.
      </p>
    </div>
  );
};
