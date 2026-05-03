import { useMemo } from "react";
import type { MomentState } from "@/lib/types";

interface Props {
  state: MomentState;
}

/**
 * Compact constellation that renders one node per task, lit up if completed.
 * Decisive node (first pending high-priority task) glows.
 */
export const JourneyConstellation = ({ state }: Props) => {
  const nodes = useMemo(() => {
    const tasks = state.tasks ?? [];
    if (tasks.length === 0) return [];
    const w = 320;
    const h = 100;
    const cx = w / 2;
    const cy = h / 2;
    const r = 36;
    return tasks.slice(0, 12).map((t, i, arr) => {
      const angle = (i / arr.length) * Math.PI * 2 - Math.PI / 2;
      const radius = r + (i % 2 === 0 ? 8 : 0);
      return {
        id: t.id,
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius * 0.5,
        done: t.status === "done",
        title: t.title,
        priority: t.priority,
      };
    });
  }, [state.tasks]);

  const doneCount = nodes.filter((n) => n.done).length;
  if (nodes.length === 0) return null;

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          your constellation
        </div>
        <div className="text-xs text-muted-foreground">
          {doneCount}/{nodes.length} lit
        </div>
      </div>
      <svg viewBox="0 0 320 100" className="mt-2 h-24 w-full">
        {nodes.map((n, i) => {
          const next = nodes[(i + 1) % nodes.length];
          return (
            <line
              key={`l-${n.id}`}
              x1={n.x}
              y1={n.y}
              x2={next.x}
              y2={next.y}
              stroke="hsl(var(--border))"
              strokeWidth="0.5"
              opacity="0.5"
            />
          );
        })}
        {nodes.map((n) => (
          <g key={n.id}>
            {n.done && (
              <circle
                cx={n.x}
                cy={n.y}
                r={6}
                fill="hsl(var(--primary))"
                opacity="0.25"
                className="animate-pulse-glow"
              />
            )}
            <circle
              cx={n.x}
              cy={n.y}
              r={n.priority === "high" ? 3 : 2.2}
              fill={n.done ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))"}
              opacity={n.done ? 1 : 0.5}
            >
              <title>{n.title}</title>
            </circle>
          </g>
        ))}
      </svg>
      <p className="mt-1 text-xs text-muted-foreground">
        Each light is a step. Keep lighting them up.
      </p>
    </section>
  );
};
