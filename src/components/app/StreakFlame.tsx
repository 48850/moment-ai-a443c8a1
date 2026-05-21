import { useEffect, useMemo, useState } from "react";
import { Flame } from "lucide-react";
import type { Task } from "@/lib/types";

/**
 * Commitment streak: number of consecutive days (ending today or yesterday)
 * on which the user completed ≥ 1 task. The flame lights up when today
 * already has a completion, and bursts when a new task is completed.
 */
function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeStreak(tasks: Task[]): { streak: number; litToday: boolean } {
  const days = new Set<string>();
  for (const t of tasks) {
    if (t.status !== "done" || !t.completed_at) continue;
    days.add(localDayKey(new Date(t.completed_at)));
  }
  if (days.size === 0) return { streak: 0, litToday: false };

  const todayKey = localDayKey(new Date());
  const litToday = days.has(todayKey);

  const cursor = new Date();
  if (!litToday) cursor.setDate(cursor.getDate() - 1);

  let streak = 0;
  while (true) {
    const key = localDayKey(cursor);
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
  const [burst, setBurst] = useState(0);

  useEffect(() => {
    const onBurst = () => setBurst((b) => b + 1);
    window.addEventListener("streak:burst", onBurst);
    return () => window.removeEventListener("streak:burst", onBurst);
  }, []);

  const lit = streak > 0 && litToday;
  const title = streak === 0
    ? "Complete a task today to start your streak"
    : `${streak}-day commitment streak${litToday ? " — lit today" : " — complete a task today to keep it alive"}`;

  return (
    <div
      title={title}
      className={`relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-semibold transition-all duration-300 ${
        lit
          ? "border-orange-500/50 bg-gradient-to-r from-orange-500/15 to-amber-500/10 text-orange-300"
          : streak > 0
            ? "border-amber-500/30 bg-amber-500/5 text-amber-300/80"
            : "border-border bg-background/40 text-muted-foreground"
      } ${className}`}
    >
      {/* Burst halo */}
      {burst > 0 && (
        <span
          key={burst}
          className="pointer-events-none absolute inset-0 -z-0 rounded-full bg-orange-500/40 blur-md animate-[streak-halo_1.1s_ease-out_forwards]"
        />
      )}

      {/* Spark particles */}
      {burst > 0 && (
        <span key={`sparks-${burst}`} className="pointer-events-none absolute left-3 top-1/2 -z-0">
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const angle = (i / 6) * Math.PI * 2;
            const dx = Math.cos(angle) * 22;
            const dy = Math.sin(angle) * 22;
            return (
              <span
                key={i}
                className="absolute h-1 w-1 rounded-full bg-amber-300 animate-[streak-spark_0.9s_ease-out_forwards]"
                style={{
                  // CSS vars consumed by keyframes
                  ["--dx" as string]: `${dx}px`,
                  ["--dy" as string]: `${dy}px`,
                  animationDelay: `${i * 30}ms`,
                }}
              />
            );
          })}
        </span>
      )}

      <Flame
        key={`flame-${burst}`}
        className={`relative z-10 h-4 w-4 ${lit ? "text-orange-400 drop-shadow-[0_0_6px_rgba(251,146,60,0.7)]" : ""} ${
          burst > 0 ? "animate-[streak-flame_0.9s_ease-out]" : lit ? "animate-pulse" : ""
        }`}
        strokeWidth={lit ? 2.5 : 2}
        fill={lit ? "currentColor" : "none"}
      />
      <span className="relative z-10 tabular-nums">{streak}</span>
      <span className="relative z-10 text-[11px] font-normal opacity-80">day{streak === 1 ? "" : "s"}</span>

      {/* Local keyframes — scoped via <style> so we don't touch tailwind config */}
      <style>{`
        @keyframes streak-flame {
          0%   { transform: scale(1) rotate(0); filter: brightness(1); }
          25%  { transform: scale(1.6) rotate(-8deg); filter: brightness(1.6); }
          55%  { transform: scale(1.25) rotate(6deg); filter: brightness(1.3); }
          100% { transform: scale(1) rotate(0); filter: brightness(1); }
        }
        @keyframes streak-halo {
          0%   { opacity: 0.0; transform: scale(0.6); }
          30%  { opacity: 0.9; transform: scale(1.4); }
          100% { opacity: 0;   transform: scale(2.2); }
        }
        @keyframes streak-spark {
          0%   { opacity: 1; transform: translate(0,0) scale(1); }
          100% { opacity: 0; transform: translate(var(--dx), var(--dy)) scale(0.3); }
        }
      `}</style>
    </div>
  );
}

/** Trigger the flame burst + a compliment toast from anywhere. */
export const COMPLIMENTS = [
  "Another stone in the wall. Keep stacking.",
  "That's momentum. Don't break it.",
  "Future you just smiled.",
  "Proof beats plans — and you just made some.",
  "Quiet wins compound. That was one.",
  "You showed up. That's the whole game.",
  "One more rep than yesterday. That's how it gets built.",
  "Streak fed. Flame's bigger.",
  "Small move, real progress.",
  "You're getting harder to stop.",
];
