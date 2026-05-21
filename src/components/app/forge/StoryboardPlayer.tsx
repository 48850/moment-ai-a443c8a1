import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Mic, Sparkles, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------- Cartoon character presets — rendered via DiceBear avataaars ----------
// Each preset maps to deterministic DiceBear options so the avatar actually looks
// like the archetype (hat, hair, glasses, facial hair, skin, shirt color).
type CharacterPreset = {
  id: string;
  name: string;
  vibe: string;
  accent: string;
  shirt: string;
  // DiceBear `avataaars` options (https://www.dicebear.com/styles/avataaars/)
  dice: {
    seed: string;
    top?: string;        // hat / hair
    accessories?: string;
    facialHair?: string;
    clothing?: string;
    clothesColor?: string;
    skinColor?: string;
    hairColor?: string;
    eyebrows?: string;
    mouth?: string;
    eyes?: string;
  };
};

const CHARACTERS: CharacterPreset[] = [
  { id: "ranger", name: "Ranger Harrison", vibe: "Rugged action-hero dad", accent: "#e8b04a", shirt: "#7b4a2a",
    dice: { seed: "harrison", top: "shortHairShortFlat", hairColor: "724133", facialHair: "beardLight", skinColor: "edb98a",
            clothing: "collarAndSweater", clothesColor: "a55728", eyebrows: "default", mouth: "serious" } },
  { id: "rogue", name: "Rogue MC", vibe: "Hyped MMA podcast bro", accent: "#22d3a0", shirt: "#0b0b0b",
    dice: { seed: "rogan", top: "noHair", facialHair: "beardMedium", hairColor: "2c1b18", skinColor: "edb98a",
            accessories: "sunglasses", clothing: "hoodie", clothesColor: "262e33", mouth: "default" } },
  { id: "diva", name: "Pop Diva", vibe: "Chart-topper hype queen", accent: "#ffd166", shirt: "#ff4fa3",
    dice: { seed: "beyonce", top: "longHairBigHair", hairColor: "f59797", skinColor: "fd9841",
            clothing: "blazerAndShirt", clothesColor: "ff488e", eyebrows: "raisedExcited", mouth: "smile" } },
  { id: "mogul", name: "Mogul Talk", vibe: "Daytime mentor", accent: "#f4c75b", shirt: "#7c3aed",
    dice: { seed: "oprah", top: "longHairCurly", hairColor: "2c1b18", skinColor: "ae5d29",
            accessories: "prescription02", clothing: "blazerAndShirt", clothesColor: "65c9ff", mouth: "smile" } },
  { id: "tech", name: "Tech Bro CEO", vibe: "Keynote, black turtleneck", accent: "#5ad1ff", shirt: "#111111",
    dice: { seed: "ceo", top: "shortHairShortFlat", hairColor: "2c1b18", skinColor: "edb98a",
            accessories: "round", clothing: "shirtCrewNeck", clothesColor: "262e33", mouth: "default" } },
  { id: "chill", name: "Chill Legend", vibe: "Smooth West-coast narrator", accent: "#22d3a0", shirt: "#1e3a8a",
    dice: { seed: "snoop", top: "longHairStraight", hairColor: "0e0e0e", skinColor: "8d5524", facialHair: "moustacheFancy",
            clothing: "graphicShirt", clothesColor: "3c4f5c", mouth: "smile" } },
  { id: "cowboy", name: "Cowboy Storyteller", vibe: "Wise drawl, rodeo dad", accent: "#f4a261", shirt: "#9a3324",
    dice: { seed: "cowboy", top: "shortHairTheCaesar", hairColor: "a55728", skinColor: "f8d25c", facialHair: "beardMedium",
            clothing: "shirtScoopNeck", clothesColor: "ff5c5c", mouth: "default" } },
  { id: "indie", name: "Indie Director", vibe: "Whispery A24 voiceover", accent: "#e8b04a", shirt: "#3b3b3b",
    dice: { seed: "indie", top: "shortHairTheCaesarSidePart", hairColor: "2c1b18", skinColor: "edb98a", facialHair: "beardLight",
            accessories: "round", clothing: "hoodie", clothesColor: "3c4f5c", mouth: "serious" } },
  { id: "anchor", name: "News Anchor", vibe: "Breaking-news urgency", accent: "#ef4444", shirt: "#1d4ed8",
    dice: { seed: "anchor", top: "shortHairFrizzle", hairColor: "2c1b18", skinColor: "edb98a",
            clothing: "blazerAndShirt", clothesColor: "3c4f5c", mouth: "default" } },
  { id: "diva2", name: "Soul Queen", vibe: "Gospel hype, big love", accent: "#fcd34d", shirt: "#c026d3",
    dice: { seed: "soulqueen", top: "longHairCurvy", hairColor: "0e0e0e", skinColor: "614335",
            clothing: "blazerAndShirt", clothesColor: "ff488e", eyebrows: "raisedExcited", mouth: "smile" } },
];

function diceBearUrl(c: CharacterPreset): string {
  const params = new URLSearchParams();
  params.set("seed", c.dice.seed);
  params.set("backgroundType", "solid");
  params.set("backgroundColor", "transparent");
  const entries: [string, string | undefined][] = [
    ["top", c.dice.top], ["accessories", c.dice.accessories], ["facialHair", c.dice.facialHair],
    ["clothing", c.dice.clothing], ["clothesColor", c.dice.clothesColor], ["skinColor", c.dice.skinColor],
    ["hairColor", c.dice.hairColor], ["eyebrows", c.dice.eyebrows], ["mouth", c.dice.mouth], ["eyes", c.dice.eyes],
  ];
  for (const [k, v] of entries) if (v) params.set(k, v);
  // Force the chosen options (no random override)
  if (c.dice.accessories) params.set("accessoriesProbability", "100");
  if (c.dice.facialHair) params.set("facialHairProbability", "100");
  return `https://api.dicebear.com/9.x/avataaars/svg?${params.toString()}`;
}

function makeLocalAvatarSvg(c: CharacterPreset): string {
  const skin = `#${c.dice.skinColor ?? "edb98a"}`;
  const hair = `#${c.dice.hairColor ?? "2c1b18"}`;
  const shirt = c.shirt;
  const hat = c.dice.top?.includes("Caesar") || c.id === "cowboy";
  const bald = c.dice.top === "noHair";
  const glasses = Boolean(c.dice.accessories);
  const beard = Boolean(c.dice.facialHair);
  const smile = c.dice.mouth === "smile";
  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
      <defs><radialGradient id="g" cx="50%" cy="35%" r="65%"><stop stop-color="${c.accent}" stop-opacity=".34"/><stop offset="1" stop-color="#10131f" stop-opacity=".08"/></radialGradient></defs>
      <circle cx="80" cy="80" r="72" fill="url(#g)"/>
      <path d="M35 148c7-31 83-31 90 0" fill="${shirt}"/>
      <circle cx="80" cy="72" r="39" fill="${skin}"/>
      ${bald ? "" : `<path d="M43 69c2-31 22-47 43-43 25 5 33 25 31 43-17-12-50-19-74 0z" fill="${hair}"/>`}
      ${hat ? `<path d="M39 46c18-13 62-16 82 0l-7 13H46z" fill="${hair}"/><path d="M26 59h108" stroke="${c.accent}" stroke-width="8" stroke-linecap="round"/>` : ""}
      <circle cx="66" cy="72" r="4" fill="#141414"/><circle cx="94" cy="72" r="4" fill="#141414"/>
      ${glasses ? `<path d="M54 70h24v14H54zM84 70h24v14H84z" fill="none" stroke="#151515" stroke-width="4"/><path d="M78 77h6" stroke="#151515" stroke-width="4"/>` : ""}
      <path d="M72 86c4 3 12 3 16 0" stroke="#9b5b43" stroke-width="3" fill="none" stroke-linecap="round"/>
      ${beard ? `<path d="M55 93c13 23 39 23 50 0-4 31-45 34-50 0z" fill="${hair}" opacity=".72"/>` : ""}
      <path d="M64 104 ${smile ? "q16 16 32 0" : "q16 6 32 0"}" stroke="#161616" stroke-width="5" fill="none" stroke-linecap="round"/>
      <circle cx="50" cy="88" r="8" fill="#ff7b7b" opacity=".28"/><circle cx="110" cy="88" r="8" fill="#ff7b7b" opacity=".28"/>
    </svg>`)} `;
}




interface Segment {
  idx: number;
  host: "A" | "B";
  line: string;
  emotion?: string;
  audio_base64?: string;
}

interface LegacyScene {
  voiceover?: string;
  on_screen_text?: string;
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
  scenes?: LegacyScene[];
  hosts?: { A?: { name: string }; B?: { name: string } };
  palette?: { bg: string; fg: string; accent: string };
  call_to_action: CallToAction;
  has_voiceover?: boolean;
}

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
      const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) throw new Error("AudioContext unavailable");
      ctx = new AudioContextCtor();
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
      return video.scenes.map((s, i: number) => ({
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
  const [syntheticSpeaking, setSyntheticSpeaking] = useState(false);


  const seg = segments[segIdx];
  const audioLevel = useAudioLevel(audioEl);
  const [fallbackTick, setFallbackTick] = useState(0);
  useEffect(() => {
    if (!syntheticSpeaking) return;
    let raf = 0;
    const loop = () => { setFallbackTick((t) => t + 1); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [syntheticSpeaking]);
  const level = audioEl ? audioLevel : syntheticSpeaking ? 0.45 + Math.abs(Math.sin(fallbackTick / 3)) * 0.35 : 0;

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
      // No generated voiceover — use browser speech so the reel still has sound.
      const ms = Math.max(2400, seg.line.split(/\s+/).length * 280);
      setSegDuration(ms);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(seg.line);
        utterance.rate = 0.88;
        utterance.pitch = seg.host === "A" ? 0.88 : 1.08;
        utterance.volume = muted ? 0 : 1;
        utterance.onstart = () => setSyntheticSpeaking(true);
        utterance.onend = () => { setSyntheticSpeaking(false); advance(); };
        utterance.onerror = () => { setSyntheticSpeaking(false); advance(); };
        window.speechSynthesis.speak(utterance);
        return () => { window.speechSynthesis.cancel(); setSyntheticSpeaking(false); };
      }
      const t = setTimeout(advance, ms);
      return () => { clearTimeout(t); setSyntheticSpeaking(false); };
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
      setSyntheticSpeaking(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segIdx, playing, muted]);

  // Mute toggle propagation
  useEffect(() => { if (audioEl) audioEl.muted = muted; }, [muted, audioEl]);

  const revealed = useWordReveal(seg?.line ?? "", segDuration, playing && !!seg, segIdx);

  const start = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setStarted(true);
    setSegIdx(0);
    setPlaying(true);
  };

  const replay = () => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
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
          <div className="flex w-full items-end justify-center gap-6 md:gap-12">
            <div className="flex flex-col items-center gap-2">
              <HostAvatar
                name={customA}
                host="A"
                character={charA}
                active={activeHost === "A"}
                level={activeHost === "A" ? level : 0}
              />
              <button
                onClick={() => setEditing(editing === "A" ? null : "A")}
                className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm hover:bg-white/25"
              >
                <Pencil className="h-3 w-3" /> Cast A
              </button>
            </div>
            <div className="flex flex-col items-center gap-2">
              <HostAvatar
                name={customB}
                host="B"
                character={charB}
                active={activeHost === "B"}
                level={activeHost === "B" ? level : 0}
              />
              <button
                onClick={() => setEditing(editing === "B" ? null : "B")}
                className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider backdrop-blur-sm hover:bg-white/25"
              >
                <Pencil className="h-3 w-3" /> Cast B
              </button>
            </div>
          </div>

          {editing && (
            <div className="absolute inset-x-3 top-16 z-30 max-h-[55%] overflow-y-auto rounded-2xl border border-white/15 bg-black/85 p-3 backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
                  <Sparkles className="h-3.5 w-3.5" /> Cast Host {editing}
                </div>
                <button onClick={() => setEditing(null)} className="text-[11px] opacity-70 hover:opacity-100">Done</button>
              </div>
              <input
                value={editing === "A" ? customA : customB}
                onChange={(e) => (editing === "A" ? setCustomA(e.target.value) : setCustomB(e.target.value))}
                placeholder="Stage name (e.g. Harrison)"
                className="mb-2 w-full rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-sm placeholder:opacity-50 focus:border-white/40 focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-1.5 md:grid-cols-3">
                {CHARACTERS.map((c) => {
                  const selected = (editing === "A" ? charA.id : charB.id) === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => {
                        if (editing === "A") { setCharA(c); setCustomA(c.name); }
                        else { setCharB(c); setCustomB(c.name); }
                      }}
                      className={`rounded-xl border p-2 text-left transition ${selected ? "border-white bg-white/15" : "border-white/15 bg-white/5 hover:bg-white/10"}`}
                    >
                      <div className="text-[11px] font-bold leading-tight">{c.name}</div>
                      <div className="mt-0.5 text-[9px] opacity-60">{c.vibe}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
          <button onClick={() => setMuted((m) => !m)} className="rounded-full bg-white/15 p-3 backdrop-blur-sm hover:bg-white/25">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
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

function HostAvatar({ name, host, active, level, character }: { name: string; host: "A" | "B"; active: boolean; level: number; character: CharacterPreset }) {
  const avatarUrl = useMemo(() => makeLocalAvatarSvg(character), [character]);

  // Animate the wrapper instead of redrawing the face: bob, sway, tilt, breathe.
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let raf: number;
    const loop = () => { setTick((t) => t + 1); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const seed = host === "A" ? 0 : 1.7;
  const idle = Math.sin(tick / 22 + seed) * 1.3 + Math.sin(tick / 9 + seed * 2) * 0.5;
  const bob = active ? idle + level * 5 + Math.sin(tick / 4) * level * 2.5 : idle * 0.5;
  const tilt = active ? Math.sin(tick / 16 + seed) * 2.5 + level * 2 : Math.sin(tick / 40 + seed) * 0.8;
  const scale = active ? 1 + level * 0.06 + Math.sin(tick / 5) * level * 0.02 : 1;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative"
        style={{
          filter: active ? "drop-shadow(0 12px 24px rgba(0,0,0,0.4))" : "saturate(0.65) brightness(0.78)",
        }}
      >
        {/* Speaking pulse rings */}
        {active && (
          <>
            <div
              className="pointer-events-none absolute -inset-3 rounded-full"
              style={{
                boxShadow: `0 0 0 ${3 + level * 14}px ${character.accent}33, 0 0 0 ${10 + level * 22}px ${character.accent}1a`,
                transition: "box-shadow 80ms linear",
              }}
            />
            <div
              className="pointer-events-none absolute -inset-1 rounded-full"
              style={{
                background: `radial-gradient(circle at 50% 60%, ${character.accent}55 0%, transparent 60%)`,
                opacity: 0.4 + level * 0.6,
              }}
            />
          </>
        )}

        <div
          style={{
            transform: `translateY(${-bob}px) rotate(${tilt}deg) scale(${scale})`,
            transition: "transform 60ms linear",
          }}
        >
          <img
            src={avatarUrl}
            alt={name}
            width={140}
            height={140}
            className="block"
            draggable={false}
          />
        </div>

        {/* Mic badge (matches their accent) */}
        <div
          className="absolute -bottom-1 right-2 flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wider"
          style={{
            background: active ? character.accent : "rgba(255,255,255,0.15)",
            color: active ? "#0a0a0a" : "rgba(255,255,255,0.8)",
            boxShadow: active ? `0 4px 12px ${character.accent}66` : "none",
          }}
        >
          <Mic className="h-2.5 w-2.5" />
          {active && <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
        </div>
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
