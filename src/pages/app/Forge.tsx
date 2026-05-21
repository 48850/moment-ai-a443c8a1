import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStateStore } from "@/stores/state-store";
import { selectForgeContextSnapshot } from "@/lib/selectors/forge-context-snapshot";
import {
  generateForgeEpisode,
  suggestFormatForContext,
} from "@/lib/forge/episode-generator";
import { ForgeEpisodePlayer } from "@/components/app/forge/ForgeEpisodePlayer";
import { ForgeFormatSelector } from "@/components/app/forge/ForgeFormatSelector";
import type { ForgeEpisode, ForgeEpisodeFormat, ForgeEpisodeTone, ForgeFinalAction } from "@/lib/types/forge-episode";

const ACTION_ROUTES: Record<ForgeFinalAction["action"], string> = {
  start_task: "/app/tasks",
  break_down_task: "/app/tasks",
  reform_plan: "/app/plan",
  schedule_task: "/app/plan",
  open_constellation_node: "/app/mission",
  reflect: "/app/reflect",
};

const FORMAT_CYCLE: ForgeEpisodeFormat[] = [
  "context_roast",
  "courtroom_trial",
  "fake_news",
  "villain_arc",
  "mission_briefing",
  "goal_trailer",
  "weekly_recap",
  "task_rescue",
];

export default function Forge() {
  const state = useStateStore((s) => s.state);
  const navigate = useNavigate();

  const [episode, setEpisode] = useState<ForgeEpisode | null>(null);
  const [format, setFormat] = useState<ForgeEpisodeFormat>("context_roast");
  const [tone, setTone] = useState<ForgeEpisodeTone>("deadpan");
  const [cycleIndex, setCycleIndex] = useState(0);

  const generateEpisode = useCallback(
    (f: ForgeEpisodeFormat, t: ForgeEpisodeTone) => {
      if (!state) return;
      const ctx = selectForgeContextSnapshot(state);
      const ep = generateForgeEpisode({ format: f, tone: t, context: ctx });
      setEpisode(ep);
    },
    [state]
  );

  // Generate initial episode immediately on mount
  useEffect(() => {
    if (!state || episode) return;
    const ctx = selectForgeContextSnapshot(state);
    const suggested = suggestFormatForContext(ctx);
    setFormat(suggested);
    const ep = generateForgeEpisode({ format: suggested, tone, context: ctx });
    setEpisode(ep);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFormatChange(f: ForgeEpisodeFormat) {
    setFormat(f);
    generateEpisode(f, tone);
  }

  function handleToneChange(t: ForgeEpisodeTone) {
    setTone(t);
    generateEpisode(format, t);
  }

  function handleRegenerate() {
    const nextIndex = (cycleIndex + 1) % FORMAT_CYCLE.length;
    setCycleIndex(nextIndex);
    const nextFormat = FORMAT_CYCLE[nextIndex];
    setFormat(nextFormat);
    generateEpisode(nextFormat, tone);
  }

  function handleFinalAction(action: ForgeFinalAction) {
    navigate(ACTION_ROUTES[action.action] ?? "/app");
  }

  return (
    <div className="mx-auto max-w-sm space-y-3 pb-8">
      {/* Minimal header */}
      <div className="pt-1">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          / forge
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Your plan, turned into a tiny animated crisis.
        </p>
      </div>

      {/* Episode player — this is the product */}
      <ForgeEpisodePlayer
        episode={episode}
        onFinalAction={handleFinalAction}
        onRegenerate={handleRegenerate}
      />

      {/* Secondary controls — small, below the player */}
      <div className="rounded-xl border border-border/50 bg-card/30 p-3 space-y-2">
        <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
          Format & tone
        </p>
        <ForgeFormatSelector
          format={format}
          tone={tone}
          onChange={handleFormatChange}
          onToneChange={handleToneChange}
        />
      </div>
    </div>
  );
}
