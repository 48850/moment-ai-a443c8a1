import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStateStore } from "@/stores/state-store";
import { selectForgeContextSnapshot } from "@/lib/selectors/forge-context-snapshot";
import {
  generateForgeEpisode,
  suggestFormatForContext,
} from "@/lib/forge/episode-generator";
import { ForgeEpisodePlayer } from "@/components/app/forge/ForgeEpisodePlayer";
import { ForgeFormatSelector } from "@/components/app/forge/ForgeFormatSelector";
import type {
  ForgeEpisode,
  ForgeEpisodeFormat,
  ForgeEpisodeTone,
  ForgeFinalAction,
} from "@/lib/types/forge-episode";

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

const ACTION_ROUTES: Record<ForgeFinalAction["action"], string> = {
  start_task:             "/app/tasks",
  break_down_task:        "/app/tasks",
  reform_plan:            "/app/plan",
  schedule_task:          "/app/plan",
  open_constellation_node: "/app/mission",
  reflect:                "/app/reflect",
};

const Forge = () => {
  const state = useStateStore((s) => s.state);
  const navigate = useNavigate();

  const [episode, setEpisode] = useState<ForgeEpisode | null>(null);
  const [format, setFormat] = useState<ForgeEpisodeFormat>("context_roast");
  const [tone, setTone] = useState<ForgeEpisodeTone>("deadpan");
  const [cycleIndex, setCycleIndex] = useState(0);

  // Generate episode on mount and whenever state loads
  useEffect(() => {
    if (!state) return;
    const ctx = selectForgeContextSnapshot(state);
    const suggested = suggestFormatForContext(ctx);
    setFormat(suggested);
    const ep = generateForgeEpisode({ format: suggested, tone, context: ctx });
    setEpisode(ep);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!state]);

  const handleRegenerate = () => {
    if (!state) return;
    const ctx = selectForgeContextSnapshot(state);
    const nextIndex = (cycleIndex + 1) % FORMAT_CYCLE.length;
    const nextFormat = FORMAT_CYCLE[nextIndex];
    setCycleIndex(nextIndex);
    setFormat(nextFormat);
    const ep = generateForgeEpisode({ format: nextFormat, tone, context: ctx });
    setEpisode(ep);
  };

  const handleFormatChange = (f: ForgeEpisodeFormat) => {
    if (!state) return;
    setFormat(f);
    const ctx = selectForgeContextSnapshot(state);
    const ep = generateForgeEpisode({ format: f, tone, context: ctx });
    setEpisode(ep);
  };

  const handleToneChange = (t: ForgeEpisodeTone) => {
    if (!state) return;
    setTone(t);
    const ctx = selectForgeContextSnapshot(state);
    const ep = generateForgeEpisode({ format, tone: t, context: ctx });
    setEpisode(ep);
  };

  const handleFinalAction = (action: ForgeFinalAction) => {
    navigate(ACTION_ROUTES[action.action]);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 pb-8">
      <div>
        <div className="text-xs text-muted-foreground">/ forge</div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Your plan, cut into a sharp context clip.
        </p>
      </div>

      {/* Player — dominant */}
      {episode ? (
        <ForgeEpisodePlayer
          episode={episode}
          onFinalAction={handleFinalAction}
          onRegenerate={handleRegenerate}
        />
      ) : (
        <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-border bg-foreground text-background shadow-elevated">
          <span className="text-xs text-background/50">Generating episode…</span>
        </div>
      )}

      {/* Secondary controls */}
      <ForgeFormatSelector
        format={format}
        tone={tone}
        onChange={handleFormatChange}
        onToneChange={handleToneChange}
      />
    </div>
  );
};

export default Forge;
