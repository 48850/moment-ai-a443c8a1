import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useStateStore } from "@/stores/state-store";
import type { ExecutionFeedbackItem, Task } from "@/lib/types";
import type { FeedbackKey } from "@/lib/feedback/labels";
import { FEEDBACK_LABELS } from "@/lib/feedback/labels";
import { toast } from "sonner";
import { computeNextMoveAdaptation, pickStrongestSignal } from "@/lib/adaptation/next-move-rule";
import { selectHomeViewModel } from "@/lib/selectors/home";

/**
 * Calm, 10-second check-in shown the moment a task is marked done.
 * Captures three signals — fit, goal-impact, friction — and writes them into
 * `execution_feedback` so chat-coach + app-intelligence + plan reform all see them.
 *
 * The user can dismiss instantly: completion is already saved.
 */
interface Props {
  task: Task | null;
  onClose: () => void;
}

const FIT_CHIPS: { key: FeedbackKey; label: string }[] = [
  { key: "easy", label: "Easier than expected" },
  { key: "valuable", label: "About right" },
  { key: "hard", label: "Harder than expected" },
];

const FRICTION_CHIPS: { key: FeedbackKey; label: string }[] = [
  { key: "tired", label: "Low energy" },
  { key: "overwhelmed", label: "Overwhelmed" },
  { key: "too_big", label: "Too big" },
  { key: "too_vague", label: "Unclear next step" },
  { key: "wrong_time", label: "Wrong time of day" },
  { key: "dont_understand", label: "Didn't understand it" },
];

export function DoneCheckIn({ task, onClose }: Props) {
  const dispatch = useStateStore((s) => s.dispatch);
  const [fit, setFit] = useState<FeedbackKey | null>(null);
  const [goalForward, setGoalForward] = useState<"yes" | "no" | null>(null);
  const [friction, setFriction] = useState<FeedbackKey | null>(null);

  const log = (key: FeedbackKey) => {
    if (!task) return;
    const item: ExecutionFeedbackItem = {
      id: crypto.randomUUID(),
      task_id: task.id,
      task_title: task.title,
      completed_at: task.completed_at || new Date().toISOString(),
      feedback: key,
      note: "",
      created_at: new Date().toISOString(),
      source: "task",
      target_id: task.id,
    };
    dispatch({ type: "feedback/add", payload: item });
  };

  const submit = () => {
    if (fit) log(fit);
    if (goalForward === "yes") log("valuable");
    if (goalForward === "no") log("not_relevant");
    if (friction) log(friction);
    if (fit || goalForward || friction) {
      toast.success("Saved — I'll fold this into the next plan.", { duration: 2200 });
    }
    onClose();
  };

  const skip = () => onClose();

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-medium">Quick check — {task?.title}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            10 seconds. This shapes tomorrow's plan and the AI's next questions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Row label="How did it land?">
            {FIT_CHIPS.map((c) => (
              <Chip key={c.key} active={fit === c.key} onClick={() => setFit(c.key)}>
                {c.label}
              </Chip>
            ))}
          </Row>

          <Row label="Did this move your goal forward?">
            <Chip active={goalForward === "yes"} onClick={() => setGoalForward("yes")}>Yes</Chip>
            <Chip active={goalForward === "no"} onClick={() => setGoalForward("no")}>Not really</Chip>
          </Row>

          <Row label="What got in the way? (optional)">
            {FRICTION_CHIPS.map((c) => (
              <Chip key={c.key} active={friction === c.key} onClick={() => setFriction(c.key)}>
                {c.label}
              </Chip>
            ))}
          </Row>
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={skip}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            Skip
          </button>
          <button
            onClick={submit}
            className="rounded-md bg-primary px-4 py-2 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Save signal
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-secondary/50 text-foreground hover:border-primary/50"
      }`}
    >
      {children}
    </button>
  );
}
