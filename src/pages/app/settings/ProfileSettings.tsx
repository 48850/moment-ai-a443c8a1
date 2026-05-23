import { useState } from "react";
import { useSettingsStore, validateUsername } from "@/stores/settings-store";
import { MomentStar } from "@/components/app/Mote";

export default function ProfileSettings() {
  const profile = useSettingsStore((s) => s.profile);
  const update = useSettingsStore((s) => s.updateProfile);
  const [usernameError, setUsernameError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Identity">
        <Field label="Display name">
          <input
            type="text"
            maxLength={40}
            value={profile.display_name}
            onChange={(e) => update({ display_name: e.target.value })}
            className="input"
            placeholder="Your name"
          />
        </Field>
        <Field
          label="Username"
          help="3–20 chars · lowercase letters, numbers, underscore"
          error={usernameError ?? undefined}
        >
          <input
            type="text"
            maxLength={20}
            value={profile.username}
            onChange={(e) => {
              const v = e.target.value.toLowerCase();
              update({ username: v });
              setUsernameError(validateUsername(v));
            }}
            className="input"
            placeholder="e.g. jerry_42"
          />
        </Field>
        <Field label="Bio" help={`${profile.bio.length}/160`}>
          <textarea
            maxLength={160}
            rows={3}
            value={profile.bio}
            onChange={(e) => update({ bio: e.target.value })}
            className="input resize-none"
            placeholder="One line about what you're working on."
          />
        </Field>
      </SectionCard>

      <SectionCard title="Goal context">
        <Field label="Main goal">
          <input
            type="text"
            value={profile.main_goal}
            onChange={(e) => update({ main_goal: e.target.value })}
            className="input"
            placeholder="e.g. Get into med school"
          />
        </Field>
        <Field label="School stage">
          <select
            value={profile.school_stage}
            onChange={(e) => update({ school_stage: e.target.value })}
            className="input"
          >
            <option value="">Select…</option>
            <option value="year_10">Year 10 / Sophomore</option>
            <option value="year_11">Year 11 / Junior</option>
            <option value="year_12">Year 12 / Senior</option>
            <option value="year_13">Year 13 / Gap year</option>
            <option value="university">University</option>
            <option value="other">Other</option>
          </select>
        </Field>
        <Field label="Subjects / interests" help="Comma separated">
          <input
            type="text"
            value={profile.subjects.join(", ")}
            onChange={(e) =>
              update({
                subjects: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
            className="input"
            placeholder="Biology, Philosophy, Code"
          />
        </Field>
      </SectionCard>

      <SectionCard title="Moment Star">
        <div className="flex items-center gap-4">
          <MomentStar size={72} bounce mood="calm" />
          <div className="flex-1">
            <label className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Hue
            </label>
            <input
              type="range"
              min={0}
              max={360}
              step={5}
              value={profile.star_hue}
              onChange={(e) => update({ star_hue: Number(e.target.value) })}
              className="mt-1 w-full"
            />
            <p className="text-xs text-muted-foreground">{profile.star_hue}°</p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

export function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-medium">{title}</h2>
      <div className="flex flex-col gap-4">{children}</div>
    </div>
  );
}

export function Field({
  label,
  children,
  help,
  error,
}: {
  label: string;
  children: React.ReactNode;
  help?: string;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      {children}
      {error ? (
        <span className="text-xs text-destructive">{error}</span>
      ) : help ? (
        <span className="text-xs text-muted-foreground">{help}</span>
      ) : null}
    </label>
  );
}
