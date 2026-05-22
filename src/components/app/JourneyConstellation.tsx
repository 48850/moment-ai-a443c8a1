import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";
import { Star, CheckCircle2, Circle, Lock, Zap, AlertTriangle, X, Sparkles, Target, Calendar } from "lucide-react";
import type { MomentState } from "@/lib/types";
import { computeConstellationNodes, type ConstellationNode, type ConstellationNodeType } from "@/lib/selectors/constellation";
import { Starfield } from "@/components/app/constellation/Starfield";

interface Props {
  state: MomentState;
}

/* -------------------------------------------------------------------------- */
/* Visual config per node type                                                  */
/* -------------------------------------------------------------------------- */

const NODE_VISUAL: Record<ConstellationNodeType, {
  color: string;
  glowColor: string;
  icon: React.ComponentType<{ className?: string }>;
  size: "lg" | "md" | "sm";
  pulseSpeed: number;
}> = {
  NORTH_STAR:      { color: "#ffd28a", glowColor: "255,210,138", icon: Star,         size: "lg", pulseSpeed: 2.5 },
  IDENTITY_STAR:   { color: "#f5f5f5", glowColor: "245,245,245", icon: Target,       size: "md", pulseSpeed: 3.0 },
  TODAY_STAR:      { color: "#fbbf24", glowColor: "251,191,36",  icon: Zap,          size: "md", pulseSpeed: 1.8 },
  WORKSTREAM_STAR: { color: "#a78bfa", glowColor: "167,139,250", icon: Circle,       size: "md", pulseSpeed: 3.5 },
  TASK_STAR:       { color: "#e8ecff", glowColor: "232,236,255", icon: Circle,       size: "sm", pulseSpeed: 4.0 },
  PROOF_STAR:      { color: "#34d399", glowColor: "52,211,153",  icon: CheckCircle2, size: "sm", pulseSpeed: 4.5 },
  GATE_STAR:       { color: "#6b7280", glowColor: "107,114,128", icon: Lock,         size: "sm", pulseSpeed: 6.0 },
  FRICTION_STAR:   { color: "#f59e0b", glowColor: "245,158,11",  icon: AlertTriangle, size: "sm", pulseSpeed: 2.0 },
  SCHEDULE_STAR:   { color: "#60a5fa", glowColor: "96,165,250",  icon: Calendar,     size: "sm", pulseSpeed: 3.8 },
};

const SIZE_PX: Record<"lg" | "md" | "sm", number> = { lg: 22, md: 15, sm: 10 };

/* -------------------------------------------------------------------------- */
/* Layout                                                                       */
/* -------------------------------------------------------------------------- */

interface PositionedNode extends ConstellationNode {
  x: number;
  y: number;
  progress: number;
}

function layoutNodes(nodes: ConstellationNode[], canvasW: number, canvasH: number): PositionedNode[] {
  if (nodes.length === 0) return [];

  const total = nodes.length;
  const paddingX = 100;
  const paddingY = 100;
  const usableW = canvasW - paddingX * 2;
  const usableH = canvasH - paddingY * 2;

  // Priority order for positioning
  const ORDER: ConstellationNodeType[] = [
    "NORTH_STAR", "TODAY_STAR", "IDENTITY_STAR",
    "WORKSTREAM_STAR", "TASK_STAR", "PROOF_STAR",
    "FRICTION_STAR", "GATE_STAR",
  ];

  const sorted = [...nodes].sort((a, b) => {
    const ai = ORDER.indexOf(a.type);
    const bi = ORDER.indexOf(b.type);
    return ai - bi;
  });

  return sorted.map((node, i): PositionedNode => {
    const progress = total <= 1 ? 0.5 : i / (total - 1);
    const x = paddingX + usableW * progress;
    const waveCount = Math.max(2, total / 10);
    const yOff = Math.sin(progress * Math.PI * 2 * waveCount) * (usableH * 0.38);
    const y = canvasH / 2 + yOff;
    return { ...node, x, y, progress };
  });
}

/* -------------------------------------------------------------------------- */
/* Background starfield                                                         */
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
    let w = 0, h = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.floor((w * h) / 2200);
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.2 + 0.2, a: Math.random() * 0.8 + 0.2,
        s: Math.random() * 0.02 + 0.005, tw: Math.random() * Math.PI * 2,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      const g = ctx.createRadialGradient(w * 0.7, h * 0.3, 0, w * 0.7, h * 0.3, Math.max(w, h) * 0.7);
      g.addColorStop(0, "rgba(99,102,241,0.12)");
      g.addColorStop(0.5, "rgba(168,85,247,0.05)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);

      for (const st of stars) {
        st.tw += st.s;
        const alpha = st.a * (0.55 + 0.45 * Math.sin(st.tw));
        ctx.beginPath(); ctx.arc(st.x, st.y, st.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${alpha})`; ctx.fill();
      }

      if (!shooting && Math.random() < 0.003) {
        shooting = { x: Math.random() * w * 0.5, y: Math.random() * h * 0.5, vx: 6 + Math.random() * 4, vy: 2 + Math.random() * 2, life: 1 };
      }
      if (shooting) {
        const s = shooting;
        const tailX = s.x - s.vx * 12; const tailY = s.y - s.vy * 12;
        const grad = ctx.createLinearGradient(tailX, tailY, s.x, s.y);
        grad.addColorStop(0, "rgba(255,255,255,0)"); grad.addColorStop(1, `rgba(255,255,255,${s.life})`);
        ctx.strokeStyle = grad; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(s.x, s.y); ctx.stroke();
        s.x += s.vx; s.y += s.vy; s.life -= 0.012;
        if (s.life <= 0 || s.x > w || s.y > h) shooting = null;
      }
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" />;
};

/* -------------------------------------------------------------------------- */
/* Drawer content per node type                                                 */
/* -------------------------------------------------------------------------- */

function DrawerContent({ node }: { node: ConstellationNode }) {
  switch (node.type) {
    case "NORTH_STAR":
      return (
        <div className="space-y-3">
          <p className="text-sm text-white/80 leading-relaxed">{node.why_it_matters}</p>
          {node.next_action && (
            <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2">
              <p className="text-xs text-amber-400/70 uppercase tracking-wider mb-1">Next move</p>
              <p className="text-sm text-white/80">{node.next_action}</p>
            </div>
          )}
        </div>
      );
    case "IDENTITY_STAR":
      return <p className="text-sm text-white/70 leading-relaxed">Who you're becoming: <span className="text-white">{node.title}</span></p>;
    case "TODAY_STAR":
      return (
        <div className="space-y-3">
          <p className="text-sm text-white/80 leading-relaxed">{node.why_it_matters}</p>
          <p className="text-xs text-amber-300/70 uppercase tracking-wider">This is your move today.</p>
        </div>
      );
    case "WORKSTREAM_STAR":
      return (
        <div className="space-y-2 text-xs text-white/60">
          {node.subtitle && <div>Status · <span className="text-white/80">{node.subtitle}</span></div>}
          <p className="text-sm text-white/70">{node.why_it_matters}</p>
          {node.next_action && <div>Next proof · <span className="text-white/80">{node.next_action}</span></div>}
        </div>
      );
    case "TASK_STAR":
      return (
        <div className="space-y-2 text-xs text-white/60">
          {node.why_it_matters && <p className="text-sm text-white/70">{node.why_it_matters}</p>}
          {node.subtitle && <div>Priority · <span className="text-white/80">{node.subtitle}</span></div>}
          {node.stage_fit && (
            <div>Stage fit · <span className={
              node.stage_fit === "strong" ? "text-emerald-400" :
              node.stage_fit === "okay" ? "text-amber-400" : "text-white/50"
            }>{node.stage_fit}</span></div>
          )}
        </div>
      );
    case "PROOF_STAR":
      return (
        <div className="space-y-2">
          <p className="text-sm text-emerald-400/80">You advanced the pathway.</p>
          {node.subtitle && <p className="text-xs text-white/40">Completed {node.subtitle}</p>}
        </div>
      );
    case "GATE_STAR":
      return (
        <div className="space-y-3">
          <p className="text-sm text-white/50 leading-relaxed">{node.why_it_matters}</p>
          {node.unlock_condition && (
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
              <p className="text-xs text-white/30 uppercase tracking-wider mb-1">🔒 Unlocks when</p>
              <p className="text-xs text-white/50">{node.unlock_condition}</p>
            </div>
          )}
        </div>
      );
    case "FRICTION_STAR":
      return (
        <div className="space-y-2">
          <p className="text-sm text-white/70">{node.why_it_matters}</p>
          {node.evidence && node.evidence.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {node.evidence.map((e, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full text-xs bg-amber-400/10 border border-amber-400/20 text-amber-300/70">{e}</span>
              ))}
            </div>
          )}
          <p className="text-xs text-white/30">Consider shrinking or clarifying this area.</p>
        </div>
      );
    case "SCHEDULE_STAR":
      return (
        <div className="space-y-2 text-xs text-white/60">
          {node.subtitle && <div>When · <span className="text-white/80">{node.subtitle}</span></div>}
          <p className="text-sm text-white/70">{node.why_it_matters}</p>
          {node.status === "locked" && (
            <div className="text-[11px] text-white/40">Locked block — protected from reform.</div>
          )}
        </div>
      );
    default:
      return <p className="text-sm text-white/60">{node.why_it_matters}</p>;
  }
}

/* -------------------------------------------------------------------------- */
/* Component                                                                    */
/* -------------------------------------------------------------------------- */

export const JourneyConstellation = ({ state }: Props) => {
  const [focused, setFocused] = useState<ConstellationNode | null>(null);

  const nodes = useMemo(() => computeConstellationNodes(state), [
    state.active_goal, state.tasks, state.pursuit_model,
    state.execution_feedback, state.today_state,
    state.schedule_state?.week_plan, state.schedule_state?.week_plan_generated_at,
  ]);

  const { positioned, canvasWidth, canvasHeight } = useMemo(() => {
    const total = nodes.length;
    const widthPerNode = total > 20 ? 140 : 200;
    const canvasWidth = Math.max(900, total * widthPerNode);
    const canvasHeight = 520;
    const positioned = layoutNodes(nodes, canvasWidth, canvasHeight);
    return { positioned, canvasWidth, canvasHeight };
  }, [nodes]);

  // Empty state — no filler stars
  if (nodes.length === 0) {
    return (
      <section
        className="relative overflow-hidden rounded-2xl border border-border/40 flex items-center justify-center"
        style={{
          background: "radial-gradient(ellipse at 30% 20%, #1a1d3d 0%, #0a0d24 45%, #03051a 100%)",
          minHeight: 280,
        }}
      >
        <Starfield />
        <div className="relative z-10 text-center space-y-2 px-8">
          <Sparkles className="w-6 h-6 text-white/20 mx-auto" />
          <p className="text-white/40 text-sm">
            Once you set your goal, Moment will map the pathway here.
          </p>
        </div>
      </section>
    );
  }

  const links = positioned.slice(0, -1).map((n, i) => ({ from: n, to: positioned[i + 1] }));

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-border/40 shadow-[0_0_40px_-10px_rgba(99,102,241,0.4)]"
      style={{ background: "radial-gradient(ellipse at 30% 20%, #1a1d3d 0%, #0a0d24 45%, #03051a 100%)" }}
    >
      {/* HUD header */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/10 bg-black/30 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 animate-pulse text-amber-200" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">
            pathway map · evidence only
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">
          {nodes.filter((n) => n.type === "PROOF_STAR").length} proven ·{" "}
          {nodes.filter((n) => n.type === "GATE_STAR").length} locked
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
              {/* SVG links */}
              <svg className="pointer-events-none absolute inset-0" width={canvasWidth} height={canvasHeight}>
                <defs>
                  <linearGradient id="trail" x1="0" x2="1" y1="0" y2="0">
                    <stop offset="0%" stopColor="rgba(163,201,255,0.05)" />
                    <stop offset="50%" stopColor="rgba(163,201,255,0.4)" />
                    <stop offset="100%" stopColor="rgba(255,210,138,0.3)" />
                  </linearGradient>
                </defs>
                {links.map((l, i) => {
                  const dx = l.to.x - l.from.x;
                  const dy = l.to.y - l.from.y;
                  const cx = l.from.x + dx / 2;
                  const cy = l.from.y + dy / 2 - 25;
                  const path = `M ${l.from.x} ${l.from.y} Q ${cx} ${cy} ${l.to.x} ${l.to.y}`;
                  return (
                    <motion.path
                      key={i}
                      d={path}
                      fill="none"
                      stroke="url(#trail)"
                      strokeWidth={1}
                      strokeDasharray="2 5"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.7 }}
                      transition={{ duration: 1.2, delay: i * 0.04 }}
                    />
                  );
                })}
              </svg>

              {/* Nodes */}
              <AnimatePresence>
                {positioned.map((n, i) => {
                  const visual = NODE_VISUAL[n.type];
                  const radius = SIZE_PX[visual.size];
                  const Icon = visual.icon;
                  const isLocked = n.status === "locked";
                  const isDimmed = n.status === "dimmed";
                  const labelAbove = i % 2 === 0;
                  const opacity = isLocked ? 0.45 : isDimmed ? 0.55 : 1;

                  return (
                    <motion.button
                      key={n.id}
                      type="button"
                      onClick={() => setFocused(n)}
                      initial={{ opacity: 0, scale: 0.2 }}
                      animate={{ opacity, scale: 1 }}
                      transition={{ delay: i * 0.04, type: "spring", stiffness: 180, damping: 14 }}
                      className="absolute flex items-center justify-center rounded-full transition-transform hover:scale-125"
                      style={{
                        width: radius * 2,
                        height: radius * 2,
                        left: n.x - radius,
                        top: n.y - radius,
                        background: `radial-gradient(circle, ${visual.color} 0%, rgba(${visual.glowColor},0.5) 55%, transparent 75%)`,
                        boxShadow: isLocked
                          ? `0 0 ${radius}px rgba(${visual.glowColor},0.2)`
                          : `0 0 ${radius * 2}px rgba(${visual.glowColor},0.7), 0 0 ${radius * 4}px rgba(${visual.glowColor},0.3)`,
                        filter: isDimmed ? "grayscale(0.5)" : "none",
                      }}
                      aria-label={n.title}
                    >
                      <motion.span
                        className="absolute inset-0 rounded-full"
                        animate={{
                          opacity: [0.5, 1, 0.5],
                          scale: [1, 1.12, 1],
                        }}
                        transition={{
                          duration: visual.pulseSpeed,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        style={{ background: `radial-gradient(circle, rgba(${visual.glowColor},0.4) 0%, transparent 70%)` }}
                      />
                      {visual.size !== "sm" && (
                        <Icon className="relative h-3 w-3 text-black/50" />
                      )}
                      <span
                        className={`pointer-events-none absolute left-1/2 w-28 -translate-x-1/2 text-center font-mono text-[9px] leading-tight ${
                          isLocked ? "text-white/30" : "text-white/65"
                        } ${labelAbove ? "bottom-full mb-1.5" : "top-full mt-1.5"}`}
                        style={{ textShadow: "0 0 6px rgba(0,0,0,0.9)" }}
                      >
                        {n.title.length > 28 ? `${n.title.slice(0, 27)}…` : n.title}
                        {isLocked && " 🔒"}
                      </span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            </div>
          </TransformComponent>
        </TransformWrapper>
      </div>

      {/* Footer */}
      <div className="relative z-10 flex items-center justify-between border-t border-white/10 bg-black/30 px-4 py-2 backdrop-blur">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          pinch · scroll · drag
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
          {nodes.length} stars mapped
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
            className="absolute right-0 top-0 z-20 flex h-full w-72 flex-col gap-3 border-l border-white/10 bg-black/80 p-5 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
                {focused.type.replace(/_/g, " ").toLowerCase()}
              </span>
              <button
                onClick={() => setFocused(null)}
                className="rounded-full p-1 text-white/70 hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <h3 className="text-base font-semibold leading-snug text-white">{focused.title}</h3>
            <DrawerContent node={focused} />
          </motion.aside>
        )}
      </AnimatePresence>
    </section>
  );
};
