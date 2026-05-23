import { CheckCircle2, BookOpen, Sparkles, Wrench, Flame, CalendarDays, Flag, Shield } from "lucide-react";
import type { ProgressEvent } from "@/lib/social/select-progress-events";
import { ReactionBar } from "./ReactionBar";

const KIND_META: Record<ProgressEvent["kind"], { icon: any; tint: string; label: string }> = {
  task_completed: { icon: CheckCircle2, tint: "text-emerald-500", label: "Task done" },
  review_saved: { icon: BookOpen, tint: "text-sky-500", label: "Review saved" },
  lesson_learned: { icon: Sparkles, tint: "text-amber-500", label: "Learned" },
  plan_repaired: { icon: Wrench, tint: "text-violet-500", label: "Plan repaired" },
  streak_milestone: { icon: Flame, tint: "text-orange-500", label: "Streak" },
  weekly_recap: { icon: CalendarDays, tint: "text-primary", label: "Weekly recap" },
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

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted ${meta.tint}`}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-sm leading-snug">
              <span className="font-medium text-foreground">{event.actor.name}</span>{" "}
              <span className="text-muted-foreground">{event.title}</span>
            </p>
            {event.context && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{event.context}</p>
            )}
            <div className="mt-1.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <span>{meta.label}</span>
              <span>·</span>
              <span>{relTime(event.timestamp)}</span>
              {event.actor.isDemo && (
                <>
                  <span>·</span>
                  <span className="rounded-sm border border-border px-1 py-0.5 text-[9px] tracking-[0.2em]">Demo</span>
                </>
              )}
            </div>
          </div>
        </div>
        {!event.actor.isYou && (
          <div className="flex items-center gap-1 text-muted-foreground">
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
              aria-label="Report"
              title="Report"
              onClick={() => alert("Reporting tools arrive with the friend system.")}
            >
              <Flag className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted"
              aria-label="Block"
              title="Block"
              onClick={() => alert("Blocking arrives with the friend system.")}
            >
              <Shield className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </header>
      <ReactionBar eventId={event.id} />
    </article>
  );
}
