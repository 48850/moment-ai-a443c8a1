import { useMemo, useState } from "react";
import { useStateStore } from "@/stores/state-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useSurface } from "@/hooks/use-surface";
import { selectProgressEvents } from "@/lib/social/select-progress-events";
import { DEMO_FRIEND_EVENTS } from "@/lib/social/sample-friends";
import { ProgressEventCard } from "@/components/app/social/ProgressEventCard";
import { MomentStar } from "@/components/app/Mote";
import { Sparkles } from "lucide-react";

const PHONE_CAP = 5;

export default function Social() {
  const state = useStateStore((s) => s.state);
  const showDemo = useSettingsStore((s) => s.privacy.show_demo_friends);
  const display = useSettingsStore((s) => s.profile.display_name) || state?.profile?.display_name || "You";
  const surface = useSurface();
  const isPhone = surface === "mobile";
  const [expanded, setExpanded] = useState(false);

  const events = useMemo(() => {
    const mine = selectProgressEvents(state);
    const demos = showDemo ? DEMO_FRIEND_EVENTS : [];
    return [...mine, ...demos].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [state, showDemo]);

  const visible = isPhone && !expanded ? events.slice(0, PHONE_CAP) : events;

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6">
        <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
          <MomentStar size={48} bounce mood="calm" />
          Social
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Quiet feed of progress — yours and a few aligned demo friends. No counts, no rankings.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-[1fr_280px]">
        <section className="flex flex-col gap-3">
          {events.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm text-foreground">No progress yet today.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Complete one task and your first event will show up here.
              </p>
            </div>
          ) : (
            visible.map((e) => <ProgressEventCard key={e.id} event={e} />)
          )}

          {isPhone && events.length > PHONE_CAP && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-2 self-center rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Show {events.length - PHONE_CAP} more
            </button>
          )}

          {isPhone && (
            <button
              type="button"
              className="mt-4 rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground"
              onClick={() => window.history.back()}
            >
              Check in on today
            </button>
          )}
        </section>

        {!isPhone && (
          <aside className="flex flex-col gap-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <MomentStar size={44} mood="focused" />
                <div>
                  <p className="text-sm font-medium">{display}</p>
                  <p className="text-xs text-muted-foreground">Private profile · friends-only feed</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Reset, not ruined. Restart with one check-in.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Coming next
              </p>
              <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                <li>· Friend requests</li>
                <li>· Friend streaks</li>
                <li>· Aligned-goal discovery (opt-in)</li>
                <li>· Friends-only comments</li>
              </ul>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
