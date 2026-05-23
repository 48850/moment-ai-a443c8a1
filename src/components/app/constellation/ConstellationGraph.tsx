import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Starfield, DEEP_SPACE_BG, ConstellationHud } from "./Starfield";

export type StarTone = "bright" | "warm" | "amber" | "emerald" | "violet" | "rose" | "dim";

export interface StarNode {
  id: string;
  title: string;
  subtitle?: string;
  /** Short detail shown in the navigator + focus panel. */
  detail?: string;
  tone?: StarTone;
  /** Optional secondary text inside the focus panel. */
  panelBody?: string;
  /** Pinned focus (e.g. "decisive move", "today"). */
  isFocus?: boolean;
  /** Marks the node as locked/dim. */
  isLocked?: boolean;
  /** Right-side meta chip on the chip nav (e.g. "08:30", "done"). */
  meta?: string;
}

export interface StarEdge {
  from: string;
  to: string;
  /** "spine" draws solid bright, "support" draws dashed faint. */
  kind?: "spine" | "support";
}

interface Props {
  nodes: StarNode[];
  edges?: StarEdge[];
  hudLabel: string;
  hudMeta?: React.ReactNode;
  emptyHint?: string;
  onNodeClick?: (id: string) => void;
  /** Optional render override for the focus panel body. */
  renderPanel?: (node: StarNode) => React.ReactNode;
  /** Background nebula tint. */
  nebulaHue?: "indigo" | "violet" | "teal";
  /** Min height of the SVG canvas. */
  minHeight?: number;
}

const TONE: Record<StarTone, { fill: string; glow: string; ring: string; chip: string }> = {
  bright:  { fill: "#dbeafe", glow: "rgba(147,197,253,0.85)", ring: "ring-blue-200/50",    chip: "border-blue-200/35 bg-blue-200/10 text-blue-100" },
  warm:    { fill: "#fde68a", glow: "rgba(253,224,138,0.85)", ring: "ring-amber-200/55",   chip: "border-amber-200/35 bg-amber-200/10 text-amber-100" },
  amber:   { fill: "#fbbf24", glow: "rgba(251,191,36,0.95)",  ring: "ring-amber-200/65",   chip: "border-amber-200/40 bg-amber-200/15 text-amber-100" },
  emerald: { fill: "#a7f3d0", glow: "rgba(110,231,183,0.85)", ring: "ring-emerald-200/55", chip: "border-emerald-200/35 bg-emerald-200/10 text-emerald-100" },
  violet:  { fill: "#ddd6fe", glow: "rgba(196,181,253,0.85)", ring: "ring-violet-200/55",  chip: "border-violet-200/30 bg-violet-200/10 text-violet-100" },
  rose:    { fill: "#fecdd3", glow: "rgba(253,164,175,0.85)", ring: "ring-rose-200/55",    chip: "border-rose-200/30 bg-rose-200/10 text-rose-100" },
  dim:     { fill: "#cbd5e1", glow: "rgba(148,163,184,0.55)", ring: "ring-white/25",       chip: "border-white/12 bg-white/[0.04] text-white/55" },
};

/** Distribute n nodes across a width×height canvas using a snake grid + jitter. */
function layout(n: number, width: number, height: number) {
  if (n === 0) return [];
  const padX = 70, padY = 70;
  const innerW = Math.max(120, width - padX * 2);
  const innerH = Math.max(120, height - padY * 2);
  if (n === 1) return [{ x: width / 2, y: height / 2 }];

  // Choose grid roughly matching canvas aspect ratio.
  const aspect = innerW / innerH;
  const cols = Math.max(2, Math.min(n, Math.round(Math.sqrt(n * aspect))));
  const rows = Math.ceil(n / cols);
  const colStep = innerW / Math.max(1, cols - 1 || 1);
  const rowStep = rows > 1 ? innerH / (rows - 1) : 0;

  return Array.from({ length: n }, (_, i) => {
    const row = Math.floor(i / cols);
    const colInRow = i % cols;
    // Snake: alternate direction so the spine flows L→R then R→L.
    const col = row % 2 === 0 ? colInRow : cols - 1 - colInRow;
    const baseX = padX + (cols === 1 ? innerW / 2 : col * colStep);
    const baseY = rows === 1 ? height / 2 : padY + row * rowStep;
    // Deterministic jitter so it doesn't look like a grid.
    const jx = Math.sin(i * 12.9898) * Math.min(colStep * 0.18, 28);
    const jy = Math.cos(i * 78.233)  * Math.min((rowStep || 60) * 0.18, 24);
    return { x: baseX + jx, y: baseY + jy };
  });
}


export function ConstellationGraph({
  nodes,
  edges = [],
  hudLabel,
  hudMeta,
  emptyHint,
  onNodeClick,
  renderPanel,
  nebulaHue = "indigo",
  minHeight = 340,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: minHeight });
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    if (!wrapRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setSize({ w: r.width, h: Math.max(minHeight, r.height) });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [minHeight]);

  const positions = useMemo(() => layout(nodes.length, size.w, size.h), [nodes.length, size.w, size.h]);
  const posById = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    nodes.forEach((n, i) => positions[i] && map.set(n.id, positions[i]));
    return map;
  }, [nodes, positions]);

  // Auto-derive a spine through nodes in given order if no edges provided
  const resolvedEdges = useMemo<StarEdge[]>(() => {
    if (edges.length > 0) return edges;
    const out: StarEdge[] = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      out.push({ from: nodes[i].id, to: nodes[i + 1].id, kind: "spine" });
    }
    return out;
  }, [edges, nodes]);

  const focused = focusedId ? nodes.find((n) => n.id === focusedId) ?? null : null;
  const focusedIndex = focused ? nodes.findIndex((n) => n.id === focused.id) : -1;

  const goto = (delta: number) => {
    if (nodes.length === 0) return;
    const base = focusedIndex >= 0 ? focusedIndex : -1;
    const next = (base + delta + nodes.length) % nodes.length;
    setFocusedId(nodes[next].id);
  };

  if (nodes.length === 0) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10" style={{ background: DEEP_SPACE_BG, minHeight }}>
        <ConstellationHud label={hudLabel} meta={hudMeta} />
        <div className="relative" style={{ minHeight }}>
          <Starfield density={4200} nebulaHue={nebulaHue} showShootingStars={false} />
          <div className="absolute inset-0 z-10 flex items-center justify-center px-8 text-center text-sm text-white/45">
            {emptyHint ?? "Nothing to map here yet."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_40px_-10px_rgba(99,102,241,0.4)]"
      style={{ background: DEEP_SPACE_BG }}
    >
      <ConstellationHud label={hudLabel} meta={hudMeta} />

      {/* Canvas */}
      <div ref={wrapRef} className="relative w-full" style={{ height: minHeight }}>
        <Starfield density={4400} nebulaHue={nebulaHue} showShootingStars />

        <svg
          className="absolute inset-0 z-10 h-full w-full"
          viewBox={`0 0 ${size.w} ${size.h}`}
          preserveAspectRatio="none"
        >
          <defs>
            <radialGradient id="cg-star-bright" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,1)" />
              <stop offset="40%" stopColor="rgba(220,235,255,0.7)" />
              <stop offset="100%" stopColor="rgba(120,160,255,0)" />
            </radialGradient>
            <linearGradient id="cg-spine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgba(147,197,253,0.0)" />
              <stop offset="50%" stopColor="rgba(191,219,254,0.85)" />
              <stop offset="100%" stopColor="rgba(147,197,253,0.0)" />
            </linearGradient>
          </defs>

          {/* Edges */}
          {resolvedEdges.map((e, i) => {
            const a = posById.get(e.from);
            const b = posById.get(e.to);
            if (!a || !b) return null;
            const dx = b.x - a.x, dy = b.y - a.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const isSupport = e.kind === "support";
            const isLit = focusedId === e.from || focusedId === e.to ||
                          hoveredId === e.from || hoveredId === e.to;
            return (
              <motion.line
                key={`${e.from}-${e.to}-${i}`}
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isSupport ? "rgba(196,181,253,0.55)" : "url(#cg-spine)"}
                strokeWidth={isLit ? 1.6 : isSupport ? 0.9 : 1.1}
                strokeDasharray={isSupport ? "4 6" : undefined}
                strokeLinecap="round"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: isLit ? 0.95 : 0.55 }}
                transition={{ pathLength: { duration: 0.9, delay: 0.05 * i, ease: "easeOut" }, opacity: { duration: 0.4 } }}
                style={{ strokeDasharray: isSupport ? "4 6" : `${len} ${len}` }}
              />
            );
          })}

          {/* Stars */}
          {nodes.map((n, i) => {
            const p = positions[i];
            if (!p) return null;
            const tone = TONE[n.tone ?? "bright"];
            const isFocus = n.isFocus || focusedId === n.id;
            const isHover = hoveredId === n.id;
            const baseR = n.isLocked ? 3.2 : isFocus ? 5.6 : 4.2;
            const haloR = baseR * (isFocus ? 4.5 : isHover ? 3.8 : 3.2);
            return (
              <g
                key={n.id}
                style={{ cursor: "pointer" }}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId((cur) => (cur === n.id ? null : cur))}
                onClick={() => { setFocusedId(n.id); onNodeClick?.(n.id); }}
              >
                {/* Halo */}
                <motion.circle
                  cx={p.x} cy={p.y} r={haloR}
                  fill={tone.glow}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{
                    opacity: n.isLocked ? 0.18 : isFocus ? 0.55 : 0.32,
                    scale: [1, 1.12, 1],
                  }}
                  transition={{
                    opacity: { duration: 0.5, delay: 0.04 * i },
                    scale:   { duration: 3 + (i % 5) * 0.4, repeat: Infinity, ease: "easeInOut" },
                  }}
                  style={{ mixBlendMode: "screen", filter: "blur(6px)" }}
                />
                {/* Core */}
                <motion.circle
                  cx={p.x} cy={p.y} r={baseR}
                  fill={tone.fill}
                  initial={{ opacity: 0, scale: 0.3 }}
                  animate={{
                    opacity: n.isLocked ? 0.45 : 1,
                    scale: isFocus ? 1.25 : 1,
                  }}
                  transition={{ duration: 0.45, delay: 0.05 * i, ease: "easeOut" }}
                />
                {/* Focus ring */}
                {isFocus && (
                  <motion.circle
                    cx={p.x} cy={p.y} r={baseR + 6}
                    fill="none"
                    stroke={tone.fill}
                    strokeOpacity={0.6}
                    strokeWidth={1}
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: [1, 1.25, 1], opacity: [0.6, 0.2, 0.6] }}
                    transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                {/* Label */}
                <text
                  x={p.x}
                  y={p.y - baseR - 10}
                  textAnchor="middle"
                  className="pointer-events-none select-none"
                  fontSize={11}
                  fontFamily="ui-sans-serif, system-ui"
                  fill={isFocus ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.7)"}
                  style={{ paintOrder: "stroke", stroke: "rgba(3,5,26,0.85)", strokeWidth: 3 }}
                >
                  {n.title.length > 26 ? `${n.title.slice(0, 24)}…` : n.title}
                </text>
                {n.subtitle && (
                  <text
                    x={p.x}
                    y={p.y + baseR + 14}
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                    fontSize={9}
                    fontFamily="ui-monospace, monospace"
                    letterSpacing="0.14em"
                    fill="rgba(255,255,255,0.4)"
                    style={{ paintOrder: "stroke", stroke: "rgba(3,5,26,0.85)", strokeWidth: 3 }}
                  >
                    {n.subtitle.toUpperCase()}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Focus panel */}
        <AnimatePresence>
          {focused && (
            <motion.aside
              key={focused.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.22 }}
              className="absolute bottom-3 left-3 right-3 z-20 rounded-xl border border-white/15 bg-black/65 p-3 backdrop-blur-xl sm:left-auto sm:right-3 sm:max-w-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/45">
                    {focused.subtitle ?? "star"}
                  </div>
                  <div className="mt-0.5 truncate text-sm font-semibold text-white">{focused.title}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setFocusedId(null)}
                  className="rounded-full p-1 text-white/55 hover:bg-white/10 hover:text-white"
                  aria-label="Close detail"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {renderPanel ? (
                <div className="mt-2">{renderPanel(focused)}</div>
              ) : (
                (focused.panelBody || focused.detail) && (
                  <p className="mt-2 text-xs leading-relaxed text-white/65">
                    {focused.panelBody || focused.detail}
                  </p>
                )
              )}
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Chip navigator */}
      <div className="relative z-10 flex items-center gap-2 border-t border-white/10 bg-black/40 px-2 py-2 backdrop-blur">
        <button
          type="button"
          onClick={() => goto(-1)}
          className="rounded-full border border-white/10 p-1.5 text-white/60 hover:border-white/30 hover:text-white"
          aria-label="Previous star"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        <div className="flex flex-1 gap-1.5 overflow-x-auto scrollbar-none">
          {nodes.map((n, i) => {
            const tone = TONE[n.tone ?? "bright"];
            const isActive = focusedId === n.id;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => { setFocusedId(n.id); onNodeClick?.(n.id); }}
                onMouseEnter={() => setHoveredId(n.id)}
                onMouseLeave={() => setHoveredId((cur) => (cur === n.id ? null : cur))}
                className={`group flex shrink-0 items-center gap-2 rounded-full border px-2.5 py-1 text-left transition ${tone.chip} ${
                  isActive ? `ring-1 ${tone.ring} bg-white/10` : "hover:bg-white/[0.07]"
                } ${n.isLocked ? "opacity-55" : ""}`}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: tone.fill, boxShadow: `0 0 8px ${tone.glow}` }}
                />
                <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-white/40">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="max-w-[10rem] truncate text-[11px] font-medium">
                  {n.title}
                </span>
                {n.meta && (
                  <span className="font-mono text-[9px] uppercase tracking-wider text-white/45">
                    {n.meta}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => goto(1)}
          className="rounded-full border border-white/10 p-1.5 text-white/60 hover:border-white/30 hover:text-white"
          aria-label="Next star"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
