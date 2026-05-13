import { useMemo, useState } from "react";
import type { CompiledPursuitModel } from "@/lib/types";

interface Props {
  model: CompiledPursuitModel;
}

/**
 * Strategic map: goal core → workstreams (inner ring) → capabilities (outer ring).
 * Hover/tap a node to highlight its connections. Status drives node color.
 */
export const RelationshipGraph = ({ model }: Props) => {
  const [hovered, setHovered] = useState<string | null>(null);

  const layout = useMemo(() => {
    const w = 460;
    const h = 460;
    const cx = w / 2;
    const cy = h / 2;
    const innerR = 100;
    const outerR = 180;

    const ws = model.workstreams.map((node, i, arr) => {
      const a = (i / Math.max(1, arr.length)) * Math.PI * 2 - Math.PI / 2;
      return { id: node.id, name: node.name, status: node.status, x: cx + Math.cos(a) * innerR, y: cy + Math.sin(a) * innerR, a };
    });

    const caps = model.capability_clusters.map((node, i, arr) => {
      const a = (i / Math.max(1, arr.length)) * Math.PI * 2 - Math.PI / 2;
      return { id: node.id, name: node.name, status: node.status, x: cx + Math.cos(a) * outerR, y: cy + Math.sin(a) * outerR, a };
    });

    // deterministic cross-links (each cap → 2 nearest workstreams by angle)
    const links: Array<{ ws: string; cap: string }> = [];
    caps.forEach((c) => {
      const sorted = [...ws].sort((a, b) => Math.abs(a.a - c.a) - Math.abs(b.a - c.a));
      sorted.slice(0, Math.min(2, sorted.length)).forEach((wn) => links.push({ ws: wn.id, cap: c.id }));
    });

    return { w, h, cx, cy, ws, caps, links };
  }, [model]);

  if (layout.ws.length === 0 && layout.caps.length === 0) return null;

  const wsColor = (status: string) =>
    status === "on_track" ? "hsl(var(--primary))"
      : status === "slipping" ? "hsl(38 92% 60%)"
      : status === "stalled" ? "hsl(0 72% 60%)"
      : status === "complete" ? "hsl(142 60% 50%)"
      : "hsl(var(--muted-foreground))";

  const isDimmed = (id: string) => {
    if (!hovered) return false;
    if (hovered === id) return false;
    const linked = layout.links.some(
      (l) => (l.ws === hovered && l.cap === id) || (l.cap === hovered && l.ws === id),
    );
    return !linked;
  };

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card to-background p-4">
      <div className="flex items-center justify-between">
        <div className="font-mono text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
          strategic map
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">hover to trace</div>
      </div>

      <svg viewBox={`0 0 ${layout.w} ${layout.h}`} className="mt-2 h-[420px] w-full">
        <defs>
          <radialGradient id="goalGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* ambient rings */}
        <circle cx={layout.cx} cy={layout.cy} r={100} fill="none" stroke="hsl(var(--border))" strokeDasharray="2 4" opacity="0.4" />
        <circle cx={layout.cx} cy={layout.cy} r={180} fill="none" stroke="hsl(var(--border))" strokeDasharray="2 4" opacity="0.3" />

        {/* glow */}
        <circle cx={layout.cx} cy={layout.cy} r={60} fill="url(#goalGlow)" />

        {/* spokes goal → workstreams */}
        {layout.ws.map((n) => {
          const dim = hovered && hovered !== n.id && !layout.links.some((l) => l.ws === n.id && l.cap === hovered);
          return (
            <line key={`gl-${n.id}`} x1={layout.cx} y1={layout.cy} x2={n.x} y2={n.y}
              stroke="hsl(var(--primary))" strokeWidth={hovered === n.id ? 1.6 : 0.8}
              opacity={dim ? 0.1 : hovered === n.id ? 0.9 : 0.45} />
          );
        })}

        {/* cross-links */}
        {layout.links.map((l) => {
          const w = layout.ws.find((n) => n.id === l.ws);
          const c = layout.caps.find((n) => n.id === l.cap);
          if (!w || !c) return null;
          const active = hovered === l.ws || hovered === l.cap;
          const dim = hovered && !active;
          return (
            <line key={`cl-${l.ws}-${l.cap}`} x1={w.x} y1={w.y} x2={c.x} y2={c.y}
              stroke="hsl(var(--foreground))" strokeWidth={active ? 1.2 : 0.5}
              opacity={dim ? 0.05 : active ? 0.7 : 0.18} />
          );
        })}

        {/* core */}
        <circle cx={layout.cx} cy={layout.cy} r={22} fill="hsl(var(--primary))" />
        <circle cx={layout.cx} cy={layout.cy} r={22} fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.4" className="animate-pulse" />
        <text x={layout.cx} y={layout.cy + 4} textAnchor="middle" className="fill-primary-foreground" fontSize="10" fontWeight="700" letterSpacing="1">
          GOAL
        </text>

        {/* capability nodes */}
        {layout.caps.map((n) => {
          const dim = isDimmed(n.id);
          return (
            <g key={n.id} onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)}
               style={{ cursor: "pointer", opacity: dim ? 0.25 : 1, transition: "opacity 150ms" }}>
              <circle cx={n.x} cy={n.y} r={hovered === n.id ? 7 : 5} fill="hsl(var(--muted-foreground))"
                stroke="hsl(var(--background))" strokeWidth="2" />
              <text x={n.x} y={n.y - 12} textAnchor="middle" className="fill-muted-foreground" fontSize="9" fontWeight="500">
                {n.name.length > 18 ? n.name.slice(0, 16) + "…" : n.name}
              </text>
            </g>
          );
        })}

        {/* workstream nodes */}
        {layout.ws.map((n) => {
          const dim = isDimmed(n.id);
          const c = wsColor(n.status);
          return (
            <g key={n.id} onMouseEnter={() => setHovered(n.id)} onMouseLeave={() => setHovered(null)}
               style={{ cursor: "pointer", opacity: dim ? 0.25 : 1, transition: "opacity 150ms" }}>
              <circle cx={n.x} cy={n.y} r={hovered === n.id ? 12 : 9} fill={c}
                stroke="hsl(var(--background))" strokeWidth="2.5" />
              {hovered === n.id && (
                <circle cx={n.x} cy={n.y} r={16} fill="none" stroke={c} strokeWidth="1" opacity="0.5" />
              )}
              <text x={n.x} y={n.y + 24} textAnchor="middle" className="fill-foreground" fontSize="10" fontWeight="600">
                {n.name.length > 16 ? n.name.slice(0, 14) + "…" : n.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-primary" /> on track</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: "hsl(38 92% 60%)" }} /> slipping</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full" style={{ background: "hsl(0 72% 60%)" }} /> stalled</span>
      </div>
    </section>
  );
};
