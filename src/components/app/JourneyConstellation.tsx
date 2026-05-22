import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { CheckCircle2, Circle, Lock, Zap, AlertTriangle, X, Sparkles, Target, Calendar, Star } from "lucide-react";
import type { MomentState } from "@/lib/types";
import { computeConstellationNodes, type ConstellationNode, type ConstellationNodeType } from "@/lib/selectors/constellation";
import { Starfield, DEEP_SPACE_BG, ConstellationHud } from "@/components/app/constellation/Starfield";

interface Props {
  state: MomentState;
}

const NODE_META: Record<ConstellationNodeType, {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone: string;
  dot: string;
}> = {
  NORTH_STAR: { label: "north star", Icon: Star, tone: "border-amber-200/35 bg-amber-200/10 text-amber-100", dot: "bg-amber-200" },
  IDENTITY_STAR: { label: "identity", Icon: Target, tone: "border-white/20 bg-white/[0.06] text-white", dot: "bg-white/80" },
  TODAY_STAR: { label: "today", Icon: Zap, tone: "border-amber-300/45 bg-amber-300/10 text-amber-100", dot: "bg-amber-300" },
  WORKSTREAM_STAR: { label: "lane", Icon: Circle, tone: "border-violet-200/30 bg-violet-200/10 text-violet-100", dot: "bg-violet-200" },
  TASK_STAR: { label: "task", Icon: Circle, tone: "border-blue-200/25 bg-blue-200/10 text-blue-100", dot: "bg-blue-200" },
  PROOF_STAR: { label: "proof", Icon: CheckCircle2, tone: "border-emerald-200/30 bg-emerald-200/10 text-emerald-100", dot: "bg-emerald-200" },
  GATE_STAR: { label: "locked", Icon: Lock, tone: "border-white/10 bg-white/[0.035] text-white/55", dot: "bg-white/35" },
  FRICTION_STAR: { label: "signal", Icon: AlertTriangle, tone: "border-orange-200/30 bg-orange-200/10 text-orange-100", dot: "bg-orange-200" },
  SCHEDULE_STAR: { label: "scheduled", Icon: Calendar, tone: "border-sky-200/25 bg-sky-200/10 text-sky-100", dot: "bg-sky-200" },
};

const ORDER: ConstellationNodeType[] = [
  "NORTH_STAR",
  "IDENTITY_STAR",
  "TODAY_STAR",
  "WORKSTREAM_STAR",
  "TASK_STAR",
  "SCHEDULE_STAR",
  "PROOF_STAR",
  "FRICTION_STAR",
  "GATE_STAR",
];

function compactText(text?: string, fallback = "No detail logged yet.") {
  const value = text?.trim() || fallback;
  return value.length > 138 ? `${value.slice(0, 135)}…` : value;
}

export const JourneyConstellation = ({ state }: Props) => {
  const [focused, setFocused] = useState<ConstellationNode | null>(null);

  const nodes = useMemo(() => computeConstellationNodes(state), [
    state.active_goal, state.tasks, state.pursuit_model,
    state.execution_feedback, state.today_state,
    state.schedule_state?.week_plan, state.schedule_state?.week_plan_generated_at,
  ]);

  const { route, overflow, counts, nextFocus } = useMemo(() => {
    const sorted = [...nodes].sort((a, b) => {
      const byType = ORDER.indexOf(a.type) - ORDER.indexOf(b.type);
      if (byType !== 0) return byType;
      if (a.status === "active" && b.status !== "active") return -1;
      if (b.status === "active" && a.status !== "active") return 1;
      return a.title.localeCompare(b.title);
    });

    const primary = sorted.filter((node) => {
      if (["NORTH_STAR", "IDENTITY_STAR", "TODAY_STAR"].includes(node.type)) return true;
      if (node.type === "WORKSTREAM_STAR") return true;
      if (node.type === "TASK_STAR" && node.status === "active") return true;
      if (node.type === "PROOF_STAR") return true;
      if (node.type === "FRICTION_STAR") return true;
      return false;
    }).slice(0, 12);

    const primaryIds = new Set(primary.map((n) => n.id));
    const hidden = sorted.filter((n) => !primaryIds.has(n.id));
    const active = sorted.find((n) => n.type === "TODAY_STAR" || (n.type === "TASK_STAR" && n.status === "active"));

    return {
      route: primary,
      overflow: hidden,
      nextFocus: active,
      counts: {
        proofs: nodes.filter((n) => n.type === "PROOF_STAR").length,
        locked: nodes.filter((n) => n.type === "GATE_STAR").length,
        active: nodes.filter((n) => n.status === "active").length,
      },
    };
  }, [nodes]);

  if (nodes.length === 0) {
    return (
      <section className="relative flex min-h-72 items-center justify-center overflow-hidden rounded-2xl border border-border/40" style={{ background: DEEP_SPACE_BG }}>
        <Starfield density={4200} showShootingStars={false} />
        <div className="relative z-10 px-8 text-center">
          <Sparkles className="mx-auto h-6 w-6 text-white/20" />
          <p className="mt-2 text-sm text-white/40">Once you set your goal, Moment will map the pathway here.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/40 shadow-[0_0_40px_-10px_rgba(99,102,241,0.4)]" style={{ background: DEEP_SPACE_BG }}>
      <ConstellationHud
        label="journey pathway"
        meta={`${counts.active} active · ${counts.proofs} proven · ${counts.locked} locked`}
      />

      <div className="relative p-4 sm:p-5">
        <Starfield density={4400} showShootingStars={false} />

        {nextFocus && (
          <button
            type="button"
            onClick={() => setFocused(nextFocus)}
            className="relative z-10 mb-4 w-full rounded-xl border border-amber-200/25 bg-amber-200/[0.07] p-4 text-left backdrop-blur transition hover:border-amber-100/40"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-100/55">what to move next</div>
            <div className="mt-1 text-sm font-semibold leading-snug text-white">{nextFocus.title}</div>
            <div className="mt-1 text-xs leading-relaxed text-white/55">{compactText(nextFocus.next_action || nextFocus.why_it_matters)}</div>
          </button>
        )}

        <div className="relative z-10 grid gap-3">
          {route.map((node, index) => {
            const meta = NODE_META[node.type];
            const Icon = meta.Icon;
            return (
              <motion.button
                key={node.id}
                type="button"
                onClick={() => setFocused(node)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: node.status === "locked" ? 0.58 : 1, y: 0 }}
                transition={{ delay: index * 0.035 }}
                className={`relative grid grid-cols-[34px_1fr] gap-3 rounded-xl border p-4 text-left backdrop-blur transition hover:border-white/35 hover:bg-white/[0.075] ${meta.tone}`}
              >
                {index < route.length - 1 && (
                  <span className="absolute left-[31px] top-[52px] h-[calc(100%-16px)] w-px bg-gradient-to-b from-blue-200/35 to-transparent" />
                )}
                <span className="relative flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-black/25">
                  <span className={`absolute h-2.5 w-2.5 rounded-full ${meta.dot} shadow-[0_0_14px_currentColor]`} />
                  <Icon className="relative h-3.5 w-3.5 opacity-55" />
                </span>
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-current">{node.title}</span>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/35">{meta.label}</span>
                    {node.subtitle && <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/35">{node.subtitle}</span>}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-white/55">{compactText(node.next_action || node.why_it_matters)}</span>
                </span>
              </motion.button>
            );
          })}
        </div>

        {overflow.length > 0 && (
          <div className="relative z-10 mt-3 rounded-xl border border-white/10 bg-black/20 p-3 font-mono text-[10px] uppercase tracking-[0.18em] text-white/35">
            + {overflow.length} background signal{overflow.length === 1 ? "" : "s"} hidden to keep the route readable
          </div>
        )}
      </div>

      <AnimatePresence>
        {focused && (
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="absolute right-0 top-0 z-20 flex h-full w-full max-w-sm flex-col gap-3 border-l border-white/10 bg-black/85 p-5 backdrop-blur-xl"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/45">
                {NODE_META[focused.type].label}
              </span>
              <button onClick={() => setFocused(null)} className="rounded-full p-1 text-white/70 hover:bg-white/10" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <h3 className="text-base font-semibold leading-snug text-white">{focused.title}</h3>
            <p className="text-sm leading-relaxed text-white/65">{focused.why_it_matters}</p>
            {focused.next_action && (
              <div className="rounded-lg border border-amber-200/20 bg-amber-200/5 px-3 py-2">
                <div className="font-mono text-[10px] uppercase tracking-wider text-amber-100/55">next action</div>
                <div className="mt-1 text-sm text-white/80">{focused.next_action}</div>
              </div>
            )}
            {focused.evidence && focused.evidence.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {focused.evidence.slice(0, 5).map((item, i) => (
                  <span key={`${item}-${i}`} className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white/45">{item}</span>
                ))}
              </div>
            )}
          </motion.aside>
        )}
      </AnimatePresence>
    </section>
  );
};
