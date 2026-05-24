import { useState } from "react";
import { CheckCircle2, BookOpen, Sparkles, Wrench, Flame, CalendarDays, MoreHorizontal, MessageCircle, Smile } from "lucide-react";
import type { ProgressEvent } from "@/lib/social/select-progress-events";
import { MomentStar, type MoteMood } from "@/components/app/Mote";
import { ReactionBar } from "./ReactionBar";
import { Comments } from "./Comments";
import { useAuth } from "@/hooks/use-auth";

type Kind = ProgressEvent["kind"];

const KIND_META: Record<Kind, {
  icon: any;
  label: string;
  mood: MoteMood;
  // gradient applied as left rail + soft card bg
  rail: string;
  bg: string;
  chip: string;
  iconTint: string;
  /** Larger card weight */
  big?: boolean;
}> = {
  task_completed: {
    icon: CheckCircle2, label: "completed", mood: "celebrate",
    rail: "from-emerald-400/70 to-emerald-400/0",
    bg: "from-emerald-500/[0.06] to-transparent",
    chip: "border-emerald-400/30 text-emerald-200",
    iconTint: "text-emerald-300",
  },
  review_saved: {
    icon: BookOpen, label: "review saved", mood: "focused",
    rail: "from-sky-400/70 to-sky-400/0",
    bg: "from-sky-500/[0.06] to-transparent",
    chip: "border-sky-400/30 text-sky-200",
    iconTint: "text-sky-300",
  },
  lesson_learned: {
    icon: Sparkles, label: "learned", mood: "calm",
    rail: "from-amber-300/80 to-amber-300/0",
    bg: "from-amber-400/[0.07] to-transparent",
    chip: "border-amber-300/30 text-amber-200",
    iconTint: "text-amber-300",
  },
  plan_repaired: {
    icon: Wrench, label: "plan repaired", mood: "repair",
    rail: "from-violet-400/70 to-violet-400/0",
    bg: "from-violet-500/[0.06] to-transparent",
    chip: "border-violet-400/30 text-violet-200",
    iconTint: "text-violet-300",
  },
  streak_milestone: {
    icon: Flame, label: "milestone", mood: "celebrate",
    rail: "from-orange-400/90 to-rose-400/0",
    bg: "from-orange-500/[0.10] via-rose-500/[0.04] to-transparent",
    chip: "border-orange-400/40 text-orange-200",
    iconTint: "text-orange-300",
    big: true,
  },
  weekly_recap: {
    icon: CalendarDays, label: "weekly recap", mood: "calm",
    rail: "from-primary/70 to-primary/0",
    bg: "from-primary/[0.08] to-transparent",
    chip: "border-primary/30 text-primary",
    iconTint: "text-primary",
    big: true,
  },
};

function relTime(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString();
}

export function ProgressEventCard({ event }: { event: ProgressEvent }) {
  const meta = KIND_META[event.kind];
  const Icon = meta.icon;
  const { uid } = useAuth();
  const [showReactions, setShowReactions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  // event.id is a uuid only for real DB events. Demo events use string ids.
  const isReal = /^[0-9a-f]{8}-[0-9a-f]{4}-/.test(event.id);

  return (
    <article
      className={`relative overflow-hidden rounded-2xl border border-white/[0.06] bg-card/60 backdrop-blur-sm transition-colors hover:border-white/10 ${
        meta.big ? "p-5" : "p-4"
      }`}
    >
      {/* soft gradient wash */}
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${meta.bg}`} aria-hidden />
      {/* left rail */}
      <div className={`pointer-events-none absolute left-0 top-3 bottom-3 w-[3px] rounded-full bg-gradient-to-b ${meta.rail}`} aria-hidden />

      <div className="relative flex items-start gap-3">
        {/* avatar = Moment Star, glow tied to event */}
        <div className="shrink-0">
          <MomentStar size={meta.big ? 44 : 36} mood={meta.mood} halo={meta.big} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${event.actor.isYou ? "text-foreground" : "text-foreground/95"}`}>
              {event.actor.name}
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full border bg-background/30 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] ${meta.chip}`}>
              <Icon className={`h-3 w-3 ${meta.iconTint}`} />
              {meta.label}
            </span>
            <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {relTime(event.timestamp)}
            </span>
          </div>

          <p className={`mt-1.5 leading-snug text-foreground ${meta.big ? "text-base font-medium" : "text-[13.5px]"}`}>
            {event.title}
          </p>

          {event.context && (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{event.context}</p>
          )}

          {/* compact actions */}
          <div className="mt-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowReactions((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                showReactions
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border bg-card/60 text-muted-foreground hover:text-foreground"
              }`}
              aria-expanded={showReactions}
            >
              <Smile className="h-3.5 w-3.5" />
              React
            </button>
            <button
              type="button"
              onClick={() => alert("Comments arrive with the friend system.")}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Comment
            </button>
            <button
              type="button"
              className="ml-auto inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="More"
              onClick={() => alert("Report and block arrive with the friend system.")}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </div>

          {showReactions && (
            <div className="mt-2 rounded-xl border border-border/60 bg-background/50 p-2">
              <ReactionBar eventId={event.id} />
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
