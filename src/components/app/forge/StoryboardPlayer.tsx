import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Mic, Sparkles, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------- Cartoon character presets (celebrity-flavored archetypes) ----------
type CharacterPreset = {
  id: string;
  name: string;
  vibe: string;
  palette: { skin: string; skinShade: string; hair: string; shirt: string; accent: string };
  features: {
    hairStyle: "swoop" | "buzz" | "wavy" | "afro" | "bun" | "bald" | "longstraight" | "fedora";
    facialHair?: "stubble" | "goatee" | "mustache" | "beard";
    glasses?: "aviator" | "round" | "shades" | "rect";
    hat?: "fedora" | "cap" | "cowboy" | "beanie" | "crown";
    skinTone?: "light" | "tan" | "brown" | "deep";
  };
};

const CHARACTERS: CharacterPreset[] = [
  { id: "ranger",  name: "Ranger Harrison", vibe: "Rugged action-hero dad energy",
    palette: { skin: "#f1c79a", skinShade: "#cf9866", hair: "#5a4030", shirt: "#7b4a2a", accent: "#e8b04a" },
    features: { hairStyle: "swoop", facialHair: "stubble", hat: "fedora" } },
  { id: "rogue",   name: "Rogue MC", vibe: "Hyped MMA podcast bro",
    palette: { skin: "#eebd96", skinShade: "#c89572", hair: "#1a1a1a", shirt: "#0b0b0b", accent: "#22d3a0" },
    features: { hairStyle: "buzz", facialHair: "goatee", glasses: "shades" } },
  { id: "diva",    name: "Pop Diva", vibe: "Confident chart-topper hype queen",
    palette: { skin: "#e4b079", skinShade: "#c08a55", hair: "#f6d365", shirt: "#ff4fa3", accent: "#ffd166" },
    features: { hairStyle: "wavy", hat: "crown" } },
  { id: "mogul",   name: "Mogul Talk", vibe: "Daytime mentor / life coach",
    palette: { skin: "#a26b46", skinShade: "#7e4f30", hair: "#1a1a1a", shirt: "#7c3aed", accent: "#f4c75b" },
    features: { hairStyle: "afro", glasses: "rect" } },
  { id: "tech",    name: "Tech Bro CEO", vibe: "Keynote, black turtleneck",
    palette: { skin: "#f3cda6", skinShade: "#cfa179", hair: "#3a3a3a", shirt: "#111111", accent: "#5ad1ff" },
    features: { hairStyle: "buzz", glasses: "round" } },
  { id: "chill",   name: "Chill Legend", vibe: "Smooth West-coast narrator",
    palette: { skin: "#8b5a36", skinShade: "#6a4023", hair: "#1a1a1a", shirt: "#1e3a8a", accent: "#22d3a0" },
    features: { hairStyle: "longstraight", facialHair: "mustache", hat: "beanie" } },
  { id: "cowboy",  name: "Cowboy Storyteller", vibe: "Wise drawl, rodeo dad",
    palette: { skin: "#e9b88a", skinShade: "#c08a5c", hair: "#a87038", shirt: "#9a3324", accent: "#f4a261" },
    features: { hairStyle: "wavy", facialHair: "beard", hat: "cowboy" } },
  { id: "indie",   name: "Indie Director", vibe: "Whispery A24 voiceover",
    palette: { skin: "#ecc9a5", skinShade: "#c8a07c", hair: "#2b1f17", shirt: "#3b3b3b", accent: "#e8b04a" },
    features: { hairStyle: "bun", glasses: "round", facialHair: "stubble" } },
  { id: "anchor",  name: "News Anchor", vibe: "Breaking-news urgency",
    palette: { skin: "#f1c79a", skinShade: "#cf9866", hair: "#1a1a1a", shirt: "#1d4ed8", accent: "#ef4444" },
    features: { hairStyle: "swoop" } },
  { id: "diva2",   name: "Soul Queen", vibe: "Gospel hype, big love",
    palette: { skin: "#7a4a2a", skinShade: "#5a341c", hair: "#0a0a0a", shirt: "#c026d3", accent: "#fcd34d" },
    features: { hairStyle: "afro" } },
];


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
        analyser.getByteFrequencyData(buf as Uint8Array<ArrayBuffer>);
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

  // Editable cast — user can swap each host for a celebrity-flavored cartoon character.
  const [charA, setCharA] = useState<CharacterPreset>(CHARACTERS[0]);
  const [charB, setCharB] = useState<CharacterPreset>(CHARACTERS[2]);
  const [editing, setEditing] = useState<"A" | "B" | null>(null);
  const [customA, setCustomA] = useState(hostAName);
  const [customB, setCustomB] = useState(hostBName);

  // Start paused — autoplay is blocked by the browser until a user gesture.
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [segIdx, setSegIdx] = useState(0);
  const [segDuration, setSegDuration] = useState(2500);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);


  const seg = segments[segIdx];
  const level = useAudioLevel(audioEl);

  // Play current segment audio
  useEffect(() => {
    if (!playing || !seg) return;
    const BREATH_MS = 380; // small pause between segments so it doesn't feel rushed

    const advance = () => {
      if (segIdx + 1 < segments.length) {
        setTimeout(() => setSegIdx((i) => i + 1), BREATH_MS);
      } else {
        setPlaying(false);
      }
    };

    if (!seg.audio_base64) {
      // No audio — estimate read time from word count, but slower so captions are legible
      const ms = Math.max(2400, seg.line.split(/\s+/).length * 280);
      setSegDuration(ms);
      const t = setTimeout(advance, ms);
      return () => clearTimeout(t);
    }

    const audio = new Audio(`data:audio/mpeg;base64,${seg.audio_base64}`);
    audio.muted = muted;
    audio.volume = 1;
    setAudioEl(audio);
    const onLoaded = () => setSegDuration(Math.max(1200, audio.duration * 1000));
    const onEnded = () => advance();
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.play().catch((e) => {
      console.warn("audio play blocked, advancing on timer", e);
      // Fallback: advance after estimated read time
      const ms = Math.max(2400, seg.line.split(/\s+/).length * 280);
      setSegDuration(ms);
      setTimeout(advance, ms);
    });
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

  const start = () => {
    setStarted(true);
    setSegIdx(0);
    setPlaying(true);
  };

  const replay = () => {
    setSegIdx(0);
    setPlaying(true);
    setStarted(true);
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

        {/* Bottom progress bar */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
          <div className="h-full" style={{ width: `${progressPct}%`, background: palette.accent, transition: "width 200ms linear" }} />
        </div>

        {/* Tap-to-start overlay (required to unlock autoplay) */}
        {!started && (
          <button
            onClick={start}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-sm"
          >
            <div className="grid h-20 w-20 place-items-center rounded-full bg-white/95 shadow-2xl transition-transform hover:scale-105">
              <Play className="h-8 w-8 translate-x-0.5 fill-black text-black" />
            </div>
            <div className="text-sm font-semibold uppercase tracking-[0.25em]">Tap to play</div>
            <div className="text-xs opacity-70">With sound · {segments.length} segments</div>
          </button>
        )}

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
  // Cartoon-style talking head, lip-syncs to audio level.
  // Host A — warm/orange. Host B — cool/violet.
  const palette = host === "A"
    ? { skin: "#f9c89b", skinShade: "#e0a37a", hair: "#3a1f12", shirt: "#ff5a36", accent: "#ffd166" }
    : { skin: "#f4d3b5", skinShade: "#d9b08b", hair: "#1f2540", shirt: "#7c5cff", accent: "#5ad1ff" };

  // Blink every ~3.5s
  const [blink, setBlink] = useState(false);
  useEffect(() => {
    let t: any;
    const loop = () => {
      const next = 2500 + Math.random() * 2500;
      t = setTimeout(() => {
        setBlink(true);
        setTimeout(() => setBlink(false), 130);
        loop();
      }, next);
    };
    loop();
    return () => clearTimeout(t);
  }, []);

  // Head bob & body sway driven by audio level + a constant idle sine
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let raf: number;
    const loop = () => { setTick((t) => t + 1); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const idle = Math.sin(tick / 18) * 1.5;
  const bob = active ? idle + level * 5 : idle * 0.4;
  const sway = active ? Math.sin(tick / 14) * 3 + level * 4 : Math.sin(tick / 30) * 1.2;

  // Mouth opens with level
  const mouthOpen = active ? 3 + level * 14 : 1.5;
  const mouthW = active ? 12 + level * 6 : 10;
  const eyeY = blink ? 0.05 : 1;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ filter: active ? "none" : "saturate(0.55) brightness(0.75)" }}>
        {/* Pulse rings when speaking */}
        {active && (
          <>
            <div
              className="absolute inset-0 rounded-full"
              style={{
                boxShadow: `0 0 0 ${4 + level * 12}px ${palette.shirt}33`,
                transition: "box-shadow 80ms linear",
              }}
            />
          </>
        )}

        <svg
          width="120"
          height="140"
          viewBox="0 0 120 140"
          className="drop-shadow-2xl"
          style={{ transform: `translateY(${-bob * 0.4}px) rotate(${sway * 0.3}deg)`, transition: "transform 60ms linear" }}
        >
          {/* Body / shirt */}
          <path
            d={`M 20 140 Q 20 95 60 92 Q 100 95 100 140 Z`}
            fill={palette.shirt}
          />
          {/* Neck */}
          <rect x="52" y="78" width="16" height="14" fill={palette.skinShade} rx="3" />
          {/* Head group (bobs with audio) */}
          <g style={{ transform: `translateY(${-bob}px) rotate(${sway * 0.5}deg)`, transformOrigin: "60px 60px", transition: "transform 60ms linear" }}>
            {/* Hair back */}
            <ellipse cx="60" cy="40" rx="34" ry="32" fill={palette.hair} />
            {/* Face */}
            <ellipse cx="60" cy="50" rx="28" ry="32" fill={palette.skin} />
            {/* Hair front fringe */}
            {host === "A" ? (
              <path d={`M 32 38 Q 60 18 88 38 Q 75 30 60 32 Q 45 30 32 38 Z`} fill={palette.hair} />
            ) : (
              <path d={`M 34 36 Q 60 14 86 36 Q 78 26 60 28 Q 42 26 34 36 Z M 84 36 Q 90 50 88 60 L 84 56 Z`} fill={palette.hair} />
            )}
            {/* Cheeks */}
            <circle cx="44" cy="58" r="4" fill={palette.shirt} opacity="0.22" />
            <circle cx="76" cy="58" r="4" fill={palette.shirt} opacity="0.22" />
            {/* Eyes (blink by scaling Y) */}
            <g style={{ transform: `scaleY(${eyeY})`, transformOrigin: "60px 50px", transition: "transform 70ms" }}>
              <ellipse cx="48" cy="50" rx="3.2" ry="4" fill="#1a1a1a" />
              <ellipse cx="72" cy="50" rx="3.2" ry="4" fill="#1a1a1a" />
              <circle cx="49" cy="49" r="1" fill="#fff" />
              <circle cx="73" cy="49" r="1" fill="#fff" />
            </g>
            {/* Brows raise slightly when speaking */}
            <path d={`M 42 ${42 - level * 2} Q 48 ${39 - level * 2} 54 ${42 - level * 2}`} stroke={palette.hair} strokeWidth="2" fill="none" strokeLinecap="round" />
            <path d={`M 66 ${42 - level * 2} Q 72 ${39 - level * 2} 78 ${42 - level * 2}`} stroke={palette.hair} strokeWidth="2" fill="none" strokeLinecap="round" />
            {/* Mouth — lip syncs */}
            <ellipse
              cx="60"
              cy={68 + mouthOpen / 4}
              rx={mouthW / 2}
              ry={mouthOpen / 2}
              fill="#2a1018"
            />
            {/* Tongue hint when wide open */}
            {mouthOpen > 8 && (
              <ellipse cx="60" cy={70 + mouthOpen / 4} rx={mouthW / 3} ry={mouthOpen / 4} fill="#d6566a" opacity="0.7" />
            )}
          </g>
          {/* Mic */}
          <g style={{ transform: `translate(${74 + sway * 0.3}px, ${88 + bob * 0.2}px)`, transition: "transform 60ms linear" }}>
            <rect x="0" y="0" width="10" height="16" rx="5" fill="#1a1a1a" />
            <rect x="-2" y="14" width="14" height="3" rx="1.5" fill="#1a1a1a" />
            <rect x="3" y="17" width="4" height="10" fill="#1a1a1a" />
            {active && <circle cx="5" cy="6" r="2" fill="#ff4444" />}
          </g>
        </svg>
      </div>
      <div className={`text-[11px] font-bold uppercase tracking-wider ${active ? "opacity-100" : "opacity-50"}`}>
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
