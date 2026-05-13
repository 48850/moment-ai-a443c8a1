import type { MomentState } from "@/lib/types";

export interface OnboardingStatus {
  hasGoal: boolean;
  hasWhy: boolean;
  hasSchoolEnd: boolean;
  hasSleepTarget: boolean;
  hasEnergyPattern: boolean;
  /** Goal + why_it_matters + 3 core constraints captured. */
  isComplete: boolean;
  /** Goal alone is enough to unlock Today. */
  hasGoalOnly: boolean;
  /** Plain-English next thing chat needs to capture. */
  nextMissing: string | null;
}

export function selectOnboardingStatus(state: MomentState | null): OnboardingStatus {
  const g = state?.active_goal;
  const c = state?.constraints;

  const hasGoal = !!g?.statement?.trim();
  const hasWhy = !!g?.why_it_matters?.trim();
  const hasSchoolEnd = !!c?.school_end_time?.trim();
  const hasSleepTarget = !!c?.sleep_target_time?.trim();
  const hasEnergyPattern = !!c?.energy_pattern && c.energy_pattern !== "unknown";

  let nextMissing: string | null = null;
  if (!hasGoal) nextMissing = "your goal";
  else if (!hasWhy) nextMissing = "why this goal matters to you";
  else if (!hasSchoolEnd) nextMissing = "what time school ends";
  else if (!hasSleepTarget) nextMissing = "your target bedtime";
  else if (!hasEnergyPattern) nextMissing = "when you feel sharpest";

  return {
    hasGoal,
    hasWhy,
    hasSchoolEnd,
    hasSleepTarget,
    hasEnergyPattern,
    hasGoalOnly: hasGoal,
    isComplete: hasGoal && hasWhy && hasSchoolEnd && hasSleepTarget && hasEnergyPattern,
    nextMissing,
  };
}
