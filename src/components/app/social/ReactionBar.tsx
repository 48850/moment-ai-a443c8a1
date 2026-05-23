import { useSettingsStore, type ReactionKind } from "@/stores/settings-store";

const REACTIONS: { kind: ReactionKind; label: string; emoji: string }[] = [
  { kind: "nice", label: "Nice", emoji: "👍" },
  { kind: "still_moving", label: "Still moving", emoji: "🚶" },
  { kind: "good_reset", label: "Good reset", emoji: "🔄" },
  { kind: "big_brain", label: "Big brain", emoji: "🧠" },
  { kind: "review_saved", label: "Review saved", emoji: "📌" },
  { kind: "keep_going", label: "Keep going", emoji: "🔥" },
];

interface Props {
  eventId: string;
}

export function ReactionBar({ eventId }: Props) {
  const mine = useSettingsStore((s) => s.reactions[eventId]) ?? EMPTY;
  const toggle = useSettingsStore((s) => s.toggleReaction);

  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {REACTIONS.map((r) => {
        const active = mine.includes(r.kind);
        return (
          <button
            key={r.kind}
            type="button"
            onClick={() => toggle(eventId, r.kind)}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
              active
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
            aria-pressed={active}
          >
            <span aria-hidden>{r.emoji}</span>
            <span>{r.label}</span>
            {active && <span className="ml-0.5 font-mono text-[10px]">1</span>}
          </button>
        );
      })}
    </div>
  );
}
