import { useSettingsStore } from "@/stores/settings-store";
import { SectionCard } from "./ProfileSettings";
import { Toggle } from "./PrivacySettings";

export default function NotificationSettings() {
  const n = useSettingsStore((s) => s.notifications);
  const update = useSettingsStore((s) => s.updateNotifications);

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="What you want to hear about">
        <Toggle label="Task reminders" checked={n.task_reminders} onChange={(v) => update({ task_reminders: v })} />
        <Toggle label="Friend check-ins" checked={n.friend_checkins} onChange={(v) => update({ friend_checkins: v })} />
        <Toggle label="Streak reminders" checked={n.streak_reminders} onChange={(v) => update({ streak_reminders: v })} />
        <Toggle label="Weekly recap" checked={n.weekly_recap} onChange={(v) => update({ weekly_recap: v })} />
        <Toggle
          label="Forge review reminders"
          checked={n.forge_review_reminders}
          onChange={(v) => update({ forge_review_reminders: v })}
        />
      </SectionCard>
      <p className="text-xs text-muted-foreground">
        These preferences are saved now. Push delivery turns on when the friend system ships.
      </p>
    </div>
  );
}
