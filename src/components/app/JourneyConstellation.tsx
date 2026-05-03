import { useMemo, useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import {
  Star,
  CheckCircle2,
  Circle,
  Network,
  Target,
  X,
  Sparkles,
} from "lucide-react";
import type { MomentState, Task } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

type NodeType = "origin" | "done" | "pending" | "domain" | "goal";
type Zone = "Days" | "Weeks" | "Months" | "Years";

interface ConstellationNode {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  category: Zone;
  progress: number;
  x: number;
  y: number;
  task?: Task;
}

interface Props {
  state: MomentState;
}

const ZONES: Zone[] = ["Days", "Weeks", "Months", "Years"];

function categorizeTask(t: Task, idx: number, total: number): Zone {
  if (t.due_date) {
    const ms = new Date(t.due_date).getTime() - Date.now();
    const days = ms / 86_400_000;
    if (days <= 7) return "Days";
    if (days <= 35) return "Weeks";
    if (days <= 200) return "Months";
    return "Years";
  }
  const ratio = total <= 1 ? 0 : idx / (total - 1);
  if (ratio < 0.25) return "Days";
  if (ratio < 0.55) return "Weeks";
  if (ratio < 0.8) return "Months";
  return "Years";
}

function calculatePosition(
  progress: number,
  totalCount: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  const paddingX = 80;
  const paddingY = 120;
  const usableWidth = canvasWidth - paddingX * 2;
  const usableHeight = canvasHeight - paddingY * 2;
  const x = paddingX + usableWidth * progress;
  const waveCount = Math.max(2.5, totalCount / 12);
  const yOffset = Math.sin(progress * Math.PI * 2 * waveCount) * (usableHeight * 0.42);
  const y = canvasHeight / 2 + yOffset;
  return { x, y };
}

const NODE_STYLE: Record<
  NodeType,
  { color: string; icon: React.ComponentType<{ className?: string }>; glowColor: string }
> = {
  origin: {
    color: "#ffd28a",
    icon: Star,
    glowColor: "255,210,138",
  },
  done: {
    color: "#a3c9ff",
    icon: CheckCircle2,
    glowColor: "163,201,255",
  },
  pending: {
    color: "#e8ecff",
    icon: Circle,
    glowColor: "232,236,255",
  },
  domain: {
    color: "#b6a3ff",
    icon: Network,
    glowColor: "182,163,255",
  },
  goal: {
    color: "#ffb98a",
    icon: Target,
    glowColor: "255,185,138",
  },
};

/* -------------------------------------------------------------------------- */
/* Background starfield (canvas)                                               */
/* -------------------------------------------------------------------------- */

const Starfield = () => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let stars: { x: number; y: number; r: number; a: number; s: number; tw: number }[] = [];
    let shooting: { x: number; y: number; vx: number; vy: number; life: number } | null = null;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.floor((w * h) / 2200);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.2 + 0.2,
        a: Math.random() * 0.8 + 0.2,
        s: Math.random() * 0.02 + 0.005,
        tw: Math.random() * Math.PI * 2,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      // subtle nebula gradient
      const g = ctx.createRadialGradient(w * 0.7, h * 0.3, 0, w * 0.7, h * 0.3, Math.max(w, h) * 0.7);
      g.addColorStop(0, "rgba(99, 102, 241, 0.12)");
      g.addColorStop(0.5, "rgba(168, 85, 247, 0.05)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      for (const st of stars) {
        st.tw += st.s;
        const alpha = st.a * (0.55 + 0.45 * Math.sin(st.tw));
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`;
        ctx.fill();
      }

      // shooting star
      if (!shooting && Math.random() < 0.004) {
        shooting = {
          x: Math.random() * w * 0.5,
          y: Math.random() * h * 0.5,
          vx: 6 + Math.random() * 4,
          vy: 2 + Math.random() * 2,
          life: 1,
        };
      }
      if (shooting) {
        const s = shooting;
        const tailX = s.x - s.vx * 12;
        const tailY = s.y - s.vy * 12;
        const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
        grad.addColorStop(0, "rgba(255,255,255,0)");
        grad.addColorStop(1, `rgba(255,255,255,${s.life})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
        s.x += s.vx;
        s.y += s.vy;
        s.life -= 0.012;
        if (s.life <= 0 || s.x > w || s.y > h) shooting = null;
      }

      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" />;
};

/* -------------------------------------------------------------------------- */
/* Component                                                                   */
/* -------------------------------------------------------------------------- */

export const JourneyConstellation = ({ state }: Props) => {
  const [focused, setFocused] = useState<ConstellationNode | null>(null);

  const { nodes, links, canvasWidth, canvasHeight, density } = useMemo(() => {
    const tasks = state.tasks ?? [];
    const goal = state.active_goal?.statement ?? "";

    const sorted = [...tasks].sort((a, b) => {
      const ad = a.due_date ? new Date(a.due_date).getTime() : Infinity;
      const bd = b.due_date ? new Date(b.due_date).getTime() : Infinity;
      if (ad !== bd) return ad - bd;
      return (a.created_at || "").localeCompare(b.created_at || "");
    });

    const ordered: ConstellationNode[] = [];
    ordered.push({
      id: "__origin",
      type: "origin",
      title: "Action catalyst",
      description: "Where this journey begins.",
      category: "Days",
      progress: 0,
      x: 0,
      y: 0,
    });
    sorted.forEach((t, i) => {
      ordered.push({
        id: t.id,
        type: t.status === "done" ? "done" : "pending",
        title: t.title,
        description: t.description || undefined,
        category: categorizeTask(t, i, sorted.length),
        progress: 0,
        x: 0,
        y: 0,
        task: t,
      });
    });
    if (goal) {
      ordered.push({
        id: "__goal",
        type: "goal",
        title: goal,
        description: state.active_goal?.why_it_matters,
        category: "Years",
        progress: 1,
        x: 0,
        y: 0,
      });
    }

    const total = ordered.length;
    const widthPerNode = total > 20 ? 160 : 200;
    const canvasWidth = Math.max(900, total * widthPerNode);
    const canvasHeight = 520;

    ordered.forEach((n, i) => {
      n.progress = total <= 1 ? 0 : i / (total - 1);
      const { x, y } = calculatePosition(n.progress, total, canvasWidth, canvasHeight);
      n.x = x;
      n.y = y;
    });

    const links = ordered.slice(0, -1).map((n, i) => ({
      from: n,
      to: ordered[i + 1],
    }));

    const density: "standard" | "dense" | "ultra" =
      total > 40 ? "ultra" : total > 20 ? "dense" : "standard";

    return { nodes: ordered, links, canvasWidth, canvasHeight, density };
  }, [state.tasks, state.active_goal]);

  if (nodes.length <= 1) return null;

  const zoneEdges = ZONES.map((_, i) => ((i + 1) / ZONES.length) * canvasWidth);
  const nodeRadius = density === "ultra" ? 6 : density === "dense" ? 9 : 14;
  const showLabels = density !== "ultra";

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-border/40 shadow-[0_0_40px_-10px_rgba(99,102,241,0.4)]"
      style={{
        background:
          "radial-gradient(ellipse at 30% 20%, #1a1d3d 0%, #0a0d24 45%, #03051a 100%)",
      }}
    >
      {/* HUD header */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/30 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 animate-pulse text-amber-200" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">
            night sky · temporal expansion
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">
          days → years · {nodes.length - 1} stars
        </span>
      </div>

      <div className="relative h-[420px] w-full">
        <Starfield />
        <TransformWrapper
          minScale={0.4}
          maxScale={3}
          initialScale={Math.min(1, 900 / canvasWidth)}
          centerOnInit
          wheel={{ step: 0.1 }}
          doubleClick={{ disabled: true }}
        >
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%", position: "relative", zIndex: 1 }}
            contentStyle={{ width: canvasWidth, height: canvasHeight }}
          >
            <div className="relative" style={{ width: canvasWidth, height: canvasHeight }}>
              {/* Zone delimiters */}
              {zoneEdges.map((edge, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-dashed border-white/10"
                  style={{ left: edge }}
                >
                  <span className="absolute -top-1 left-2 font-mono text-[9px] uppercase tracking-[0.25em] text-white/40">
                    {ZONES[i]}
                  </span>
                </div>
              ))}

              {/* SVG links — gossamer trails */}
              <svg
                className="pointer-events-none absolute inset-0"
                width={canvasWidth}
                height={canvasHeight}
              >
                <defs>
                  <linearGradient id="trail" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="rgba(163,201,255,0.05)" />
                    <stop offset="50%" stopColor="rgba(163,201,255,0.55)" />
                    <stop offset="100%" stopColor="rgba(255,210,138,0.4)" />
                  </linearGradient>
                </defs>
                {links.map((l, i) => {
                  const dx = l.to.x - l.from.x;
                  const dy = l.to.y - l.from.y;
                  const cx = l.from.x + dx / 2;
                  const cy = l.from.y + dy / 2 - 30;
                  const path = `M ${l.from.x} ${l.from.y} Q ${cx} ${cy} ${l.to.x} ${l.to.y}`;
                  return (
                    <motion.path
                      key={i}
                      d={path}
                      fill="none"
                      stroke="url(#trail)"
                      strokeWidth={1.2}
                      strokeDasharray="2 5"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.85 }}
                      transition={{ duration: 1.2, delay: i * 0.04 }}
                    />
                  );
                })}
              </svg>

              {/* Stars */}
              <AnimatePresence>
                {nodes.map((n, i) => {
                  const style = NODE_STYLE[n.type];
                  const Icon = style.icon;
                  const labelAbove = i % 2 === 0;
                  const isLuminary = n.type === "origin" || n.type === "goal" || n.type === "done";
                  return (
                    <motion.button
                      key={n.id}
                      type="button"
                      onClick={() => setFocused(n)}
                      initial={{ opacity: 0, scale: 0.2 }}
                      animate={{
                        opacity: 1,
                        scale: 1,
                      }}
                      transition={{
                        delay: i * 0.04,
                        type: "spring",
                        stiffness: 180,
                        damping: 14,
                      }}
                      className="absolute flex items-center justify-center rounded-full transition-transform hover:scale-125"
                      style={{
                        width: nodeRadius * 2,
                        height: nodeRadius * 2,
                        left: n.x - nodeRadius,
                        top: n.y - nodeRadius,
                        background: isLuminary
                          ? `radial-gradient(circle, ${style.color} 0%, ${style.color} 35%, rgba(${style.glowColor},0.4) 60%, transparent 75%)`
                          : `radial-gradient(circle, ${style.color} 0%, rgba(${style.glowColor},0.6) 50%, transparent 75%)`,
                        boxShadow: isLuminary
                          ? `0 0 ${nodeRadius * 2}px rgba(${style.glowColor},0.9), 0 0 ${nodeRadius * 4}px rgba(${style.glowColor},0.4)`
                          : `0 0 ${nodeRadius}px rgba(${style.glowColor},0.5)`,
                      }}
                      aria-label={n.title}
                    >
                      <motion.span
                        className="absolute inset-0 rounded-full"
                        animate={{
                          opacity: isLuminary ? [0.6, 1, 0.6] : [0.4, 0.8, 0.4],
                          scale: isLuminary ? [1, 1.15, 1] : [1, 1.08, 1],
                        }}
                        transition={{
                          duration: 2.5 + (i % 5) * 0.4,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        style={{
                          background: `radial-gradient(circle, rgba(${style.glowColor},0.5) 0%, transparent 70%)`,
                        }}
                      />
                      {density !== "ultra" && (
                        <Icon
                          className="relative h-3 w-3"
                          style={{ color: "rgba(0,0,0,0.55)" }}
                        />
                      )}
                      {showLabels && (
                        <span
                          className={`pointer-events-none absolute left-1/2 w-32 -translate-x-1/2 text-center font-mono text-[10px] leading-tight text-white/75 ${
                            labelAbove ? "bottom-full mb-2" : "top-full mt-2"
                          }`}
                          style={{ textShadow: "0 0 8px rgba(0,0,0,0.8)" }}
                        >
                          {n.title}
                        </span>
                      )}
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      <div className="relative z-10 flex items-center justify-between border-t border-white/10 bg-black/30 px-4 py-2 backdrop-blur">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          pinch · scroll · drag the cosmos
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          {nodes.filter((n) => n.type === "done").length} lit
        </span>
      </div>

      {/* Focus drawer */}
      <AnimatePresence>
        {focused && (
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="absolute right-0 top-0 z-20 flex h-full w-80 flex-col gap-3 border-l border-white/10 bg-black/80 p-5 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
                {focused.category} · {focused.type}
              </span>
              <button
                onClick={() => setFocused(null)}
                className="rounded-full p-1 text-white/70 hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <h3 className="text-lg font-semibold leading-tight text-white">{focused.title}</h3>
            {focused.description && (
              <p className="text-sm text-white/70">{focused.description}</p>
            )}
            {focused.task && (
              <div className="mt-2 space-y-2 text-xs text-white/60">
                <div>Status · {focused.task.status}</div>
                <div>Priority · {focused.task.priority}</div>
                {focused.task.due_date && <div>Due · {focused.task.due_date}</div>}
                <div>Estimated · {focused.task.estimated_minutes}m</div>
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
    </section>
  );
};
