import { useSettingsStore, type Visibility } from "@/stores/settings-store";
import { SectionCard, Field } from "./ProfileSettings";

const VIS: { value: Visibility; label: string; help: string }[] = [
  { value: "private", label: "Private", help: "Only you can see" },
  { value: "friends", label: "Friends only", help: "Visible to accepted friends" },
  { value: "aligned", label: "Aligned goals", help: "Friends + people with the same goal" },
];

export default function PrivacySettings() {
  const privacy = useSettingsStore((s) => s.privacy);
  const update = useSettingsStore((s) => s.updatePrivacy);

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Visibility">
        <VisField
          label="Profile visibility"
          value={privacy.profile_visibility}
          onChange={(v) => update({ profile_visibility: v })}
        />
        <VisField
          label="Progress visibility"
          value={privacy.progress_visibility}
          onChange={(v) => update({ progress_visibility: v })}
        />
      </SectionCard>

      <SectionCard title="Discovery & contact">
        <Toggle
          label="Allow friend requests"
          help="People can ask to follow your progress."
          checked={privacy.allow_friend_requests}
          onChange={(v) => update({ allow_friend_requests: v })}
        />
        <Toggle
          label="Aligned-goal discovery"
          help="Let people with the same goal find you. Off by default."
          checked={privacy.aligned_goal_discovery}
          onChange={(v) => update({ aligned_goal_discovery: v })}
        />
        <Field label="Comments">
          <select
            value={privacy.comments_mode}
            onChange={(e) => update({ comments_mode: e.target.value as "off" | "friends" })}
            className="input"
          >
            <option value="off">Off</option>
            <option value="friends">Friends only</option>
          </select>
        </Field>
      </SectionCard>

      <SectionCard title="Social feed">
        <Toggle
          label="Show demo friends in feed"
          help="Sample activity from Jerry, Mia, Alex, and Sam — clearly tagged Demo."
          checked={privacy.show_demo_friends}
          onChange={(v) => update({ show_demo_friends: v })}
        />
      </SectionCard>
    </div>
  );
}

function VisField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Visibility;
  onChange: (v: Visibility) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-1.5">
        {VIS.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-full border px-3 py-1.5 text-xs ${
              value === o.value
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
            title={o.help}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function Toggle({
  label,
  help,
  checked,
  onChange,
}: {
  label: string;
  help?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-sm">{label}</p>
        {help && <p className="mt-0.5 text-xs text-muted-foreground">{help}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-background transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
