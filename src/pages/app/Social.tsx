import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStateStore } from "@/stores/state-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useSurface } from "@/hooks/use-surface";
import { useAuth } from "@/hooks/use-auth";
import { useProgressEmitter } from "@/hooks/use-progress-emitter";
import { useSocialFeed } from "@/hooks/use-social-feed";
import { ProgressEventCard } from "@/components/app/social/ProgressEventCard";
import { AlignedPeople } from "@/components/app/social/AlignedPeople";
import { PeopleSearch } from "@/components/app/social/PeopleSearch";
import { FollowRequests } from "@/components/app/social/FollowRequests";
import { EmptyConnections } from "@/components/app/social/EmptyConnections";
import { MomentStar } from "@/components/app/Mote";
import { DEMO_FRIEND_EVENTS } from "@/lib/social/sample-friends";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";
import type { FeedItem } from "@/lib/social/api";

const PHONE_CAP = 5;

function feedRowToEvent(r: FeedItem) {
  return {
    id: r.id,
    kind: r.kind as any,
    actor: {
      name: r.author?.display_name ?? "Someone",
      username: r.author?.handle ?? undefined,
      isYou: false,
      isDemo: false,
    },
    title: r.title,
    context: r.context ?? undefined,
    timestamp: r.created_at,
  };
}

export default function Social() {
  const { uid } = useAuth();
  useProgressEmitter();

  const state = useStateStore((s) => s.state);
  const display = useSettingsStore((s) => s.profile.display_name) || state?.profile?.display_name || "You";
  const alignedOptIn = useSettingsStore((s) => s.privacy.aligned_goal_discovery);
  const surface = useSurface();
  const isPhone = surface === "mobile";
  const [expanded, setExpanded] = useState(false);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as "friends" | "aligned") || "friends";
  const setTab = (t: "friends" | "aligned") => {
    const p = new URLSearchParams(params);
    p.set("tab", t);
    setParams(p, { replace: true });
  };

  const { items, loading } = useSocialFeed(uid, tab);
  const events = useMemo(() => items.map(feedRowToEvent), [items]);

  const friendsMovedToday = useMemo(() => {
    const today = new Date().toDateString();
    return new Set(
      events.filter((e) => new Date(e.timestamp).toDateString() === today).map((e) => e.actor.name),
    ).size;
  }, [events]);


  const visible = isPhone && !expanded ? events.slice(0, PHONE_CAP) : events;
  const showDemoStrip = !loading && events.length === 0 && tab === "friends";

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* HERO */}
      <section className="relative mb-6 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-950 via-slate-950 to-slate-900 p-6 md:p-8">
        <div className="pointer-events-none absolute -top-20 -right-10 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-indigo-500/15 blur-3xl" aria-hidden />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <MomentStar size={isPhone ? 56 : 72} mood="focused" bounce />
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/45">social</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white md:text-3xl">
                {friendsMovedToday > 0
                  ? `${friendsMovedToday} ${friendsMovedToday === 1 ? "person" : "people"} moved today.`
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

      {/* TAB SWITCH */}
      <div className="mb-4 inline-flex rounded-full border border-border bg-card/60 p-1">
        {(["friends", "aligned"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-4 py-1.5 text-xs capitalize transition ${
              tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-[1fr_300px]">
        <section className="flex flex-col gap-4">
          {/* aligned opt-in nudge */}
          {tab === "aligned" && !alignedOptIn && (
            <div className="rounded-2xl border border-amber-400/25 bg-amber-400/[0.05] p-4">
              <p className="text-sm font-medium text-foreground">Aligned discovery is off.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Turn it on to see people working toward similar goals. Off by default.
              </p>
              <button
                type="button"
                onClick={() => navigate("/app/settings/privacy")}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-200 hover:bg-amber-300/15"
              >
                Open discovery settings <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              {tab === "friends" ? "Friends feed" : "Aligned feed"}
            </h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {events.length} {events.length === 1 ? "moment" : "moments"}
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {loading && (
              <div className="rounded-2xl border border-dashed border-border bg-card/40 p-6 text-center text-xs text-muted-foreground">
                Loading…
              </div>
            )}
            {!loading && events.length === 0 && (
              <EmptyConnections tab={tab} onFindAligned={() => setTab("aligned")} />
            )}
            {visible.map((e) => (
              <ProgressEventCard key={e.id} event={e} />
            ))}

            {showDemoStrip && (
              <div className="mt-2 rounded-2xl border border-dashed border-border bg-card/30 p-4">
                <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  Example · how the feed will look
                </p>
                <div className="flex flex-col gap-2 opacity-70">
                  {DEMO_FRIEND_EVENTS.slice(0, 3).map((e) => (
                    <ProgressEventCard key={e.id} event={e} />
                  ))}
                </div>
              </div>
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

        {!isPhone && (
          <aside className="flex flex-col gap-4">
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

            <AlignedPeople uid={uid!} />

            <div className="rounded-2xl border border-border bg-card/40 p-3">
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                <ShieldCheck className="h-3 w-3" /> Privacy
              </p>
              <ul className="mt-2 space-y-1 text-[11px] text-muted-foreground">
                <li>Profile · private</li>
                <li>Progress · friends</li>
                <li>Aligned discovery · {alignedOptIn ? "on" : "off"}</li>
              </ul>
              <button
                type="button"
                onClick={() => navigate("/app/settings/privacy")}
                className="mt-2 text-[11px] text-primary hover:underline"
              >
                Manage
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
