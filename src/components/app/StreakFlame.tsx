import { useMemo } from "react";
import { Flame } from "lucide-react";
import type { Task } from "@/lib/types";

/**
 * Commitment streak: number of consecutive days (ending today or yesterday)
 * on which the user completed ≥ 1 task. The flame lights up when today
 * already has a completion.
 */
function computeStreak(tasks: Task[]): { streak: number; litToday: boolean } {
  const days = new Set<string>();
  for (const t of tasks) {
    if (t.status !== "done" || !t.completed_at) continue;
    days.add(t.completed_at.slice(0, 10));
  }
  if (days.size === 0) return { streak: 0, litToday: false };

  const todayKey = new Date().toISOString().slice(0, 10);
  const litToday = days.has(todayKey);

  // Start from today (if lit) else yesterday (so a missed today doesn't reset
  // immediately mid-day, but a full skipped day breaks the streak).
  const cursor = new Date();
  if (!litToday) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (true) {
    const key = cursor.toISOString().slice(0, 10);
    if (days.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    } else break;
  }
  return { streak, litToday };
}

interface Props {
  tasks: Task[];
  className?: string;
}

export function StreakFlame({ tasks, className = "" }: Props) {
  const { streak, litToday } = useMemo(() => computeStreak(tasks), [tasks]);

  const lit = streak > 0 && litToday;
  const title = streak === 0
    ? "Complete a task today to start your streak"
    : `${streak}-day commitment streak${litToday ? " — lit today" : " — complete a task today to keep it alive"}`;

  return (
    <div
      title={title}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold transition-colors ${
        lit
          ? "border-orange-500/50 bg-gradient-to-r from-orange-500/15 to-amber-500/10 text-orange-300"
          : streak > 0
            ? "border-amber-500/30 bg-amber-500/5 text-amber-300/80"
            : "border-border bg-background/40 text-muted-foreground"
      } ${className}`}
    >
      <Flame
        className={`h-4 w-4 ${lit ? "text-orange-400 drop-shadow-[0_0_6px_rgba(251,146,60,0.7)] animate-pulse" : ""}`}
        strokeWidth={lit ? 2.5 : 2}
        fill={lit ? "currentColor" : "none"}
      />
      <span className="tabular-nums">{streak}</span>
      <span className="text-[11px] font-normal opacity-80">day{streak === 1 ? "" : "s"}</span>
    </div>
  );
}
