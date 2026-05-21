import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import type { ForgeEpisode, ForgeFinalAction } from "@/lib/types/forge-episode";
import { ForgeSceneRenderer } from "./ForgeSceneRenderer";
import { ForgeProgressBar } from "./ForgeProgressBar";
import { ForgeFinalActionButton } from "./ForgeFinalActionButton";

const TICK_MS = 100;

export function ForgeEpisodePlayer({
  episode,
  onFinalAction,
  onRegenerate,
}: {
  episode: ForgeEpisode | null;
  onFinalAction: (action: ForgeFinalAction) => void;
  onRegenerate: () => void;
}) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0); // seconds within current scene
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset when episode changes
  useEffect(() => {
    setSceneIndex(0);
    setElapsed(0);
    setPlaying(true);
    setFinished(false);
  }, [episode?.id]);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!playing || !episode || finished) return;

    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        const scenes = episode.scenes;
        const scene = scenes[sceneIndex];
        if (!scene) return prev;

        const next = prev + TICK_MS / 1000;
        if (next >= scene.durationSeconds) {
          if (sceneIndex + 1 < scenes.length) {
            setSceneIndex((s) => s + 1);
            return 0;
          } else {
            setFinished(true);
            setPlaying(false);
            return scene.durationSeconds;
          }
        }
        return next;
      });
    }, TICK_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing, episode, sceneIndex, finished]);

  function handleReplay() {
    setSceneIndex(0);
    setElapsed(0);
    setFinished(false);
    setPlaying(true);
  }

  const currentScene = episode?.scenes[sceneIndex] ?? null;
  const sceneProgress = currentScene
    ? Math.min(elapsed / currentScene.durationSeconds, 1)
    : 0;

  return (
    <div className="w-full">
      {/* 9:16 player */}
      <div
        className="relative mx-auto overflow-hidden rounded-2xl bg-[#080810]"
        style={{ aspectRatio: "9/16", maxHeight: "70vh" }}
      >
        {/* Grain overlay */}
        <div
          className="pointer-events-none absolute inset-0 z-10 opacity-[0.03] mix-blend-overlay"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
            backgroundSize: "128px",
          }}
        />

        {/* Progress bar */}
        {episode && (
          <div className="absolute top-0 inset-x-0 z-20">
            <ForgeProgressBar
              scenes={episode.scenes}
              currentIndex={sceneIndex}
              sceneProgress={sceneProgress}
            />
          </div>
        )}

        {/* Scene */}
        {episode && currentScene && (
          <ForgeSceneRenderer
            scene={currentScene}
            sceneIndex={sceneIndex}
            elapsed={elapsed}
          />
        )}

        {/* Loading state */}
        {!episode && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="h-8 w-8 rounded-full border-2 border-indigo-500/50 border-t-indigo-400 animate-spin" />
            <p className="text-xs text-white/40">Generating episode…</p>
          </div>
        )}

        {/* Final action overlay */}
        {finished && episode && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/70 backdrop-blur-sm">
            <div className="text-center px-6">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2">Next move</p>
              <ForgeFinalActionButton
                action={episode.finalAction}
                onAction={onFinalAction}
              />
            </div>
            <button
              onClick={handleReplay}
              className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Replay
            </button>
          </div>
        )}

        {/* Play/pause control */}
        {!finished && episode && (
          <button
            onClick={() => setPlaying((p) => !p)}
            className="absolute bottom-3 right-3 z-20 flex items-center justify-center h-8 w-8 rounded-full bg-black/50 border border-white/15 text-white/70 hover:text-white hover:bg-black/70 transition-colors"
          >
            {playing ? (
              <Pause className="h-3.5 w-3.5" />
            ) : (
              <Play className="h-3.5 w-3.5 translate-x-[1px]" />
            )}
          </button>
        )}

        {/* Episode title badge */}
        {episode && !finished && (
          <div className="absolute bottom-3 left-3 z-20">
            <span className="text-[10px] text-white/30 leading-none">{episode.title}</span>
          </div>
        )}
      </div>

      {/* Below-player controls */}
      {episode && (
        <div className="mt-3 flex items-center justify-between px-1">
          <div className="text-[11px] text-muted-foreground">
            {episode.format.replace("_", " ")} · {episode.tone}
          </div>
          <button
            onClick={onRegenerate}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Generate another
          </button>
        </div>
      )}
    </div>
  );
}
