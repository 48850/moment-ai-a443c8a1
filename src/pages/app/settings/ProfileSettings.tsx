import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSettingsStore, validateUsername } from "@/stores/settings-store";
import { useStateStore } from "@/stores/state-store";
import { MomentStar } from "@/components/app/Mote";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

export default function ProfileSettings() {
  const profile = useSettingsStore((s) => s.profile);
  const update = useSettingsStore((s) => s.updateProfile);
  const resetState = useStateStore((s) => s.reset);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const { uid } = useAuth();
  const navigate = useNavigate();

  const handleResetOnboarding = () => {
    const ok = window.confirm(
      "Reset onboarding? This clears your goal, plan, and progress, then sends you back to the start.",
    );
    if (!ok) return;
    resetState();
    navigate("/onboarding", { replace: true });
  };

  // Hydrate from server once
  useEffect(() => {
    if (!uid) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", uid)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        update({
          display_name: data.display_name ?? profile.display_name,
          username: data.handle ?? profile.username,
          main_goal: data.main_goal ?? profile.main_goal,
          school_stage: data.school_stage ?? profile.school_stage,
          subjects: data.subject_tags?.length ? data.subject_tags : profile.subjects,
        });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

  // Push to server when key fields change (debounced via timeout)
  useEffect(() => {
    if (!uid) return;
    const handle = profile.username && !validateUsername(profile.username) ? profile.username : null;
    const t = setTimeout(() => {
      const tags = profile.main_goal
        ? profile.main_goal
            .toLowerCase()
            .split(/[^a-z0-9]+/)
            .filter((w) => w.length > 2)
        : [];
      supabase
        .from("profiles")
        .update({
          display_name: profile.display_name || "New user",
          handle,
          main_goal: profile.main_goal || null,
          school_stage: profile.school_stage || null,
          goal_tags: tags,
          subject_tags: profile.subjects.map((s) => s.toLowerCase()),
        })
        .eq("id", uid)
        .then(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [uid, profile.display_name, profile.username, profile.main_goal, profile.school_stage, profile.subjects]);


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
