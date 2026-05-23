import { useMemo, useState } from "react";
import { useStateStore } from "@/stores/state-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useSurface } from "@/hooks/use-surface";
import { selectProgressEvents } from "@/lib/social/select-progress-events";
import { DEMO_FRIEND_EVENTS } from "@/lib/social/sample-friends";
import { ProgressEventCard } from "@/components/app/social/ProgressEventCard";
import { MomentStar } from "@/components/app/Mote";
import { Flame, ArrowRight, ShieldCheck, Users, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PHONE_CAP = 5;

// Lightweight derived friend-streak demo (no backend).
const FRIEND_STREAK = {
  with: "Alex",
  days: 4,
  goal: "app build",
  next: "test Forge review",
};

export default function Social() {
  const state = useStateStore((s) => s.state);
  const showDemo = useSettingsStore((s) => s.privacy.show_demo_friends);
  const display = useSettingsStore((s) => s.profile.display_name) || state?.profile?.display_name || "You";
  const surface = useSurface();
  const isPhone = surface === "mobile";
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();

  const { events, friendsMovedToday } = useMemo(() => {
    const mine = selectProgressEvents(state);
    const demos = showDemo ? DEMO_FRIEND_EVENTS : [];
    const all = [...mine, ...demos].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    const today = new Date().toDateString();
    const movers = new Set(
      all
        .filter((e) => !e.actor.isYou && new Date(e.timestamp).toDateString() === today)
        .map((e) => e.actor.name),
    );
    return { events: all, friendsMovedToday: movers.size || (showDemo ? 3 : 0) };
  }, [state, showDemo]);

  const visible = isPhone && !expanded ? events.slice(0, PHONE_CAP) : events;

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* HERO */}
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-950 via-slate-950 to-slate-900 p-6 md:p-8">
        {/* faint nebula glow */}
        <div className="pointer-events-none absolute -top-20 -right-10 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" aria-hidden />

        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <MomentStar size={isPhone ? 56 : 72} mood="focused" bounce />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">social</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                {friendsMovedToday > 0
                  ? `${friendsMovedToday} ${friendsMovedToday === 1 ? "friend" : "friends"} moved today.`
                  : "Quiet day in the orbit."}
              </h1>
              <p className="mt-1 text-sm text-white/70">
                Your next move is still open. Reset, not ruined.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate("/app")}
            className="group inline-flex items-center justify-center gap-2 self-start rounded-full bg-amber-300 px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_8px_30px_-12px_rgba(252,211,77,0.6)] transition hover:bg-amber-200"
          >
            Check in
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        {/* MAIN COLUMN */}
        <section className="flex flex-col gap-4">
          {/* FRIEND STREAK */}
          <article className="relative overflow-hidden rounded-2xl border border-orange-400/20 bg-gradient-to-br from-orange-500/[0.08] via-amber-400/[0.04] to-transparent p-5">
            <div className="flex items-center gap-4">
              <div className="relative">
                <MomentStar size={44} mood="celebrate" />
                <span className="absolute -right-2 -bottom-1">
                  <MomentStar size={28} mood="calm" hue={210} />
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-orange-200/80">
                  <Flame className="h-3 w-3" />
                  Friend streak active
                </div>
                <div className="mt-1 text-base font-medium text-foreground">
                  You + {FRIEND_STREAK.with} · {FRIEND_STREAK.days}-day {FRIEND_STREAK.goal} streak
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  Next shared push: {FRIEND_STREAK.next}
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate("/app")}
                className="hidden shrink-0 rounded-full border border-orange-400/30 px-3 py-1.5 text-xs text-orange-200 hover:bg-orange-400/10 md:inline-flex"
              >
                Keep it open
              </button>
            </div>
          </article>

          {/* FEED */}
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Progress feed
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {events.length} {events.length === 1 ? "moment" : "moments"}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center">
                <MomentStar size={56} mood="calm" />
                <p className="mt-3 text-sm text-foreground">No progress yet today.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Complete one task and your first event will show up here.
                </p>
              </div>
            ) : (
              visible.map((e) => <ProgressEventCard key={e.id} event={e} />)
            )}
          </div>

          {isPhone && events.length > PHONE_CAP && !expanded && (
            <button
              type="button"
              onClick={() => setExpanded(true)}
              className="mt-1 self-center rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Show {events.length - PHONE_CAP} more
            </button>
          )}
        </section>

        {/* SIDEBAR */}
        {!isPhone && (
          <aside className="flex flex-col gap-4">
            {/* profile summary */}
            <div className="overflow-hidden rounded-2xl border border-border bg-card/70 p-4">
              <div className="flex items-center gap-3">
                <MomentStar size={48} mood="focused" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{display}</p>
                  <p className="text-[11px] text-muted-foreground">Private profile · friends-only feed</p>
                </div>
              </div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Your star glows brighter with every check-in. Skip a day? Reset, not ruined.
              </p>
            </div>

            {/* your next move */}
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.05] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-amber-300/80">
                Your next move
              </p>
              <p className="mt-1.5 text-sm font-medium text-foreground">
                Open today's plan and lock one task.
              </p>
              <button
                type="button"
                onClick={() => navigate("/app")}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-amber-200 hover:text-amber-100"
              >
                Go to today <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            {/* top streak */}
            <div className="rounded-2xl border border-border bg-card/70 p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Top streak
              </p>
              <p className="mt-1.5 flex items-center gap-2 text-sm text-foreground">
                <Flame className="h-4 w-4 text-orange-400" />
                You + {FRIEND_STREAK.with} · {FRIEND_STREAK.days} days
              </p>
              <p className="mt-1 text-[11px] text-muted-foreground">{FRIEND_STREAK.goal}</p>
            </div>

            {/* aligned-goal suggestion */}
            <div className="rounded-2xl border border-border bg-card/70 p-4">
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                <Users className="h-3 w-3" /> Aligned goals
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                3 people share your "app build" goal. Discovery is{" "}
                <span className="text-foreground">off</span> by default.
              </p>
              <button
                type="button"
                onClick={() => navigate("/app/settings/privacy")}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
              >
                <Sparkles className="h-3 w-3" /> Manage discovery
              </button>
            </div>

            {/* privacy status */}
            <div className="rounded-2xl border border-border bg-card/40 p-3">
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                <ShieldCheck className="h-3 w-3" /> Privacy
              </p>
              <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                <li>Profile · private</li>
                <li>Progress · private</li>
                <li>Comments · off</li>
              </ul>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
