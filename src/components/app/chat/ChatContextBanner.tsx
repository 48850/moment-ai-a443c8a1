import { Activity, Clock, Flame, Target, CheckCircle2 } from "lucide-react";
import type { ChatSnapshot } from "@/lib/selectors/chat";

const PRESSURE_COLOR: Record<string, string> = {
  low: "text-emerald-500",
  moderate: "text-amber-500",
  high: "text-orange-500",
  critical: "text-red-500",
};

const ALIGNMENT_COLOR: Record<string, string> = {
  aligned: "text-emerald-500",
  drifting: "text-amber-500",
  overwhelmed: "text-orange-500",
  recovering: "text-sky-500",
};

export function ChatContextBanner({ snapshot }: { snapshot: ChatSnapshot }) {
  const p = snapshot.portfolio;
  if (!p) return null;

  const stmt = snapshot.active_goal?.statement ?? "";
  const goalSnippet = stmt ? (stmt.length > 60 ? stmt.slice(0, 60) + "…" : stmt) : "";

  const pressureClass = PRESSURE_COLOR[p.schedule_pressure] ?? "text-muted-foreground";
  const alignmentClass = ALIGNMENT_COLOR[p.alignment_status] ?? "text-muted-foreground";

  return (
    <section className="mb-3 rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <Target className="h-3 w-3 text-primary" /> context
        </div>
        <div className={`flex items-center gap-1 text-[10px] uppercase tracking-[0.15em] ${alignmentClass}`}>
          <Activity className="h-2.5 w-2.5" />
          {p.alignment_status}
        </div>
      </div>

      {goalSnippet && (
        <p className="mb-2 text-xs text-foreground leading-snug">
          <span className="text-muted-foreground">Goal · </span>
          {goalSnippet}
        </p>
      )}

      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px] sm:grid-cols-3">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-3 w-3 shrink-0" />
          <span className="truncate">
            {p.current_block
              ? `Now: ${p.current_block.title}`
              : p.next_block
              ? `Next: ${p.next_block.start_time} ${p.next_block.title}`
              : "No block active"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-500" />
          <span>{p.completed_today_count} done today</span>
        </div>

        <div className="flex items-center gap-1.5 text-muted-foreground">
          <span className="text-foreground font-medium tabular-nums">{p.pending_today_count}</span>
          <span>pending</span>
        </div>

        <div className={`flex items-center gap-1.5 ${pressureClass} col-span-2 sm:col-span-1`}>
          <Flame className="h-3 w-3 shrink-0" />
          <span className="capitalize">{p.schedule_pressure} pressure</span>
        </div>

        {p.top_pressure_task && (
          <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
            <span className="text-muted-foreground/60 shrink-0">Top:</span>
            <span className="truncate text-foreground">{p.top_pressure_task.title}</span>
            <span className="text-muted-foreground/60 shrink-0">~{p.top_pressure_task.minutes}m</span>
          </div>
        )}
      </div>

      {p.repeated_friction_tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {p.repeated_friction_tags.slice(0, 3).map((t) => (
            <span
              key={t.tag}
              className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-600"
            >
              {t.tag.replace(/_/g, " ")} ×{t.count}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
