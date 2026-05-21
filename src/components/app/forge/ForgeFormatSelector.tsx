import type { ForgeEpisodeFormat, ForgeEpisodeTone } from "@/lib/types/forge-episode";

const FORMATS: Array<{ value: ForgeEpisodeFormat; label: string }> = [
  { value: "context_roast", label: "Roast" },
  { value: "courtroom_trial", label: "Trial" },
  { value: "fake_news", label: "News" },
  { value: "villain_arc", label: "Villain" },
  { value: "mission_briefing", label: "Mission" },
  { value: "goal_trailer", label: "Trailer" },
  { value: "weekly_recap", label: "Recap" },
  { value: "task_rescue", label: "Rescue" },
];

const TONES: Array<{ value: ForgeEpisodeTone; label: string }> = [
  { value: "deadpan", label: "Deadpan" },
  { value: "chaotic", label: "Chaotic" },
  { value: "cinematic", label: "Cinematic" },
  { value: "dry", label: "Dry" },
];

export function ForgeFormatSelector({
  format,
  tone,
  onChange,
  onToneChange,
}: {
  format: ForgeEpisodeFormat;
  tone: ForgeEpisodeTone;
  onChange: (f: ForgeEpisodeFormat) => void;
  onToneChange: (t: ForgeEpisodeTone) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {FORMATS.map((f) => (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            className={[
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
              format === f.value
                ? "bg-white/15 text-white border border-white/30"
                : "bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 hover:text-white/80",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TONES.map((t) => (
          <button
            key={t.value}
            onClick={() => onToneChange(t.value)}
            className={[
              "rounded-full px-2.5 py-1 text-[11px] transition-colors",
              tone === t.value
                ? "bg-white/10 text-white/80 border border-white/20"
                : "text-white/30 hover:text-white/60",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
