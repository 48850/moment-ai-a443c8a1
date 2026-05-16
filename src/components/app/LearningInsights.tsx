import { useStateStore } from "@/stores/state-store";
import { deriveUserLearningProfile } from "@/lib/learning/derive-profile";
import type { AdaptationRule } from "@/lib/learning/types";

const CONFIDENCE_LABEL: Record<string, string> = {
  low: "low",
  building: "building",
  confident: "confident",
};

function confidenceLabel(c: number): string {
  if (c >= 0.75) return "confident";
  if (c >= 0.45) return "building";
  return "low";
}

function ConfidencePip({ confidence }: { confidence: number }) {
  const label = confidenceLabel(confidence);
  const width = `${Math.round(confidence * 100)}%`;
  const colour =
    label === "confident" ? "bg-emerald-500" :
    label === "building" ? "bg-amber-400" : "bg-muted-foreground/40";
  return (
    <div className="flex items-center gap-2">
      <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <div className={`absolute inset-y-0 left-0 rounded-full ${colour}`} style={{ width }} />
      </div>
      <span className="text-[10px] text-muted-foreground">{CONFIDENCE_LABEL[label]} · {Math.round(confidence * 100)}%</span>
    </div>
  );
}

function InsightCard({
  rule,
  onDismiss,
}: {
  rule: AdaptationRule;
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <p className="text-sm font-medium leading-snug">{rule.rule}</p>
      <p className="text-xs text-muted-foreground">{rule.reason} · {rule.evidence_count} signal{rule.evidence_count !== 1 ? "s" : ""}</p>
      <div className="flex items-center justify-between">
        <ConfidencePip confidence={rule.confidence} />
        <button
          onClick={() => onDismiss(rule.id)}
          className="text-[10px] text-muted-foreground hover:text-foreground underline transition-colors"
        >
          dismiss
        </button>
      </div>
    </div>
  );
}

export function LearningInsights() {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);

  if (!state) return null;

  const signals = state.learning_signals ?? [];
  if (signals.length === 0 && !state.learning_profile) return null;

  const profile = state.learning_profile ?? deriveUserLearningProfile(state, []);
  const dismissed = new Set(profile.dismissed_insights ?? []);
  const visible = profile.adaptation_rules.filter((r) => !dismissed.has(r.id));

  if (visible.length === 0 && signals.length < 5) return null;

  const handleDismiss = (rule_id: string) => {
    dispatch({ type: "learning/dismiss_insight", payload: { rule_id } });
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">What Moment has learned</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          From {signals.length} observed action{signals.length !== 1 ? "s" : ""} · dismiss any insight to stop seeing it
        </p>
      </div>

      {visible.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Keep using Moment — patterns will emerge after ~10 actions.
        </p>
      )}

      <div className="grid gap-3">
        {visible.map((rule) => (
          <InsightCard key={rule.id} rule={rule} onDismiss={handleDismiss} />
        ))}
      </div>

      {profile.preferred_task_size !== "unknown" && (
        <p className="text-xs text-muted-foreground">
          Preferred task size: <span className="font-medium">{profile.preferred_task_size}</span>
          {profile.plan_style !== "unknown" && ` · Plan style: ${profile.plan_style}`}
          {profile.chat_style !== "unknown" && ` · Chat style: ${profile.chat_style}`}
        </p>
      )}
    </section>
  );
}
