import { useMemo, useRef, useState, useLayoutEffect, useEffect } from "react";
import { motion } from "motion/react";
import { Starfield } from "./Starfield";
import type { StarNode, StarTone } from "./ConstellationGraph";

const TONE: Record<StarTone, { core: string; glow: string; ring: string }> = {
  bright:  { core: "#dbeafe", glow: "rgba(191,219,254,0.85)", ring: "rgba(191,219,254,0.35)" },
  warm:    { core: "#ffffff", glow: "rgba(255,255,255,0.85)", ring: "rgba(255,255,255,0.30)" },
  amber:   { core: "#fde68a", glow: "rgba(252,211,77,0.95)",  ring: "rgba(252,211,77,0.45)" },
  emerald: { core: "#a7f3d0", glow: "rgba(110,231,183,0.85)", ring: "rgba(110,231,183,0.35)" },
  violet:  { core: "#ddd6fe", glow: "rgba(196,181,253,0.85)", ring: "rgba(196,181,253,0.35)" },
  rose:    { core: "#fecdd3", glow: "rgba(253,164,175,0.85)", ring: "rgba(253,164,175,0.35)" },
  dim:     { core: "#cbd5e1", glow: "rgba(203,213,225,0.35)", ring: "rgba(203,213,225,0.18)" },
};

interface Props {
  nodes: StarNode[];
  focusedId: string | null;
  onFocusChange: (id: string | null) => void;
  hudLabel?: string;
  hudMeta?: string;
}

// Gentle sinusoidal sway so the linear path reads as a constellation arc.
function layout(count: number, width: number, height: number) {
  const padX = 56;
  const padY = 48;
  const usableW = Math.max(120, width - padX * 2);
  const usableH = Math.max(120, height - padY * 2);
  if (count <= 1) {
    return [{ x: width / 2, y: height / 2 }];
  }
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1);
    const x = padX + t * usableW;
    // sway: gentle S-curve
    const sway = Math.sin(t * Math.PI * 1.6) * (usableH / 2 - 12);
    const y = padY + usableH / 2 + sway;
    return { x, y };
  });
}

export function LinearConstellation({ nodes, focusedId, onFocusChange, hudLabel, hudMeta }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 800, h: 320 });
  const [hoverId, setHoverId] = useState<string | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // height scales with node count, capped
  const height = useMemo(() => {
    const base = 280;
    return Math.min(420, base + Math.max(0, nodes.length - 4) * 18);
  }, [nodes.length]);

  const points = useMemo(() => layout(nodes.length, size.w, height), [nodes.length, size.w, height]);

  const focused = focusedId ? nodes.find((n) => n.id === focusedId) ?? null : null;

  // close panel on Escape
  useEffect(() => {
    if (!focusedId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onFocusChange(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusedId, onFocusChange]);

  if (nodes.length === 0) return null;

  return (
    <div
      ref={wrapRef}
      className="relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-slate-950 via-indigo-950/80 to-slate-900"
      style={{ height }}
    >
      <Starfield density={2600} showShootingStars={false} nebulaHue="indigo" />

      {(hudLabel || hudMeta) && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-white/50">
          <span>{hudLabel}</span>
          <span>{hudMeta}</span>
        </div>
      )}

      {/* connecting spine */}
      <svg
        className="pointer-events-none absolute inset-0 z-10"
        width={size.w}
        height={height}
        viewBox={`0 0 ${size.w} ${height}`}
      >
        <defs>
          <linearGradient id="lc-spine" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
          </linearGradient>
        </defs>
        {points.slice(1).map((p, i) => {
          const a = points[i];
          return (
            <line
              key={i}
              x1={a.x}
              y1={a.y}
              x2={p.x}
              y2={p.y}
              stroke="url(#lc-spine)"
              strokeWidth={1}
              strokeDasharray="2 6"
              opacity={0.7}
            />
          );
        })}
      </svg>

      {/* stars */}
      <div className="absolute inset-0 z-20">
        {nodes.map((n, i) => {
          const p = points[i];
          if (!p) return null;
          const tone = TONE[n.isLocked ? "dim" : (n.tone ?? "bright")];
          const isActive = focusedId === n.id;
          const isHover = hoverId === n.id;
          const isFocus = !!n.isFocus;
          const r = isFocus ? 7 : 5;

          // label position: alternate above/below
          const below = i % 2 === 1;

          return (
            <div
              key={n.id}
              className="absolute"
              style={{ left: p.x, top: p.y, transform: "translate(-50%, -50%)" }}
            >
              <button
                type="button"
                onClick={() => onFocusChange(isActive ? null : n.id)}
                onMouseEnter={() => setHoverId(n.id)}
                onMouseLeave={() => setHoverId((v) => (v === n.id ? null : v))}
                className="group relative block rounded-full focus:outline-none"
                aria-label={n.title}
              >
                {/* outer glow ring */}
                <motion.span
                  aria-hidden
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    width: r * 6,
                    height: r * 6,
                    background: `radial-gradient(circle, ${tone.glow} 0%, transparent 65%)`,
                  }}
                  initial={false}
                  animate={
                    isFocus
                      ? { opacity: [0.5, 0.95, 0.5], scale: [1, 1.25, 1] }
                      : { opacity: isActive || isHover ? 0.9 : 0.55, scale: 1 }
                  }
                  transition={
                    isFocus
                      ? { duration: 2.6, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.25 }
                  }
                />
                {/* core */}
                <span
                  className="relative block rounded-full"
                  style={{
                    width: r * 2,
                    height: r * 2,
                    background: tone.core,
                    boxShadow: `0 0 ${r * 3}px ${tone.glow}, 0 0 ${r * 6}px ${tone.ring}`,
                  }}
                />
              </button>

              {/* label */}
              <div
                className={`pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-center ${
                  below ? "top-full mt-2" : "bottom-full mb-2"
                }`}
              >
                <div
                  className={`font-mono text-[9px] uppercase tracking-[0.22em] ${
                    n.isLocked ? "text-white/35" : "text-white/55"
                  }`}
                >
                  {n.subtitle}
                </div>
                <div
                  className={`max-w-[140px] truncate text-[11px] leading-tight ${
                    n.isLocked ? "text-white/45" : isActive || isFocus ? "text-white" : "text-white/80"
                  }`}
                >
                  {n.title}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* focus panel */}
      {focused && (
        <div className="absolute inset-x-3 bottom-3 z-30 rounded-xl border border-white/15 bg-slate-950/85 p-3 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-white/45">
                {focused.subtitle}
              </div>
              <div className="mt-0.5 text-sm font-medium text-white">{focused.title}</div>
              {focused.panelBody && (
                <p className="mt-1.5 text-xs leading-relaxed text-white/70">{focused.panelBody}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onFocusChange(null)}
              className="rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-white/60 hover:bg-white/10 hover:text-white"
            >
              close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
