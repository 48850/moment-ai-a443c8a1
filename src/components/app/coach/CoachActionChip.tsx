import { useState } from "react";
import { toast } from "sonner";
import type { CoachAction } from "@/lib/coach/coach-action-types";
import { executeCoachAction } from "@/lib/coach/execute-coach-action";

interface Props {
  action: CoachAction;
  onConversational?: (action: CoachAction) => void;
  onAfterExecute?: () => void;
}

const CONVERSATIONAL = new Set<CoachAction["type"]>([
  "forge.create_artifact",
  "path.show_proof",
  "explain.why_this_matters",
]);

export function CoachActionChip({ action, onConversational, onAfterExecute }: Props) {
  const [busy, setBusy] = useState(false);

  const handleClick = () => {
    if (busy) return;
    if (CONVERSATIONAL.has(action.type)) {
      onConversational?.(action);
      return;
    }
    if (action.needs_confirmation) {
      const ok = window.confirm(`${action.label} — go ahead?`);
      if (!ok) return;
    }
    setBusy(true);
    const result = executeCoachAction(action);
    setBusy(false);
    if (result.ok && result.message) toast.success(result.message);
    if (!result.ok) toast.error(result.message);
    if (result.ok) onAfterExecute?.();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:opacity-50"
    >
      {action.label}
    </button>
  );
}
