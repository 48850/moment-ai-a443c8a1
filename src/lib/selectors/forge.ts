import type { MomentState } from "@/lib/types";

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

export const getForgeViewModel = (state: MomentState | null) => {
  if (!state) return null;
  const forge = state.forge_state ?? {
    interview_answers: [],
    candidate_features: [],
    selected_feature_ids: [],
    generated_modules: [],
    compiler_status: "idle" as const,
  };
  return {
    brief: getForgePursuitBrief(state),
    answers: forge.interview_answers,
    candidates: forge.candidate_features,
    selected_features: forge.candidate_features.filter((f) => forge.selected_feature_ids.includes(f.id)),
    modules: forge.generated_modules,
    status: forge.compiler_status,
  };
};
