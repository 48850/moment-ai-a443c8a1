import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Scene {
  scene_number: number;
  visual_prompt: string;
  voiceover: string;
  on_screen_text: string;
  duration_seconds: number;
  palette: { bg: string; fg: string; accent: string };
  audio_base64?: string;
}

interface CallToAction {
  kind: string;
  label: string;
  task_id?: string;
  node_id?: string;
  prompt?: string;
}

interface ContextVideo {
  id: string;
  title: string;
  caption: string;
  scenes: Scene[];
  call_to_action: CallToAction;
  has_voiceover?: boolean;
}

export function StoryboardPlayer({
  video,
  onCta,
  onReplay,
}: {
  video: ContextVideo;
  onCta?: (cta: CallToAction) => void;
  onReplay?: () => void;
}) {
  const scenes = video.scenes ?? [];
  const totalMs = useMemo(
    () => scenes.reduce((acc, s) => acc + (s.duration_seconds || 4) * 1000, 0),
    [scenes],
  );

  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [sceneIdx, setSceneIdx] = useState(0);
  const [progressMs, setProgressMs] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const sceneStartRef = useRef<number>(0);
  const elapsedBeforeRef = useRef<number>(0);

  // Play voiceover for current scene; advance only when audio ends (or fallback timer)
  useEffect(() => {
    if (!playing) return;
    const scene = scenes[sceneIdx];
    if (!scene) return;

    sceneStartRef.current = performance.now();
    let timeoutId: number | undefined;
    let audio: HTMLAudioElement | null = null;

    const advance = () => {
      setSceneIdx((i) => {
        if (i + 1 >= scenes.length) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    };

    const fallbackMs = Math.max(1500, (scene.duration_seconds || 4) * 1000);

    if (scene.audio_base64 && !muted) {
      audio = new Audio(`data:audio/mpeg;base64,${scene.audio_base64}`);
      audioRef.current = audio;
      audio.addEventListener("ended", advance);
      audio.play().catch((e) => {
        console.warn("audio play failed", e);
        timeoutId = window.setTimeout(advance, fallbackMs);
      });
      // Hard safety cap
      timeoutId = window.setTimeout(advance, 30000);
    } else {
      timeoutId = window.setTimeout(advance, fallbackMs);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (audio) {
        audio.removeEventListener("ended", advance);
        audio.pause();
      }
      audioRef.current = null;
      elapsedBeforeRef.current += performance.now() - sceneStartRef.current;
    };
  }, [sceneIdx, playing, muted, scenes]);

  // Progress bar tick
  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const live = elapsedBeforeRef.current + (performance.now() - sceneStartRef.current);
      setProgressMs(Math.min(live, totalMs));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, totalMs, sceneIdx]);

  const scene = scenes[sceneIdx] ?? scenes[0];
  if (!scene) return null;

  const replay = () => {
    elapsedBeforeRef.current = 0;
    setProgressMs(0);
    setSceneIdx(0);
    setPlaying(true);
    onReplay?.();
  };

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-border bg-card">
      {/* Stage */}
      <div
        className="relative aspect-video w-full transition-colors duration-500"
        style={{
          background: `radial-gradient(120% 80% at 30% 20%, ${scene.palette.accent}33 0%, ${scene.palette.bg} 60%, ${scene.palette.bg} 100%)`,
          color: scene.palette.fg,
        }}
      >
        {/* animated accent blob */}
        <div
          key={`blob-${sceneIdx}`}
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-40 blur-3xl animate-pulse"
          style={{ background: scene.palette.accent }}
        />
        <div
          key={`blob2-${sceneIdx}`}
          className="pointer-events-none absolute -left-16 bottom-0 h-64 w-64 rounded-full opacity-25 blur-3xl"
          style={{ background: scene.palette.fg }}
        />

        {/* On-screen kinetic text */}
        <div className="relative z-10 flex h-full flex-col items-start justify-between p-8 md:p-12">
          <div className="text-[10px] uppercase tracking-[0.3em] opacity-60">
            Scene {sceneIdx + 1} / {scenes.length}
          </div>
          <div
            key={`text-${sceneIdx}`}
            className="max-w-[90%] text-4xl font-black leading-[0.95] tracking-tight md:text-6xl"
            style={{
              animation: "moment-pop 600ms cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            {scene.on_screen_text}
          </div>
          {scene.voiceover && (
            <div
              key={`vo-${sceneIdx}`}
              className="max-w-[90%] text-sm italic opacity-80 md:text-base"
              style={{ animation: "moment-fade 800ms ease-out" }}
            >
              "{scene.voiceover}"
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
          <div
            className="h-full transition-[width] duration-100"
            style={{
              width: `${Math.min(100, (progressMs / Math.max(1, totalMs)) * 100)}%`,
              background: scene.palette.accent,
            }}
          />
        </div>
      </div>

      {/* Controls + CTA */}
      <div className="flex items-center justify-between gap-3 border-t border-border bg-background/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setPlaying((p) => !p)}>
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="ghost" onClick={replay}>
            <RotateCcw className="h-4 w-4" />
          </Button>
          {video.has_voiceover && (
            <Button size="sm" variant="ghost" onClick={() => setMuted((m) => !m)}>
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          )}
        </div>
        <Button size="sm" onClick={() => onCta?.(video.call_to_action)} className="font-semibold">
          {video.call_to_action.label} →
        </Button>
      </div>

      {video.caption && (
        <div className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          {video.caption}
        </div>
      )}

      <style>{`
        @keyframes moment-pop {
          0% { transform: translateY(12px) scale(0.96); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes moment-fade {
          0% { opacity: 0; transform: translateY(6px); }
          100% { opacity: 0.85; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
