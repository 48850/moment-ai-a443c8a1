import type { ForgeEpisodeFormat, ForgeEpisodeTone } from "@/lib/types/forge-episode";

const FORMATS: Array<{ value: ForgeEpisodeFormat; label: string }> = [
  { value: "context_roast",    label: "Roast" },
  { value: "courtroom_trial",  label: "Trial" },
  { value: "fake_news",        label: "News" },
  { value: "villain_arc",      label: "Villain" },
  { value: "mission_briefing", label: "Mission" },
  { value: "goal_trailer",     label: "Trailer" },
  { value: "weekly_recap",     label: "Recap" },
  { value: "task_rescue",      label: "Rescue" },
];

const TONES: Array<{ value: ForgeEpisodeTone; label: string }> = [
  { value: "deadpan",  label: "Deadpan" },
  { value: "chaotic",  label: "Chaotic" },
  { value: "cinematic", label: "Cinematic" },
  { value: "dry",      label: "Dry" },
];

interface Props {
  format: ForgeEpisodeFormat;
  tone: ForgeEpisodeTone;
  onChange: (format: ForgeEpisodeFormat) => void;
  onToneChange: (tone: ForgeEpisodeTone) => void;
}

export function ForgeFormatSelector({ format, tone, onChange, onToneChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {FORMATS.map((f) => (
          <button
            key={f.value}
            onClick={() => onChange(f.value)}
            className={[
              "rounded-full px-3 py-0.5 text-[11px] font-medium transition",
              format === f.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
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
              "rounded-full px-3 py-0.5 text-[11px] transition",
              tone === t.value
                ? "bg-accent text-accent-foreground font-medium"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}
