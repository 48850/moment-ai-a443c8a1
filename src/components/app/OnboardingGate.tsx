import { useStateStore } from "@/stores/state-store";
import { OnboardingFlow } from "./OnboardingFlow";

interface OnboardingGateProps {
  /** kept for backwards-compat; ignored — onboarding is one-shot */
  requires?: "goal" | "constraints" | "complete";
  pageName?: string;
  unlocksWhen?: string;
  children: React.ReactNode;
}

/**
 * One-time gate. If the user hasn't completed onboarding, render the
 * onboarding flow. Once `profile.onboarding_completed_at` is set, the gate
 * is permanently invisible — every page just renders.
 */
export const OnboardingGate = ({ children }: OnboardingGateProps) => {
  const state = useStateStore((s) => s.state);
  if (!state) return null;
  const done = !!state.profile.onboarding_completed_at;
  if (!done) return <OnboardingFlow />;
  return <>{children}</>;
};
