import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useStateStore } from "@/stores/state-store";
import type { ExecutionFeedbackItem, Task } from "@/lib/types";
import { toast } from "sonner";
import { applyRule, CORE_FEEDBACK_KEYS, type CoreFeedback } from "@/lib/adaptation/rules";
import { selectHomeViewModel } from "@/lib/selectors/home";

/**
 * Moment Core v1 — mini feedback after Done.
 *
 * One row, six frozen labels. Pick one (or skip). Save the signal and, if
 * a next candidate exists, deterministically adapt it via applyRule().
 * No LLM. No analytics language.
 */
interface Props {
  task: Task | null;
  onClose: () => void;
}

const LABELS: Record<CoreFeedback, string> = {
  hard_to_start: "Hard to start",
  too_long: "Took too long",
  distracted: "Got distracted",
  felt_pointless: "Felt pointless",
  useful: "Useful",
  easy: "Easy",
};

export function DoneCheckIn({ task, onClose }: Props) {
  const dispatch = useStateStore((s) => s.dispatch);
  const [pick, setPick] = useState<CoreFeedback | null>(null);

  const finish = (signal: CoreFeedback | null) => {
    if (!task) return onClose();

    if (signal) {
      const item: ExecutionFeedbackItem = {
        id: crypto.randomUUID(),
        task_id: task.id,
        task_title: task.title,
        completed_at: task.completed_at || new Date().toISOString(),
        feedback: signal,
        note: "",
        created_at: new Date().toISOString(),
        source: "task",
        target_id: task.id,
      };
      dispatch({ type: "feedback/add", payload: item });

      // Determine next candidate AFTER completion has been applied upstream.
      const live = useStateStore.getState().state;
      const vm = live ? selectHomeViewModel(live) : null;
      const nextId = vm?.decisiveMove?.id ?? null;
      const nextCandidate = nextId ? live?.tasks.find((t) => t.id === nextId) ?? null : null;

      const adaptation = applyRule({
        completedTask: { id: task.id, title: task.title },
        feedback: signal,
        nextCandidate: nextCandidate ?? null,
      });

      if (nextCandidate && adaptation.next_task_changes) {
        dispatch({
          type: "task/update",
          payload: { id: nextCandidate.id, changes: adaptation.next_task_changes },
        });
      }

      // Store adaptation summary so Today can show "Why this changed →".
      // Save even when summary is empty — preserves the signal for the next
      // generated move when there is no next candidate yet.
      dispatch({
        type: "adaptation/set",
        payload: {
          from_task_id: adaptation.from_task_id,
          from_task_title: adaptation.from_task_title,
          from_feedback: adaptation.from_feedback,
          rule_id: adaptation.rule_id,
          summary: adaptation.summary,
          created_at: adaptation.created_at,
        },
      });

      if (adaptation.summary) {
        toast.success("Your next move just changed.", { duration: 2400 });
      } else {
        toast.success("Saved — I'll use this for the next move.", { duration: 2000 });
      }
    }
    onClose();
  };

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">How did that land?</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            One tap. Shapes your next move.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-1.5 pt-1">
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
              {LABELS[k]}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between pt-3">
          <button
            onClick={() => finish(null)}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
          <button
            onClick={() => finish(pick)}
            disabled={!pick}
            className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
