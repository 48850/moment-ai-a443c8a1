import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import type { ForgeEpisode, ForgeFinalAction } from "@/lib/types/forge-episode";
import { ForgeSceneRenderer } from "./ForgeSceneRenderer";
import { ForgeProgressBar } from "./ForgeProgressBar";
import { ForgeFinalActionButton } from "./ForgeFinalActionButton";

interface Props {
  episode: ForgeEpisode;
  onFinalAction: (action: ForgeFinalAction) => void;
  onRegenerate: () => void;
}

export function ForgeEpisodePlayer({ episode, onFinalAction, onRegenerate }: Props) {
  const [sceneIndex, setSceneIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [finished, setFinished] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const currentScene = episode.scenes[sceneIndex];

  // Reset on new episode
  useEffect(() => {
    setSceneIndex(0);
    setElapsed(0);
    setPlaying(true);
    setFinished(false);
  }, [episode.id]);

  useEffect(() => {
    if (!playing || finished) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + 0.1;
        if (next >= currentScene.durationSeconds) {
          const nextIndex = sceneIndex + 1;
          if (nextIndex >= episode.scenes.length) {
            setFinished(true);
            setPlaying(false);
            return prev;
          }
          setSceneIndex(nextIndex);
          return 0;
        }
        return next;
      });
    }, 100);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, finished, sceneIndex, currentScene?.durationSeconds, episode.scenes.length]);

  const progress = currentScene ? Math.min(1, elapsed / currentScene.durationSeconds) : 0;

  const handleReplay = () => {
    setSceneIndex(0);
    setElapsed(0);
    setFinished(false);
    setPlaying(true);
  };

  return (
    <div
      className="relative min-h-[520px] w-full overflow-hidden rounded-lg border border-border bg-foreground text-background shadow-elevated sm:min-h-[620px] lg:min-h-[640px]"
    >
      {/* Subtle grain */}
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-25 mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Scene */}
      <div className="absolute inset-0">
        {currentScene && (
          <ForgeSceneRenderer
            scene={currentScene}
            elapsed={elapsed}
            sceneIndex={sceneIndex}
          />
        )}
      </div>

      {/* Overlay: progress bar + controls */}
      <div className="absolute inset-x-0 top-3 z-20 flex flex-col gap-2">
        <div className="px-3">
          <ForgeProgressBar
            scenes={episode.scenes}
            currentIndex={sceneIndex}
            progress={progress}
          />
        </div>
        <div className="flex items-center justify-between px-4 sm:px-6">
          <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-background/50">
            {episode.format.replace(/_/g, " ")}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={handleReplay}
              className="rounded-full p-1 text-background/50 transition hover:text-background/80"
              aria-label="Replay"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setPlaying((p) => !p)}
              className="rounded-full p-1 text-background/50 transition hover:text-background/80"
              aria-label={playing ? "Pause" : "Play"}
            >
              {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className="absolute inset-x-0 bottom-24 z-20 px-4 sm:bottom-28">
        <AnimatePresence>
          {!finished && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-[10px] font-mono uppercase tracking-[0.15em] text-background/35"
            >
              {episode.title}
            </motion.p>
          )}
        </AnimatePresence>
      </div>

      {/* Final action overlay */}
      <AnimatePresence>
        {finished && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-x-0 bottom-8 z-20 mx-auto flex max-w-md flex-col gap-3 px-5"
          >
            <p className="text-center text-[10px] font-mono uppercase tracking-[0.2em] text-background/50">
              Next move
            </p>
            <ForgeFinalActionButton
              finalAction={episode.finalAction}
              onAction={() => onFinalAction(episode.finalAction)}
            />
            <button
              onClick={onRegenerate}
              className="text-center text-[11px] text-background/45 underline underline-offset-2 transition hover:text-background/70"
            >
              Generate another
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
