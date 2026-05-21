import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Segment {
  idx: number;
  host: "A" | "B";
  line: string;
  emotion?: string;
  audio_base64?: string;
}

interface CallToAction {
  kind: string;
  label: string;
  task_id?: string;
  node_id?: string;
  prompt?: string;
}

interface ContextReel {
  id: string;
  title: string;
  show_name?: string;
  caption?: string;
  hook?: string;
  segments?: Segment[];
  // legacy fallback
  scenes?: any[];
  hosts?: { A?: { name: string }; B?: { name: string } };
  palette?: { bg: string; fg: string; accent: string };
  call_to_action: CallToAction;
  has_voiceover?: boolean;
}

const HOST_STYLE = {
  A: {
    gradient: "from-orange-400 via-rose-500 to-fuchsia-600",
    ring: "ring-orange-300/60",
    initial: "B",
  },
  B: {
    gradient: "from-sky-400 via-violet-500 to-indigo-600",
    ring: "ring-sky-300/60",
    initial: "S",
  },
};

// Word-by-word reveal so captions feel like spoken speech.
function useWordReveal(text: string, durationMs: number, playing: boolean, key: number) {
  const [shown, setShown] = useState(0);
  const startRef = useRef<number | null>(null);
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  useEffect(() => {
    setShown(0);
    startRef.current = null;
    if (!playing || !text) return;
    let raf = 0;
    const tick = (t: number) => {
      if (startRef.current == null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / Math.max(400, durationMs));
      setShown(Math.floor(p * words.length));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setShown(words.length);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [key, playing, durationMs, text, words.length]);
  return words.slice(0, Math.max(1, shown)).join(" ");
}

// Audio-reactive amplitude (0..1) for whoever is speaking.
function useAudioLevel(audio: HTMLAudioElement | null) {
  const [level, setLevel] = useState(0);
  useEffect(() => {
    if (!audio) { setLevel(0); return; }
    let ctx: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let src: MediaElementAudioSourceNode | null = null;
    let raf = 0;
    let buf: Uint8Array | null = null;
    try {
      ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      src = ctx.createMediaElementSource(audio);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      analyser.connect(ctx.destination);
      buf = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        if (!analyser || !buf) return;
        analyser.getByteFrequencyData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i];
        setLevel(Math.min(1, sum / (buf.length * 180)));
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    } catch {
      // Cross-origin or reused element — fall back to fake level.
      const tick = () => { setLevel(0.4 + Math.random() * 0.35); raf = requestAnimationFrame(tick); };
      raf = requestAnimationFrame(tick);
    }
    return () => {
      cancelAnimationFrame(raf);
      try { src?.disconnect(); analyser?.disconnect(); ctx?.close(); } catch { /* noop */ }
    };
  }, [audio]);
  return level;
}

export function StoryboardPlayer({
  video,
  onCta,
  onReplay,
}: {
  video: ContextReel;
  onCta?: (cta: CallToAction) => void;
  onReplay?: () => void;
}) {
  // Legacy fallback for old saved videos with scenes[]
  const segments: Segment[] = useMemo(() => {
    if (video.segments?.length) return video.segments;
    if (video.scenes?.length) {
      return video.scenes.map((s: any, i: number) => ({
        idx: i,
        host: (i % 2 === 0 ? "A" : "B") as "A" | "B",
        line: s.voiceover || s.on_screen_text || "",
        audio_base64: s.audio_base64,
      }));
    }
    return [];
  }, [video.segments, video.scenes]);

  const hostAName = video.hosts?.A?.name ?? "Bridge";
  const hostBName = video.hosts?.B?.name ?? "Sasha";
  const palette = video.palette ?? { bg: "#0b0612", fg: "#ffffff", accent: "#ff5a36" };

  const [playing, setPlaying] = useState(true);
  const [muted, setMuted] = useState(false);
  const [segIdx, setSegIdx] = useState(0);
  const [segDuration, setSegDuration] = useState(2500);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  const seg = segments[segIdx];
  const level = useAudioLevel(audioEl);

  // Play current segment audio
  useEffect(() => {
    if (!playing || !seg) return;

    if (!seg.audio_base64) {
      // No audio — estimate read time from word count
      const ms = Math.max(1800, seg.line.split(/\s+/).length * 220);
      setSegDuration(ms);
      const t = setTimeout(() => {
        setSegIdx((i) => (i + 1 < segments.length ? i + 1 : i));
        if (segIdx + 1 >= segments.length) setPlaying(false);
      }, ms);
      return () => clearTimeout(t);
    }

    const audio = new Audio(`data:audio/mpeg;base64,${seg.audio_base64}`);
    audio.muted = muted;
    setAudioEl(audio);
    const onLoaded = () => setSegDuration(Math.max(800, audio.duration * 1000));
    const onEnded = () => {
      if (segIdx + 1 < segments.length) setSegIdx((i) => i + 1);
      else setPlaying(false);
    };
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.play().catch(() => { /* user gesture may be needed */ });
    return () => {
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
      audio.pause();
      setAudioEl(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segIdx, playing]);

  // Mute toggle propagation
  useEffect(() => { if (audioEl) audioEl.muted = muted; }, [muted, audioEl]);

  const revealed = useWordReveal(seg?.line ?? "", segDuration, playing && !!seg, segIdx);

  const replay = () => {
    setSegIdx(0);
    setPlaying(true);
    onReplay?.();
  };

  if (!seg) return null;

  const activeHost = seg.host;
  const totalSegs = segments.length;
  const progressPct = ((segIdx + (level > 0 ? Math.min(1, level + 0.2) : 0.5)) / totalSegs) * 100;

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-border bg-card shadow-2xl">
      {/* Stage — phone-reel aspect */}
      <div
        className="relative w-full overflow-hidden"
        style={{
          aspectRatio: "9 / 14",
          maxHeight: "75vh",
          background: `radial-gradient(140% 100% at 50% 0%, ${palette.accent}33 0%, ${palette.bg} 55%, #000 100%)`,
          color: palette.fg,
        }}
      >
        {/* Live podcast chrome */}
        <div className="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-5 pt-4 text-[10px] uppercase tracking-[0.25em]">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="opacity-80">{video.show_name ?? "Moment Daily"}</span>
          </div>
          <div className="opacity-60">EP · {video.title}</div>
        </div>

        {/* Segment progress dots (like IG stories) */}
        <div className="absolute inset-x-0 top-10 z-20 flex gap-1 px-4">
          {segments.map((_, i) => (
            <div key={i} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/15">
              <div
                className="h-full bg-white/90 transition-all"
                style={{ width: i < segIdx ? "100%" : i === segIdx ? `${Math.min(100, (1 - (level > 0 ? 0.4 : 0)) * 100)}%` : "0%" }}
              />
            </div>
          ))}
        </div>

        {/* Two-host stage */}
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-8 px-6 pt-20 pb-40">
          <div className="flex w-full items-center justify-center gap-6 md:gap-12">
            <HostAvatar
              name={hostAName}
              host="A"
              active={activeHost === "A"}
              level={activeHost === "A" ? level : 0}
            />
            <HostAvatar
              name={hostBName}
              host="B"
              active={activeHost === "B"}
              level={activeHost === "B" ? level : 0}
            />
          </div>

          {/* Waveform */}
          <Waveform level={level} accent={palette.accent} active={!!seg.audio_base64} />
        </div>

        {/* Live caption */}
        <div className="absolute inset-x-0 bottom-20 z-20 px-6">
          <div className="mx-auto max-w-[92%] text-center">
            <div className="mb-1.5 text-[10px] uppercase tracking-[0.3em] opacity-70">
              {activeHost === "A" ? hostAName : hostBName}
            </div>
            <div
              key={segIdx}
              className="text-[22px] font-bold leading-tight md:text-3xl"
              style={{ textShadow: "0 2px 24px rgba(0,0,0,0.6)" }}
            >
              {revealed}
              <span className="ml-0.5 inline-block h-[1em] w-[2px] animate-pulse bg-white/80 align-middle" />
            </div>
          </div>
        </div>

        {/* Bottom progress bar */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
          <div className="h-full" style={{ width: `${progressPct}%`, background: palette.accent, transition: "width 200ms linear" }} />
        </div>

        {/* Side controls — TikTok style */}
        <div className="absolute right-3 top-1/2 z-20 flex -translate-y-1/2 flex-col items-center gap-3">
          <button onClick={() => setPlaying((p) => !p)} className="rounded-full bg-white/15 p-3 backdrop-blur-sm hover:bg-white/25">
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button onClick={replay} className="rounded-full bg-white/15 p-3 backdrop-blur-sm hover:bg-white/25">
            <RotateCcw className="h-4 w-4" />
          </button>
          {video.has_voiceover && (
            <button onClick={() => setMuted((m) => !m)} className="rounded-full bg-white/15 p-3 backdrop-blur-sm hover:bg-white/25">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* Footer: caption + CTA */}
      <div className="space-y-3 border-t border-border bg-background/80 px-4 py-3">
        {video.caption && <div className="text-xs text-muted-foreground">{video.caption}</div>}
        <Button
          size="lg"
          onClick={() => onCta?.(video.call_to_action)}
          className="w-full font-bold"
          style={{ background: palette.accent }}
        >
          {video.call_to_action.label} →
        </Button>
      </div>
    </div>
  );
}

function HostAvatar({ name, host, active, level }: { name: string; host: "A" | "B"; active: boolean; level: number }) {
  const style = HOST_STYLE[host];
  const scale = 1 + (active ? level * 0.18 : 0);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        {/* Pulsing rings */}
        {active && (
          <>
            <div
              className={`absolute inset-0 rounded-full ring-4 ${style.ring}`}
              style={{ transform: `scale(${1 + level * 0.55})`, opacity: 0.55 - level * 0.3, transition: "transform 80ms linear" }}
            />
            <div
              className={`absolute inset-0 rounded-full ring-2 ${style.ring}`}
              style={{ transform: `scale(${1 + level * 0.9})`, opacity: 0.3 - level * 0.2, transition: "transform 80ms linear" }}
            />
          </>
        )}
        <div
          className={`relative grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br ${style.gradient} text-3xl font-black text-white shadow-2xl md:h-28 md:w-28`}
          style={{ transform: `scale(${scale})`, transition: "transform 80ms linear", filter: active ? "none" : "grayscale(0.4) brightness(0.7)" }}
        >
          {name[0]}
          {/* Mic badge */}
          <div className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full bg-black/80 ring-2 ring-white/30">
            <Mic className={`h-3.5 w-3.5 ${active ? "text-red-400" : "text-white/60"}`} />
          </div>
        </div>
      </div>
      <div className={`text-xs font-semibold uppercase tracking-wider ${active ? "opacity-100" : "opacity-50"}`}>
        {name}
      </div>
    </div>
  );
}

function Waveform({ level, accent, active }: { level: number; accent: string; active: boolean }) {
  const bars = 32;
  return (
    <div className="flex h-12 items-center gap-1">
      {Array.from({ length: bars }).map((_, i) => {
        const seed = Math.sin(i * 0.7) * 0.5 + 0.5;
        const base = active ? 0.2 + seed * 0.3 : 0.15;
        const h = active ? Math.min(1, base + level * (0.6 + seed * 0.6) * (0.5 + Math.random() * 0.5)) : 0.15;
        return (
          <div
            key={i}
            className="w-1 rounded-full"
            style={{
              height: `${h * 100}%`,
              background: accent,
              opacity: active ? 0.6 + h * 0.4 : 0.25,
              transition: "height 70ms linear",
            }}
          />
        );
      })}
    </div>
  );
}
