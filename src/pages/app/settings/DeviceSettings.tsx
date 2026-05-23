import { useSettingsStore, type DeviceMode } from "@/stores/settings-store";
import { SectionCard, Field } from "./ProfileSettings";
import { useSurface } from "@/hooks/use-surface";

const MODES: { value: DeviceMode; label: string; help: string }[] = [
  { value: "auto", label: "Auto", help: "Match the screen size automatically" },
  { value: "phone", label: "Phone", help: "Simpler feed, fewer AI tasks, max 5 activity cards" },
  { value: "computer", label: "Computer", help: "Full layout, full AI generation" },
];

export default function DeviceSettings() {
  const mode = useSettingsStore((s) => s.device.mode);
  const setMode = useSettingsStore((s) => s.setDeviceMode);
  const surface = useSurface();

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Device mode">
        <Field
          label="Layout density"
          help={`Currently rendering as: ${surface === "mobile" ? "Phone" : "Computer"}`}
        >
          <div className="flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setMode(m.value)}
                className={`rounded-full border px-3 py-1.5 text-xs ${
                  mode === m.value
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border bg-card text-muted-foreground hover:text-foreground"
                }`}
                title={m.help}
              >
                {m.label}
              </button>
            ))}
          </div>
        </Field>
        <p className="text-xs text-muted-foreground">
          Phone mode keeps things uncluttered and asks the AI for fewer tasks. Computer mode gives you the
          full layout and full task generation.
        </p>
      </SectionCard>
    </div>
  );
}
