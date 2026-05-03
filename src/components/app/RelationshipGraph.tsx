import { useMemo } from "react";
import type { CompiledPursuitModel } from "@/lib/types";

interface Props {
  model: CompiledPursuitModel;
}

/**
 * Lightweight SVG graph: workstreams in inner ring, capabilities in outer ring,
 * connected via simple visual lines. No external d3 layout needed.
 */
export const RelationshipGraph = ({ model }: Props) => {
  const layout = useMemo(() => {
    const w = 480;
    const h = 320;
    const cx = w / 2;
    const cy = h / 2;
    const innerR = 70;
    const outerR = 130;

    const ws = model.workstreams.map((node, i, arr) => {
      const a = (i / Math.max(1, arr.length)) * Math.PI * 2 - Math.PI / 2;
      return {
        id: node.id,
        name: node.name,
        status: node.status,
        x: cx + Math.cos(a) * innerR,
        y: cy + Math.sin(a) * innerR,
      };
    });

    const caps = model.capability_clusters.map((node, i, arr) => {
      const a = (i / Math.max(1, arr.length)) * Math.PI * 2 - Math.PI / 2;
      return {
        id: node.id,
        name: node.name,
        status: node.status,
        x: cx + Math.cos(a) * outerR,
        y: cy + Math.sin(a) * outerR,
      };
    });

    return { w, h, cx, cy, ws, caps };
  }, [model]);

  if (layout.ws.length === 0 && layout.caps.length === 0) return null;

  const wsColor = (status: string) =>
    status === "on_track"
      ? "hsl(var(--primary))"
      : status === "slipping"
      ? "hsl(38 92% 60%)"
      : status === "stalled"
      ? "hsl(0 72% 60%)"
      : "hsl(var(--muted-foreground))";

  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        how it connects
      </div>
      <svg viewBox={`0 0 ${layout.w} ${layout.h}`} className="mt-1 h-72 w-full">
        {/* lines from goal core to workstreams */}
        {layout.ws.map((n) => (
          <line
            key={`gl-${n.id}`}
            x1={layout.cx}
            y1={layout.cy}
            x2={n.x}
            y2={n.y}
            stroke="hsl(var(--border))"
            strokeWidth="1"
          />
        ))}
        {/* lines workstream→capability (simple cross-link) */}
        {layout.ws.map((w, i) =>
          layout.caps.map((c, j) =>
            (i + j) % 2 === 0 ? (
              <line
                key={`cl-${w.id}-${c.id}`}
                x1={w.x}
                y1={w.y}
                x2={c.x}
                y2={c.y}
                stroke="hsl(var(--border))"
                strokeWidth="0.4"
                opacity="0.6"
              />
            ) : null,
          ),
        )}
        {/* core */}
        <circle cx={layout.cx} cy={layout.cy} r={14} fill="hsl(var(--primary))" />
        <text
          x={layout.cx}
          y={layout.cy + 3}
          textAnchor="middle"
          className="fill-primary-foreground"
          fontSize="9"
          fontWeight="600"
        >
          GOAL
        </text>
        {/* capability cluster nodes */}
        {layout.caps.map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r="5" fill="hsl(var(--muted-foreground))" opacity="0.7" />
            <text x={n.x} y={n.y - 9} textAnchor="middle" className="fill-muted-foreground" fontSize="9">
              {n.name.slice(0, 16)}
            </text>
          </g>
        ))}
        {/* workstream nodes */}
        {layout.ws.map((n) => (
          <g key={n.id}>
            <circle cx={n.x} cy={n.y} r="8" fill={wsColor(n.status)} />
            <text x={n.x} y={n.y + 20} textAnchor="middle" className="fill-foreground" fontSize="10" fontWeight="500">
              {n.name.slice(0, 18)}
            </text>
          </g>
        ))}
      </svg>
    </section>
  );
};
