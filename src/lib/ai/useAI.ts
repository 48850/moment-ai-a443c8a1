import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStateStore } from "@/stores/state-store";
import type { MomentState } from "@/lib/types";

export type AIIntent =
  | "next_move_rationale"
  | "reframe_rescue"
  | "daily_debrief"
  | "goal_audit"
  | "forge_modules"
  | "forge_guidebook"
  | "forge_feature_ai"
  | "rescue_protocol"
  | "suggest_tasks"
  | "reflect_summary"
  | "mission_insight";

function buildSnapshot(s: MomentState | null) {
  if (!s) return {};

  const activeGuidebooks = (s.forge_state?.guidebooks ?? [])
    .filter((g) => g.status === "active")
    .map((g) => ({ id: g.id, title: g.title, purpose: g.purpose, feature_type: g.feature_type }));

  const recentSignals = (s.forge_state?.forge_signals ?? [])
    .slice(-10)
    .map((sig) => ({ feature: sig.feature_title, key: sig.signal_key, value: sig.value, at: sig.created_at }));

  const recentRuns = (s.forge_state?.feature_runs ?? [])
    .slice(-5)
    .map((r) => ({ feature_id: r.feature_id, function_type: r.function_type, at: r.run_at }));

  return {
    display_name: s.profile.display_name,
    active_goal: {
      statement: s.active_goal.statement,
      why_it_matters: s.active_goal.why_it_matters,
    },
    recent_feedback: (s.execution_feedback ?? []).slice(-15).map((f) => f.feedback),
    recent_reflections: (s.reflections ?? [])
      .slice(-3)
      .map((r) => ({ date: r.date, energy: r.energy_rating, win: r.accomplishment, struggle: r.struggle })),
    constraints: {
      energy_pattern: s.constraints?.energy_pattern,
      preferred_work_window: s.constraints?.preferred_work_window,
    },
    pursuit_model: s.pursuit_model
      ? {
          family: s.pursuit_model.family,
          summary: s.pursuit_model.summary,
          top_workstream: s.pursuit_model.workstreams[0]?.title,
          bottleneck: s.pursuit_model.workstreams.find((w) => w.bottleneck)?.bottleneck,
          risks: s.pursuit_model.risks.slice(0, 3).map((r) => r.description),
        }
      : null,
    forge: {
      active_guidebooks: activeGuidebooks,
      recent_signals: recentSignals,
      recent_runs: recentRuns,
    },
  };
}

export function useAI<T = any>(intent: AIIntent) {
  const state = useStateStore((s) => s.state);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<T | null>(null);

  const run = useCallback(
    async (payload: Record<string, unknown> = {}) => {
      setLoading(true); setError(null);
      try {
        const { data, error: fnErr } = await supabase.functions.invoke("app-intelligence", {
          body: { intent, snapshot: buildSnapshot(state), payload },
        });
        if (fnErr) throw fnErr;
        if (data?.error) throw new Error(data.error);
        setResult(data?.result ?? null);
        return data?.result as T;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "AI error";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [intent, state],
  );

  return { run, loading, error, result };
}
