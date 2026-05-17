import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useStateStore } from "@/stores/state-store";
import { buildContextPacket } from "@/lib/ai/context-packet";

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
  | "mission_insight"
  | "plan_reform"
  | "refine_user_task"
  | "week_regenerate";

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
          body: { intent, snapshot: buildContextPacket(state), payload },
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
