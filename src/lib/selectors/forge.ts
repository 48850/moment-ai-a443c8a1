import type { MomentState, ForgeGuidebook, FeatureRunResult, ForgeSignal } from "@/lib/types";
import { detectSystemGap } from "@/lib/forge/guidebook";

export const getForgeState = (state: MomentState | null) => state?.forge_state ?? null;

export const getForgePursuitBrief = (state: MomentState | null) => {
  if (!state || !state.pursuit_model) return null;
  return {
    goal: state.active_goal?.statement,
    standards: state.pursuit_model.standards,
    risks: state.pursuit_model.risks,
    active_mode: state.pursuit_model.active_operating_mode_id,
  };
};

const getGuidebooks = (state: MomentState | null): ForgeGuidebook[] =>
  ((state?.forge_state as any)?.guidebooks ?? []) as ForgeGuidebook[];

const getRuns = (state: MomentState | null): FeatureRunResult[] =>
  ((state?.forge_state as any)?.feature_runs ?? []) as FeatureRunResult[];

const getSignals = (state: MomentState | null): ForgeSignal[] =>
  ((state?.forge_state as any)?.forge_signals ?? []) as ForgeSignal[];

export const getGuidebookById = (state: MomentState | null, id: string) =>
  getGuidebooks(state).find((g) => g.id === id) ?? null;

export const getFeatureRunsForGuidebook = (state: MomentState | null, id: string) =>
  getRuns(state).filter((r) => r.feature_id === id);

export const getSignalsForGuidebook = (state: MomentState | null, id: string) =>
  getSignals(state).filter((s) => s.feature_id === id);

export const getForgeViewModel = (state: MomentState | null) => {
  if (!state) return null;
  const forge = state.forge_state ?? {
    interview_answers: [], candidate_features: [], selected_feature_ids: [],
    generated_modules: [], compiler_status: "idle" as const,
  };
  return {
    brief: getForgePursuitBrief(state),
    answers: forge.interview_answers,
    candidates: forge.candidate_features,
    selected_features: forge.candidate_features.filter((f) => forge.selected_feature_ids.includes(f.id)),
    modules: forge.generated_modules,
    status: forge.compiler_status,
    guidebooks: getGuidebooks(state),
    feature_runs: getRuns(state),
    forge_signals: getSignals(state),
    system_gap: detectSystemGap(state),
  };
};
