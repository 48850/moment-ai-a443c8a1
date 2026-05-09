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

export const getForgeViewModel = (state: MomentState | null) => {
  if (!state) return null;
  const forge = state.forge_state ?? {
    interview_answers: [],
    candidate_features: [],
    selected_feature_ids: [],
    generated_modules: [],
    compiler_status: "idle" as const,
    guidebooks: [],
    feature_runs: [],
    forge_signals: [],
    guidebook_build_status: "idle" as const,
  };
  return {
    brief: getForgePursuitBrief(state),
    answers: forge.interview_answers,
    candidates: forge.candidate_features,
    selected_features: forge.candidate_features.filter((f) => forge.selected_feature_ids.includes(f.id)),
    modules: forge.generated_modules,
    status: forge.compiler_status,
    // Guidebook system
    guidebooks: forge.guidebooks ?? [],
    feature_runs: forge.feature_runs ?? [],
    forge_signals: forge.forge_signals ?? [],
    guidebook_build_status: forge.guidebook_build_status ?? "idle",
    draft_guidebook: forge.draft_guidebook ?? null,
    system_gap: detectSystemGap(state),
  };
};

export const getGuidebookById = (state: MomentState | null, id: string): ForgeGuidebook | null => {
  if (!state) return null;
  return (state.forge_state?.guidebooks ?? []).find((g) => g.id === id) ?? null;
};

export const getGuidebookBySlug = (state: MomentState | null, slug: string): ForgeGuidebook | null => {
  if (!state) return null;
  return (state.forge_state?.guidebooks ?? []).find((g) => g.route_slug === slug) ?? null;
};

export const getFeatureRunsForGuidebook = (state: MomentState | null, featureId: string): FeatureRunResult[] => {
  if (!state) return [];
  return (state.forge_state?.feature_runs ?? []).filter((r) => r.feature_id === featureId);
};

export const getSignalsForGuidebook = (state: MomentState | null, featureId: string): ForgeSignal[] => {
  if (!state) return [];
  return (state.forge_state?.forge_signals ?? []).filter((s) => s.feature_id === featureId);
};

export const getActiveGuidebooks = (state: MomentState | null): ForgeGuidebook[] => {
  if (!state) return [];
  return (state.forge_state?.guidebooks ?? []).filter((g) => g.status === "active");
};

export const getForgeAuditSummary = (state: MomentState | null) => {
  if (!state) return null;
  const guidebooks = state.forge_state?.guidebooks ?? [];
  const runs = state.forge_state?.feature_runs ?? [];
  const signals = state.forge_state?.forge_signals ?? [];

  const activeCount = guidebooks.filter((g) => g.status === "active").length;
  const thisWeekStart = new Date();
  thisWeekStart.setDate(thisWeekStart.getDate() - 7);

  const recentRuns = runs.filter((r) => new Date(r.run_at) > thisWeekStart);
  const recentSignals = signals.filter((s) => new Date(s.created_at) > thisWeekStart);

  const mostUsed = guidebooks
    .filter((g) => g.status === "active")
    .map((g) => ({
      ...g,
      run_count: runs.filter((r) => r.feature_id === g.id).length,
    }))
    .sort((a, b) => b.run_count - a.run_count)[0] ?? null;

  return {
    active_features: activeCount,
    runs_this_week: recentRuns.length,
    signals_this_week: recentSignals.length,
    most_used: mostUsed,
    total_tasks_created: runs.reduce((acc, r) => acc + (r.tasks_created?.length ?? 0), 0),
  };
};
