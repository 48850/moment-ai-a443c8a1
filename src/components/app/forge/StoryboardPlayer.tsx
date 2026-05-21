import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Mic, Sparkles, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

// ---------- Ghibli-inspired podcaster cast ----------
// Painterly, niche archetypes (no celebrity look-alikes). Each one binds to a
// real ElevenLabs voice so swapped hosts sound human, not robotic.
type GhibliFace = {
  // sky / scene
  sky: [string, string];        // background gradient
  groundTint: string;           // soft halo behind shoulders
  // skin & hair
  skin: string;
  blush: string;
  hair: string;
  hairStyle: "long-wavy" | "short-tuft" | "bob" | "cap" | "buzz" | "scarf" | "braid" | "bald-knot" | "hood" | "topknot";
  hairAccent?: string;          // leaves, feather, ribbon
  // wardrobe
  collar: string;
  collarTrim?: string;
  // face
  mouth: "soft-smile" | "open-awe" | "thin-line" | "smirk" | "round-o";
  brows: "soft" | "raised" | "tilted";
  freckles?: boolean;
  // floating motif (Ghibli touch — soot sprite, leaf, koi, star)
  motif?: "leaf" | "spark" | "sprite" | "koi" | "feather" | "moth";
};

type CharacterPreset = {
  id: string;
  name: string;
  vibe: string;
  accent: string;
  shirt: string;
  // ElevenLabs voice (live TTS for ANY swapped host — no browser fallback robot voice)
  voiceId: string;
  voiceTuning?: { stability?: number; similarity_boost?: number; style?: number; speed?: number };
  // browser-TTS last-resort settings (only if edge function fails)
  voice: { pitch: number; rate: number; volume: number; hints: string[] };
  face: GhibliFace;
};

const CHARACTERS: CharacterPreset[] = [
  { id: "forest-sage", name: "Forest Sage Hina", vibe: "Whispery moss-grove storyteller", accent: "#a8d5a2", shirt: "#3b5d3a",
    voiceId: "EXAVITQu4vr4xnSDxMaL", // Sarah — warm, soft
    voiceTuning: { stability: 0.6, style: 0.35, speed: 0.95 },
    voice: { pitch: 1.08, rate: 0.88, volume: 1, hints: ["Samantha", "Karen"] },
    face: { sky: ["#cfe7c8", "#7fae8d"], groundTint: "#e9f3df", skin: "#f6d6b8", blush: "#f2a59a",
            hair: "#3a2a1d", hairStyle: "long-wavy", hairAccent: "#9bc792",
            collar: "#5e7a4f", collarTrim: "#d8c690", mouth: "soft-smile", brows: "soft", freckles: true, motif: "leaf" } },
  { id: "sky-pirate", name: "Sky Pirate Cal", vibe: "Goggles-up airship rogue", accent: "#f4a261", shirt: "#7b3f1c",
    voiceId: "JBFqnCBsd6RMkjVDRZzb", // George — gravelly warm
    voiceTuning: { stability: 0.4, style: 0.55, speed: 1.0 },
    voice: { pitch: 0.82, rate: 1.0, volume: 1, hints: ["Daniel", "Alex"] },
    face: { sky: ["#f7d9a8", "#c97a3c"], groundTint: "#fbe7c8", skin: "#e9bb8c", blush: "#e07a4f",
            hair: "#1c1208", hairStyle: "cap", hairAccent: "#a05a2c",
            collar: "#5a2e15", collarTrim: "#f0c87a", mouth: "smirk", brows: "raised", motif: "feather" } },
  { id: "junior-witch", name: "Junior Witch Mei", vibe: "First-broom rookie hype", accent: "#ffd5e5", shirt: "#1d1230",
    voiceId: "cgSgspJ2msm6clMCkdW9", // Jessica — bright young
    voiceTuning: { stability: 0.35, style: 0.6, speed: 1.05 },
    voice: { pitch: 1.25, rate: 1.05, volume: 1, hints: ["Samantha"] },
    face: { sky: ["#1f1437", "#5a2d6b"], groundTint: "#3a225a", skin: "#fbe0c6", blush: "#ff9bb2",
            hair: "#1a0f08", hairStyle: "bob", hairAccent: "#ff6fa8",
            collar: "#0e0a1f", collarTrim: "#ffd5e5", mouth: "open-awe", brows: "raised", motif: "spark" } },
  { id: "bathhouse", name: "Bathhouse Auntie Yu", vibe: "Steamy gossip with wisdom", accent: "#e8b04a", shirt: "#a02c3a",
    voiceId: "XrExE9yKIg1WjnnlVkGX", // Matilda — warm matriarch
    voiceTuning: { stability: 0.55, style: 0.45, speed: 0.95 },
    voice: { pitch: 1.05, rate: 0.92, volume: 1, hints: ["Samantha", "Karen"] },
    face: { sky: ["#f7d6c2", "#b6604a"], groundTint: "#fbe2d2", skin: "#e8b896", blush: "#d9695a",
            hair: "#1c1208", hairStyle: "topknot", hairAccent: "#e8b04a",
            collar: "#7a1f2a", collarTrim: "#f0d28a", mouth: "soft-smile", brows: "soft", motif: "sprite" } },
  { id: "tea-granny", name: "Tea-Shop Granny Iro", vibe: "Soft drawl, ancient receipts", accent: "#c9a84c", shirt: "#3a4a2b",
    voiceId: "pFZP5JQG7iQjIQuC4Bku", // Lily — gentle
    voiceTuning: { stability: 0.65, style: 0.3, speed: 0.9 },
    voice: { pitch: 1.0, rate: 0.85, volume: 1, hints: ["Karen"] },
    face: { sky: ["#dccfa6", "#8a7a4a"], groundTint: "#efe3c2", skin: "#e8c9a6", blush: "#c47a6a",
            hair: "#d8d2c0", hairStyle: "bob", hairAccent: "#c9a84c",
            collar: "#5a6a3a", collarTrim: "#d8c690", mouth: "soft-smile", brows: "soft", freckles: true, motif: "leaf" } },
  { id: "wind-pilot", name: "Wind Pilot Ren", vibe: "Wide-eyed glider kid", accent: "#7ec8e3", shirt: "#1a3c5a",
    voiceId: "IKne3meq5aSn9XLyUdCD", // Charlie — youthful
    voiceTuning: { stability: 0.4, style: 0.5, speed: 1.0 },
    voice: { pitch: 1.1, rate: 1.02, volume: 1, hints: ["Daniel", "Alex"] },
    face: { sky: ["#c6e6f5", "#3a7aa5"], groundTint: "#e3f1f7", skin: "#f6d6b8", blush: "#e89a8a",
            hair: "#3a2a1d", hairStyle: "short-tuft", hairAccent: "#7ec8e3",
            collar: "#2a4a6a", collarTrim: "#f0d890", mouth: "open-awe", brows: "raised", freckles: true, motif: "feather" } },
  { id: "castle-wiz", name: "Castle Apprentice Ash", vibe: "Moody fashion sorcerer", accent: "#d9a8ff", shirt: "#1f1432",
    voiceId: "N2lVS1w4EtoT3dr4eOWO", // Callum — moody whisper
    voiceTuning: { stability: 0.55, style: 0.5, speed: 0.95 },
    voice: { pitch: 0.92, rate: 0.88, volume: 0.9, hints: ["Daniel", "Alex"] },
    face: { sky: ["#2a1f48", "#6a3d8a"], groundTint: "#3a2856", skin: "#f0d8c2", blush: "#c97aa0",
            hair: "#f4dfa8", hairStyle: "long-wavy", hairAccent: "#d9a8ff",
            collar: "#0f0a1a", collarTrim: "#d9a8ff", mouth: "thin-line", brows: "tilted", motif: "moth" } },
  { id: "tide-girl", name: "Tide-Caller Nami", vibe: "Bubbly sea-spirit kid", accent: "#ff8a8a", shirt: "#c44a4a",
    voiceId: "XB0fDUnXU5powFXDhCwa", // fallback to Charlotte if allowed... keep Jessica
    voiceTuning: { stability: 0.35, style: 0.65, speed: 1.05 },
    voice: { pitch: 1.3, rate: 1.05, volume: 1, hints: ["Samantha"] },
    face: { sky: ["#c8e0f5", "#4a8ac8"], groundTint: "#dceaf5", skin: "#fce0c8", blush: "#ff8a8a",
            hair: "#a02828", hairStyle: "bob", hairAccent: "#ffb84a",
            collar: "#8a2828", collarTrim: "#ffd5b0", mouth: "round-o", brows: "raised", freckles: true, motif: "koi" } },
  { id: "boar-hunter", name: "Boar-God Hunter Sho", vibe: "Stoic forest ranger", accent: "#e8b04a", shirt: "#3a2818",
    voiceId: "onwK4e9ZLuTAKqWW03F9", // Daniel — calm, deep
    voiceTuning: { stability: 0.6, style: 0.35, speed: 0.92 },
    voice: { pitch: 0.78, rate: 0.88, volume: 1, hints: ["Daniel", "Alex"] },
    face: { sky: ["#3a4a3a", "#1a2a1a"], groundTint: "#4a5a4a", skin: "#d8a878", blush: "#a05848",
            hair: "#0a0a0a", hairStyle: "scarf", hairAccent: "#c44a3a",
            collar: "#2a1a10", collarTrim: "#c9a84c", mouth: "thin-line", brows: "tilted", motif: "leaf" } },
  { id: "soot-bard", name: "Soot Bard Kuro", vibe: "Tiny chaos sprite MC", accent: "#ffd166", shirt: "#0a0a0a",
    voiceId: "TX3LPaxmHKxFdv7VOQHJ", // Liam — playful
    voiceTuning: { stability: 0.35, style: 0.65, speed: 1.05 },
    voice: { pitch: 1.1, rate: 1.08, volume: 1, hints: ["Daniel", "Alex"] },
    face: { sky: ["#1a1a2a", "#3a2a4a"], groundTint: "#2a2a3a", skin: "#1a1a1a", blush: "#ff6fa8",
            hair: "#0a0a0a", hairStyle: "buzz", hairAccent: "#ffd166",
            collar: "#0a0a0a", collarTrim: "#ffd166", mouth: "smirk", brows: "raised", motif: "sprite" } },
];

// Fix tide-girl voice — must be in allowlist (use Jessica which is allowed)
CHARACTERS.find((c) => c.id === "tide-girl")!.voiceId = "cgSgspJ2msm6clMCkdW9";

// ---------- Ghibli-style painterly avatar ----------
// Soft watercolor sky, big round eyes, gentle blush, painterly hair shapes,
// floating Ghibli motif (leaf / sprite / spark / koi / feather / moth).
function makeLocalAvatarSvg(c: CharacterPreset): string {
  const f = c.face;
  const id = c.id.replace(/[^a-z0-9]/gi, "");
  const eyeShine = "#ffffff";
  const eyeColor = "#1a1208";
  const lineColor = "#3a2a20";

  const hair = (() => {
    switch (f.hairStyle) {
      case "long-wavy": return `<path d="M28 80 Q22 50 50 30 Q80 12 110 28 Q138 44 134 84 Q132 110 124 130 Q116 100 110 80 Q96 90 80 86 Q60 92 50 84 Q44 110 36 130 Q28 110 28 80z" fill="${f.hair}"/>`;
      case "short-tuft": return `<path d="M36 72 Q34 42 70 30 Q108 22 128 50 Q132 70 128 84 Q108 70 88 74 Q74 64 60 78 Q48 70 36 84z" fill="${f.hair}"/><path d="M62 28 Q72 18 86 28" stroke="${f.hair}" stroke-width="6" fill="none" stroke-linecap="round"/>`;
      case "bob": return `<path d="M30 76 Q26 44 58 28 Q92 18 122 36 Q138 58 134 90 Q120 78 110 78 L108 96 Q86 92 78 96 L74 78 Q56 80 46 90 Q38 84 30 76z" fill="${f.hair}"/>`;
      case "cap": return `<path d="M34 64 Q40 38 80 32 Q124 36 128 64 L128 70 L34 70z" fill="${f.hair}"/><path d="M28 70 L132 70" stroke="${f.hairAccent ?? f.hair}" stroke-width="5" stroke-linecap="round"/><circle cx="118" cy="48" r="6" fill="${f.hairAccent ?? f.hair}" opacity=".8"/>`;
      case "buzz": return `<path d="M40 70 Q44 50 80 46 Q116 50 120 70" fill="${f.hair}" opacity=".95"/>`;
      case "scarf": return `<path d="M30 70 Q40 40 80 36 Q120 40 130 70 L130 78 L30 78z" fill="${f.hair}"/><path d="M26 74 Q80 88 134 74 L138 92 Q80 102 22 92z" fill="${f.hairAccent ?? f.hair}"/>`;
      case "braid": return `<path d="M34 72 Q34 42 80 30 Q126 42 126 72 Q126 100 118 130 Q110 110 108 90 Q92 92 80 88 Q68 92 52 90 Q50 110 42 130 Q34 100 34 72z" fill="${f.hair}"/>`;
      case "bald-knot": return `<circle cx="80" cy="36" r="8" fill="${f.hair}"/><path d="M48 60 Q60 50 80 50 Q100 50 112 60" fill="${f.hair}" opacity=".4"/>`;
      case "hood": return `<path d="M22 90 Q22 36 80 28 Q138 36 138 90 L138 110 Q132 78 122 72 Q100 76 80 76 Q60 76 38 72 Q28 78 22 110z" fill="${f.hair}"/>`;
      case "topknot": return `<path d="M40 72 Q42 48 80 44 Q118 48 120 72" fill="${f.hair}"/><ellipse cx="80" cy="34" rx="14" ry="10" fill="${f.hair}"/><path d="M70 30 Q80 22 90 30" stroke="${f.hairAccent ?? f.hair}" stroke-width="5" fill="none"/>`;
      default: return "";
    }
  })();

  const mouth = (() => {
    switch (f.mouth) {
      case "soft-smile": return `<path d="M70 102 Q80 110 90 102" stroke="${lineColor}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
      case "open-awe": return `<ellipse cx="80" cy="105" rx="4" ry="5" fill="${lineColor}"/>`;
      case "thin-line": return `<path d="M72 104 L88 104" stroke="${lineColor}" stroke-width="2.2" stroke-linecap="round"/>`;
      case "smirk": return `<path d="M70 104 Q82 108 90 100" stroke="${lineColor}" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
      case "round-o": return `<circle cx="80" cy="105" r="4" fill="${lineColor}"/>`;
    }
  })();

  const brows = (() => {
    switch (f.brows) {
      case "soft": return `<path d="M62 76 Q68 74 74 76 M86 76 Q92 74 98 76" stroke="${lineColor}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
      case "raised": return `<path d="M60 72 Q68 68 74 72 M86 72 Q92 68 98 72" stroke="${lineColor}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
      case "tilted": return `<path d="M62 78 L74 74 M86 74 L98 78" stroke="${lineColor}" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    }
  })();

  const motif = (() => {
    switch (f.motif) {
      case "leaf": return `<g transform="translate(20 30) rotate(-20)"><path d="M0 0 Q8 -6 16 0 Q8 10 0 0z" fill="${f.hairAccent ?? "#9bc792"}"/><path d="M2 2 L14 -2" stroke="#3a5a3a" stroke-width="0.8"/></g><g transform="translate(132 110) rotate(25)"><path d="M0 0 Q6 -4 12 0 Q6 8 0 0z" fill="${f.hairAccent ?? "#9bc792"}" opacity=".8"/></g>`;
      case "spark": return `<g fill="${c.accent}"><circle cx="22" cy="36" r="1.6"/><circle cx="28" cy="28" r="1"/><circle cx="138" cy="44" r="1.4"/><circle cx="132" cy="36" r="1"/><circle cx="142" cy="110" r="1.6"/><path d="M18 50 l2 2 l-2 2 l-2 -2z" /></g>`;
      case "sprite": return `<g><circle cx="22" cy="42" r="6" fill="#0a0a0a"/><circle cx="20" cy="40" r="1.6" fill="#fff"/><circle cx="24" cy="40" r="1.6" fill="#fff"/><circle cx="20" cy="40" r="0.6" fill="#000"/><circle cx="24" cy="40" r="0.6" fill="#000"/><circle cx="138" cy="118" r="5" fill="#0a0a0a"/><circle cx="136" cy="116" r="1.3" fill="#fff"/><circle cx="140" cy="116" r="1.3" fill="#fff"/></g>`;
      case "koi": return `<g transform="translate(20 122)"><path d="M0 0 Q10 -8 22 0 Q18 6 22 12 Q10 6 0 12 Q4 6 0 0z" fill="${c.accent}" opacity=".9"/><circle cx="6" cy="4" r="1.2" fill="#1a1208"/></g>`;
      case "feather": return `<g transform="translate(132 30) rotate(35)"><path d="M0 0 Q4 -10 0 -22 Q-4 -10 0 0z" fill="${f.hairAccent ?? c.accent}"/><path d="M0 -2 L0 -20" stroke="#3a2818" stroke-width="0.8"/></g>`;
      case "moth": return `<g transform="translate(22 38)"><path d="M0 0 Q-6 -4 -8 0 Q-6 4 0 2 Q6 4 8 0 Q6 -4 0 0z" fill="${f.hairAccent ?? "#d9a8ff"}" opacity=".9"/></g>`;
      default: return "";
    }
  })();

  return `data:image/svg+xml;utf8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">
      <defs>
        <radialGradient id="sky${id}" cx="50%" cy="40%" r="75%">
          <stop offset="0%" stop-color="${f.sky[0]}"/>
          <stop offset="100%" stop-color="${f.sky[1]}"/>
        </radialGradient>
        <radialGradient id="halo${id}" cx="50%" cy="60%" r="50%">
          <stop offset="0%" stop-color="${f.groundTint}" stop-opacity=".95"/>
          <stop offset="100%" stop-color="${f.groundTint}" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="cheek${id}" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="${f.blush}" stop-opacity=".7"/>
          <stop offset="100%" stop-color="${f.blush}" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <circle cx="80" cy="80" r="78" fill="url(#sky${id})"/>
      <circle cx="80" cy="100" r="60" fill="url(#halo${id})"/>
      <!-- soft clouds -->
      <ellipse cx="34" cy="58" rx="18" ry="5" fill="#ffffff" opacity=".35"/>
      <ellipse cx="124" cy="48" rx="22" ry="6" fill="#ffffff" opacity=".28"/>
      <!-- shoulders / collar -->
      <path d="M14 156 Q40 124 80 122 Q120 124 146 156 L146 160 L14 160z" fill="${f.collar}"/>
      <path d="M60 124 Q80 134 100 124 L100 132 Q80 140 60 132z" fill="${f.collarTrim ?? f.collar}" opacity=".95"/>
      <!-- neck -->
      <path d="M70 110 Q80 118 90 110 L92 122 Q80 126 68 122z" fill="${f.skin}"/>
      <path d="M68 122 Q80 126 92 122" stroke="${lineColor}" stroke-width="1.2" fill="none" opacity=".4"/>
      <!-- face shape (rounded heart) -->
      <path d="M44 76 Q44 46 80 42 Q116 46 116 76 Q116 102 80 116 Q44 102 44 76z" fill="${f.skin}"/>
      <!-- hair layer -->
      ${hair}
      <!-- cheeks -->
      <circle cx="58" cy="94" r="9" fill="url(#cheek${id})"/>
      <circle cx="102" cy="94" r="9" fill="url(#cheek${id})"/>
      ${f.freckles ? `<g fill="${lineColor}" opacity=".5"><circle cx="64" cy="92" r="0.7"/><circle cx="68" cy="94" r="0.6"/><circle cx="92" cy="94" r="0.6"/><circle cx="96" cy="92" r="0.7"/></g>` : ""}
      <!-- eyes (big round Ghibli) -->
      <g>
        <ellipse cx="66" cy="86" rx="6" ry="7.5" fill="#fff"/>
        <ellipse cx="94" cy="86" rx="6" ry="7.5" fill="#fff"/>
        <ellipse cx="66" cy="87" rx="4.4" ry="6" fill="${eyeColor}"/>
        <ellipse cx="94" cy="87" rx="4.4" ry="6" fill="${eyeColor}"/>
        <circle cx="64.5" cy="85" r="1.6" fill="${eyeShine}"/>
        <circle cx="92.5" cy="85" r="1.6" fill="${eyeShine}"/>
        <circle cx="67.6" cy="89" r="0.8" fill="${eyeShine}" opacity=".7"/>
        <circle cx="95.6" cy="89" r="0.8" fill="${eyeShine}" opacity=".7"/>
        <!-- top lash -->
        <path d="M60 82 Q66 78 72 82" stroke="${lineColor}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
        <path d="M88 82 Q94 78 100 82" stroke="${lineColor}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
      </g>
      ${brows}
      <!-- nose -->
      <path d="M80 92 Q78 98 80 100" stroke="${lineColor}" stroke-width="1.4" fill="none" stroke-linecap="round" opacity=".55"/>
      ${mouth}
      <!-- chin shadow -->
      <path d="M60 112 Q80 122 100 112" stroke="${lineColor}" stroke-width="1" fill="none" opacity=".25"/>
      ${motif}
    </svg>`)}`;
}

function pickSpeechVoice(character: CharacterPreset): SpeechSynthesisVoice | undefined {
  if (!("speechSynthesis" in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  const englishVoices = voices.filter((v) => /^en[-_]/i.test(v.lang));
  const pool = englishVoices.length ? englishVoices : voices;
  const hintedVoice = character.voice.hints
    .map((hint) => pool.find((v) => v.name.toLowerCase().includes(hint.toLowerCase())))
    .find(Boolean);
  return hintedVoice ?? pool[0];
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
  const [castVersion, setCastVersion] = useState(0);

  // Start paused — autoplay is blocked by the browser until a user gesture.
  const [started, setStarted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [segIdx, setSegIdx] = useState(0);
  const [segDuration, setSegDuration] = useState(2500);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);
  const [syntheticSpeaking, setSyntheticSpeaking] = useState(false);

  // Cache ElevenLabs results by `${segIdx}::${character.id}` so swapping back is instant.
  const ttsCacheRef = useRef<Map<string, string>>(new Map());
  const [, setCacheTick] = useState(0);

  const seg = segments[segIdx];
  const activeCharacter = seg?.host === "B" ? charB : charA;
  // If user has swapped the cast, ignore the pre-baked audio and use ElevenLabs
  // for the swapped character. Otherwise use the original generated audio.
  const cacheKey = seg ? `${segIdx}::${activeCharacter.id}` : "";
  const cached = cacheKey ? ttsCacheRef.current.get(cacheKey) : undefined;
  // Always use per-character ElevenLabs voice — the pre-baked audio only has
  // two generic host voices and doesn't match the Ghibli cast.
  const activeAudioBase64 = cached;

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

  // Fetch ElevenLabs audio for the swapped character if we don't have it cached yet.
  useEffect(() => {
    if (!playing || !seg) return;
    if (cached) return; // already have it
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("forge-character-tts", {
          body: {
            text: seg.line,
            voiceId: activeCharacter.voiceId,
            ...(activeCharacter.voiceTuning ?? {}),
          },
        });
        if (cancelled) return;
        if (error || !data?.audio_base64) {
          console.warn("character tts failed, falling back to browser speech", error);
          return;
        }
        ttsCacheRef.current.set(`${segIdx}::${activeCharacter.id}`, data.audio_base64);
        setCacheTick((t) => t + 1);
      } catch (e) {
        console.warn("character tts threw", e);
      }
    })();
    return () => { cancelled = true; };
  }, [playing, segIdx, activeCharacter, castVersion, cached, seg]);

  // Play current segment audio
  useEffect(() => {
    if (!playing || !seg) return;
    const BREATH_MS = 380;

    const advance = () => {
      if (segIdx + 1 < segments.length) {
        setTimeout(() => setSegIdx((i) => i + 1), BREATH_MS);
      } else {
        setPlaying(false);
      }
    };

    if (!activeAudioBase64) {
      // Either ElevenLabs is still loading (swapped cast) or it failed.
      // Use browser speech as a short bridge so the reel doesn't freeze.
      const ms = Math.max(2400, seg.line.split(/\s+/).length * (290 / activeCharacter.voice.rate));
      setSegDuration(ms);
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(seg.line);
        utterance.voice = pickSpeechVoice(activeCharacter) ?? null;
        utterance.rate = activeCharacter.voice.rate;
        utterance.pitch = activeCharacter.voice.pitch;
        utterance.volume = muted ? 0 : activeCharacter.voice.volume;
        utterance.onstart = () => setSyntheticSpeaking(true);
        utterance.onend = () => { setSyntheticSpeaking(false); advance(); };
        utterance.onerror = () => { setSyntheticSpeaking(false); advance(); };
        window.speechSynthesis.speak(utterance);
        return () => { window.speechSynthesis.cancel(); setSyntheticSpeaking(false); };
      }
      const t = setTimeout(advance, ms);
      return () => { clearTimeout(t); setSyntheticSpeaking(false); };
    }

    const audio = new Audio(`data:audio/mpeg;base64,${activeAudioBase64}`);
    audio.muted = muted;
    audio.volume = 1;
    setAudioEl(audio);
    const onLoaded = () => setSegDuration(Math.max(1200, audio.duration * 1000));
    const onEnded = () => advance();
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    audio.play().catch((e) => {
      console.warn("audio play blocked, advancing on timer", e);
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
  }, [segIdx, playing, muted, activeAudioBase64, activeCharacter]);

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
                        setCastVersion((v) => v + 1);
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
          <Waveform level={level} accent={palette.accent} active={!!activeAudioBase64 || syntheticSpeaking} />
        </div>

        {/* Live caption */}
        <div className="absolute inset-x-0 bottom-20 z-20 px-6">
          <div className="mx-auto max-w-[92%] text-center">
            <div className="mb-1.5 text-[10px] uppercase tracking-[0.3em] opacity-70">
              {activeHost === "A" ? customA : customB}
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
