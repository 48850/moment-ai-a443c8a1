import { useMemo, useState } from "react";
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
  progress: number; // 0..1 along the X axis
  x: number;
  y: number;
  task?: Task;
}

interface Props {
  state: MomentState;
}

/* -------------------------------------------------------------------------- */
/* Layout math (sinusoidal arc)                                                */
/* -------------------------------------------------------------------------- */

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
  // Even chronological distribution as fallback
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

/* -------------------------------------------------------------------------- */
/* Visual atoms                                                                */
/* -------------------------------------------------------------------------- */

const NODE_STYLE: Record<
  NodeType,
  { ring: string; bg: string; icon: React.ComponentType<{ className?: string }>; glow: string }
> = {
  origin: {
    ring: "border-accent",
    bg: "bg-accent/15",
    icon: Star,
    glow: "shadow-[0_0_24px_hsl(var(--accent)/0.55)]",
  },
  done: {
    ring: "border-primary",
    bg: "bg-primary/15",
    icon: CheckCircle2,
    glow: "shadow-[0_0_18px_hsl(var(--primary)/0.45)]",
  },
  pending: {
    ring: "border-border",
    bg: "bg-card",
    icon: Circle,
    glow: "",
  },
  domain: {
    ring: "border-primary/40",
    bg: "bg-primary/5",
    icon: Network,
    glow: "",
  },
  goal: {
    ring: "border-accent",
    bg: "bg-accent/10",
    icon: Target,
    glow: "shadow-[0_0_28px_hsl(var(--accent)/0.6)]",
  },
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
    // Origin
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

  // Zone divider X positions (4 quartiles)
  const zoneEdges = ZONES.map((_, i) => ((i + 1) / ZONES.length) * canvasWidth);

  const nodeRadius = density === "ultra" ? 6 : density === "dense" ? 9 : 14;
  const showLabels = density !== "ultra";

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-b from-card to-background">
      {/* HUD header */}
      <div className="flex items-center justify-between border-b border-border bg-card/60 px-4 py-2 backdrop-blur">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            temporal expansion
          </span>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          days → years · {nodes.length - 1} steps
        </span>
      </div>

      <div className="relative h-[420px] w-full">
        <TransformWrapper
          minScale={0.4}
          maxScale={3}
          initialScale={Math.min(1, 900 / canvasWidth)}
          centerOnInit
          wheel={{ step: 0.1 }}
          doubleClick={{ disabled: true }}
        >
          <TransformComponent
            wrapperStyle={{ width: "100%", height: "100%" }}
            contentStyle={{ width: canvasWidth, height: canvasHeight }}
          >
            <div
              className="relative"
              style={{ width: canvasWidth, height: canvasHeight }}
            >
              {/* Zone delimiters */}
              {zoneEdges.map((edge, i) => (
                <div
                  key={i}
                  className="absolute top-0 h-full border-l border-dashed border-border/60"
                  style={{ left: edge }}
                >
                  <span className="absolute -top-1 left-2 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground/70">
                    {ZONES[i]}
                  </span>
                </div>
              ))}

              {/* SVG links */}
              <svg
                className="pointer-events-none absolute inset-0"
                width={canvasWidth}
                height={canvasHeight}
              >
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
                      stroke="hsl(var(--border))"
                      strokeWidth={1}
                      strokeDasharray="3 4"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.7 }}
                      transition={{ duration: 0.8, delay: i * 0.015 }}
                    />
                  );
                })}
              </svg>

              {/* Nodes */}
              <AnimatePresence>
                {nodes.map((n, i) => {
                  const style = NODE_STYLE[n.type];
                  const Icon = style.icon;
                  const labelAbove = i % 2 === 0;
                  return (
                    <motion.button
                      key={n.id}
                      type="button"
                      onClick={() => setFocused(n)}
                      initial={{ opacity: 0, scale: 0.4 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.02, type: "spring", stiffness: 220, damping: 18 }}
                      className={`absolute flex items-center justify-center rounded-full border-2 ${style.ring} ${style.bg} ${style.glow} transition-transform hover:scale-110`}
                      style={{
                        width: nodeRadius * 2,
                        height: nodeRadius * 2,
                        left: n.x - nodeRadius,
                        top: n.y - nodeRadius,
                      }}
                      aria-label={n.title}
                    >
                      {density !== "ultra" && (
                        <Icon
                          className={
                            n.type === "done"
                              ? "h-3 w-3 text-primary"
                              : n.type === "origin" || n.type === "goal"
                                ? "h-3.5 w-3.5 text-accent"
                                : "h-3 w-3 text-muted-foreground"
                          }
                        />
                      )}
                      {showLabels && (
                        <span
                          className={`pointer-events-none absolute left-1/2 w-32 -translate-x-1/2 text-center font-mono text-[10px] leading-tight text-foreground/80 ${
                            labelAbove ? "bottom-full mb-2" : "top-full mt-2"
                          }`}
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

      <div className="flex items-center justify-between border-t border-border bg-card/60 px-4 py-2">
        <span className="text-xs text-muted-foreground">
          Pinch / scroll to zoom · drag to pan
        </span>
        <span className="text-xs text-muted-foreground">
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
            className="absolute right-0 top-0 flex h-full w-80 flex-col gap-3 border-l border-border bg-card p-5 shadow-elevated"
          >
            <div className="flex items-start justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {focused.category} · {focused.type}
              </span>
              <button
                onClick={() => setFocused(null)}
                className="rounded-full p-1 hover:bg-secondary"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <h3 className="text-lg font-semibold leading-tight">{focused.title}</h3>
            {focused.description && (
              <p className="text-sm text-muted-foreground">{focused.description}</p>
            )}
            {focused.task && (
              <div className="mt-2 space-y-2 text-xs text-muted-foreground">
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
