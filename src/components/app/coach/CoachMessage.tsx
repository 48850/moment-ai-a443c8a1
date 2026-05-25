import type { CoachResponse, CoachAction } from "@/lib/coach/coach-action-types";
import { CoachActionChip } from "./CoachActionChip";

interface Props {
  response: CoachResponse;
  onConversationalAction?: (action: CoachAction) => void;
  onAfterExecute?: () => void;
}

const STATE_COLOR: Record<string, string> = {
  steady: "text-emerald-500",
  proud: "text-emerald-500",
  recovering: "text-sky-500",
  stuck: "text-amber-500",
  confused: "text-amber-500",
  low_confidence: "text-amber-500",
  drifting: "text-orange-500",
  avoidant: "text-orange-500",
  overloaded: "text-red-500",
  frustrated: "text-red-500",
};

export function CoachMessage({ response, onConversationalAction, onAfterExecute }: Props) {
  const stateClass = STATE_COLOR[response.inferred_state] ?? "text-muted-foreground";

  return (
    <div className="flex flex-col gap-2">
      <div className="whitespace-pre-wrap rounded-2xl bg-secondary px-3.5 py-2 text-sm text-foreground">
        {response.reply}
      </div>

      {response.suggested_actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {response.suggested_actions.map((a, i) => (
            <CoachActionChip
              key={`${a.type}-${i}`}
              action={a}
              onConversational={onConversationalAction}
              onAfterExecute={onAfterExecute}
            />
          ))}
        </div>
      )}

      {(response.evidence_used.length > 0 || response.inferred_state) && (
        <div className="flex flex-wrap items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
          <span className={`uppercase tracking-[0.15em] ${stateClass}`}>
            {response.inferred_state.replace(/_/g, " ")}
          </span>
          {response.evidence_used.slice(0, 2).map((e) => (
            <span key={e} className="rounded-full bg-muted px-1.5 py-0.5">
              {e}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
