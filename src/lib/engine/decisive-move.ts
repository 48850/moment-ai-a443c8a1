import type { MomentState } from "@/lib/types";
import { timeToMinutes } from "@/lib/utils";

export interface DecisiveMoveCandidate {
  title: string;
  category: "goal_direct" | "bottleneck_removal" | "dependency" | "standards_preserving";
  goal_link: string;
  estimated_duration_minutes: number;
  minimum_viable_version: string;
  forward_progress_score?: number;
  dependency_score?: number;
  urgency_score?: number;
  feasibility_score?: number;
  energy_fit_score?: number;
  time_fit_score?: number;
  friction_score?: number;
}

export interface DecisiveMove {
  title: string;
  reason: string;
  goal_link: string;
  estimated_duration_minutes: number;
  fallback_version: string;
}

interface ScoredCandidate extends DecisiveMoveCandidate {
  decisive_score: number;
}

function computeDecisiveScore(c: DecisiveMoveCandidate): number {
  return (
    2.5 * (c.forward_progress_score || 0) +
    2.0 * (c.dependency_score || 0) +
    1.5 * (c.urgency_score || 0) +
    2.0 * (c.feasibility_score || 0) +
    1.5 * (c.energy_fit_score || 0) +
    1.5 * (c.time_fit_score || 0) -
    1.75 * (c.friction_score || 0)
  );
}

function computeTimeFit(candidate: DecisiveMoveCandidate, availableMinutes: number): number {
  const duration = candidate.estimated_duration_minutes || 30;
  if (availableMinutes <= 0) return 0;
  if (duration <= 0) return 5;
  const ratio = availableMinutes / duration;
  if (ratio >= 2.0) return 10;
  if (ratio >= 1.5) return 9;
  if (ratio >= 1.2) return 8;
  if (ratio >= 1.0) return 7;
  if (ratio >= 0.8) return 5;
  if (ratio >= 0.5) return 3;
  return 1;
}

function computeEnergyFit(candidate: DecisiveMoveCandidate, energy: string): number {
  const duration = candidate.estimated_duration_minutes || 30;
  const isHeavy = duration > 60;
  const isMedium = duration > 30;
  switch (energy) {
    case "high": return 10;
    case "medium": return isHeavy ? 5 : isMedium ? 7 : 9;
    case "low": return isHeavy ? 2 : isMedium ? 4 : 7;
    default: return isHeavy ? 4 : isMedium ? 6 : 8;
  }
}

function computeAvailableMinutes(state: MomentState): number {
  const c = state.constraints;
  if (!c.school_end_time || (!c.sleep_floor_time && !c.sleep_target_time)) return 240;
  const startMinutes = timeToMinutes(c.school_end_time) + (c.commute_minutes || 0);
  const endMinutes = timeToMinutes(c.sleep_target_time || c.sleep_floor_time);
  let available = endMinutes - startMinutes;
  const fixedMinutes = (c.study_minutes_daily || 0) + (c.exercise_minutes_daily || 0);
  const commitmentMinutes = (c.fixed_commitments || []).reduce((sum, fc) => {
    if (!fc.start_time || !fc.end_time) return sum;
    const dur = timeToMinutes(fc.end_time) - timeToMinutes(fc.start_time);
    return sum + Math.max(0, dur);
  }, 0);
  available -= fixedMinutes + commitmentMinutes + 30;
  return Math.max(0, available);
}

export function selectDecisiveMove(candidates: DecisiveMoveCandidate[], state: MomentState) {
  if (candidates.length === 0) {
    return {
      winner: { title: "", reason: "", goal_link: "", estimated_duration_minutes: 0, fallback_version: "" } as DecisiveMove,
      fallback: null as DecisiveMove | null,
      scored: [] as ScoredCandidate[],
    };
  }
  const availableMinutes = computeAvailableMinutes(state);
  const energy = state.today_state.energy || "unknown";
  const scored: ScoredCandidate[] = candidates
    .map((c) => ({ ...c, time_fit_score: computeTimeFit(c, availableMinutes), energy_fit_score: computeEnergyFit(c, energy) }))
    .map((c) => ({ ...c, decisive_score: computeDecisiveScore(c) }))
    .sort((a, b) => b.decisive_score - a.decisive_score);
  const best = scored[0];
  const second = scored[1] ?? null;
  const winner: DecisiveMove = {
    title: best.title,
    reason: `Score ${best.decisive_score.toFixed(1)}. ${best.goal_link || ""}`.trim(),
    goal_link: best.goal_link,
    estimated_duration_minutes: best.estimated_duration_minutes || 30,
    fallback_version: best.minimum_viable_version || "",
  };
  const fallback: DecisiveMove | null = second
    ? { title: second.minimum_viable_version || second.title, reason: `Backup. Score ${second.decisive_score.toFixed(1)}`, goal_link: second.goal_link, estimated_duration_minutes: Math.min(second.estimated_duration_minutes || 20, 20), fallback_version: "" }
    : best.minimum_viable_version
    ? { title: best.minimum_viable_version, reason: "Shorter version of the main move", goal_link: best.goal_link, estimated_duration_minutes: Math.floor((best.estimated_duration_minutes || 30) * 0.5), fallback_version: "" }
    : null;
  return { winner, fallback, scored };
}
