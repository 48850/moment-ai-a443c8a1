import { SectionCard } from "./ProfileSettings";
import { Check } from "lucide-react";

const FREE = [
  "Daily plan + tasks",
  "Reflect, Rescue, Forge",
  "Personal progress feed",
  "Preset reactions",
];

const PLUS = [
  "Friend streaks dashboard",
  "Aligned-goal communities",
  "Long-form weekly recaps",
  "Priority Moment AI runs",
  "Custom Moment Star palettes",
];

export default function PlusSettings() {
  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Moment Plus">
        <p className="text-sm text-muted-foreground">
          Plus is in the works. No nags, no countdowns. You'll see a subtle chip on Plus-only features when
          they ship.
        </p>
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-2">
        <SectionCard title="Free">
          <ul className="flex flex-col gap-2 text-sm">
            {FREE.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-primary" /> {f}
              </li>
            ))}
          </ul>
        </SectionCard>
        <SectionCard title="Plus">
          <ul className="flex flex-col gap-2 text-sm">
            {PLUS.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 text-primary" /> {f}
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled
            className="mt-2 rounded-lg border border-border bg-card px-4 py-2 text-xs text-muted-foreground"
          >
            Coming soon
          </button>
        </SectionCard>
      </div>
    </div>
  );
}
