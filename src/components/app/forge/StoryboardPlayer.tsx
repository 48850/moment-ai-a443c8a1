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
  const startedAtRef = useRef<number | null>(null);
  const elapsedRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play voiceover for current scene
  useEffect(() => {
    if (!playing) return;
    const scene = scenes[sceneIdx];
    if (!scene?.audio_base64 || muted) return;
    const audio = new Audio(`data:audio/mpeg;base64,${scene.audio_base64}`);
    audioRef.current = audio;
    audio.play().catch((e) => console.warn("audio play failed", e));
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [sceneIdx, playing, muted, scenes]);

  // Scene advancing
  useEffect(() => {
    if (!playing || scenes.length === 0) return;
    startedAtRef.current = performance.now();
    let raf = 0;
    const tick = () => {
      if (startedAtRef.current == null) return;
      const now = performance.now();
      const live = elapsedRef.current + (now - startedAtRef.current);
      setProgressMs(Math.min(live, totalMs));
      // figure out which scene we're on
      let acc = 0;
      let idx = 0;
      for (let i = 0; i < scenes.length; i++) {
        acc += scenes[i].duration_seconds * 1000;
        if (live <= acc) { idx = i; break; }
        idx = i;
      }
      if (idx !== sceneIdx) setSceneIdx(idx);
      if (live >= totalMs) {
        setPlaying(false);
        elapsedRef.current = 0;
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (startedAtRef.current != null) {
        elapsedRef.current += performance.now() - startedAtRef.current;
        startedAtRef.current = null;
      }
    };
  }, [playing, scenes, totalMs, sceneIdx]);

  const scene = scenes[sceneIdx] ?? scenes[0];
  if (!scene) return null;

  const replay = () => {
    elapsedRef.current = 0;
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
