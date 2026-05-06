import { Link } from "react-router-dom";
import { MessageSquare, Lock } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { selectOnboardingStatus } from "@/lib/selectors/onboarding";

interface OnboardingGateProps {
  /** What this page needs to be useful. */
  requires: "goal" | "constraints" | "complete";
  /** Friendly name of the page being gated. */
  pageName: string;
  /** What the page will do once unlocked — one sentence. */
  unlocksWhen: string;
  children: React.ReactNode;
}

/**
 * Progressive-reveal gate. Lets the page render once the relevant
 * onboarding info has been captured via Chat; otherwise shows a
 * quiet "finish in chat" panel so the app feels coherent rather than empty.
 */
export const OnboardingGate = ({ requires, pageName, unlocksWhen, children }: OnboardingGateProps) => {
  const state = useStateStore((s) => s.state);
  const status = selectOnboardingStatus(state);

  const passes =
    requires === "goal"
      ? status.hasGoalOnly
      : requires === "constraints"
        ? status.hasGoal && status.hasSchoolEnd
        : status.isComplete;

  if (passes) return <>{children}</>;

  const missing = status.nextMissing ?? "your goal";

  return (
    <div className="mx-auto max-w-xl py-12">
      <div className="rounded-2xl border border-border bg-card p-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <Lock className="h-3 w-3" /> locked
        </div>
        <h1 className="font-display text-2xl font-medium tracking-tight">
          {pageName} unlocks in chat
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {unlocksWhen}
        </p>
        <p className="mt-3 text-sm">
          Tell Moment <span className="text-foreground">{missing}</span> and this page wakes up.
        </p>

        <Link
          to="/app/chat"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <MessageSquare className="h-4 w-4" /> Continue in chat
        </Link>
      </div>
    </div>
  );
};
