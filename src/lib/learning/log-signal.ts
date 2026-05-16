import type { MomentAction } from "@/lib/types/actions";
import type { LearningSignal, LearningSignalType, LearningSurface, LearningSignalMeta } from "./types";

export function logLearningSignal(
  dispatch: (action: MomentAction) => void,
  params: {
    signal_type: LearningSignalType;
    source_surface: LearningSurface;
    metadata?: LearningSignalMeta;
    task_id?: string;
    forge_feature_id?: string;
    confidence?: number;
    outcome_value?: number;
    privacy_level?: "private" | "aggregate_ok";
  },
): void {
  const signal: LearningSignal = {
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    signal_type: params.signal_type,
    source_surface: params.source_surface,
    metadata: params.metadata ?? {},
    privacy_level: params.privacy_level ?? "private",
    confidence: params.confidence ?? 1,
    ...(params.task_id !== undefined ? { task_id: params.task_id } : {}),
    ...(params.forge_feature_id !== undefined ? { forge_feature_id: params.forge_feature_id } : {}),
    ...(params.outcome_value !== undefined ? { outcome_value: params.outcome_value } : {}),
  };
  dispatch({ type: "learning/log_signal", payload: signal });
}
