import { useMemo, useState, useRef, useEffect } from "react";
import { CheckCircle2, Circle, Lock, Zap, AlertTriangle, Sparkles, Target, Calendar, Star } from "lucide-react";
import type { MomentState } from "@/lib/types";
import { computeConstellationNodes, type ConstellationNodeType } from "@/lib/selectors/constellation";
import { ConstellationGraph, type StarNode, type StarEdge, type StarTone } from "@/components/app/constellation/ConstellationGraph";
import { Mote } from "@/components/app/Mote";
import { useIsMobile } from "@/hooks/use-mobile";

interface Props {
  state: MomentState;
}

const TYPE_TONE: Record<ConstellationNodeType, StarTone> = {
  NORTH_STAR: "amber",
  IDENTITY_STAR: "warm",
  TODAY_STAR: "amber",
  WORKSTREAM_STAR: "violet",
  TASK_STAR: "bright",
  PROOF_STAR: "emerald",
  GATE_STAR: "dim",
  FRICTION_STAR: "rose",
  SCHEDULE_STAR: "bright",
};

const NODE_META: Record<ConstellationNodeType, {
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
  tone: string;
  dot: string;
}> = {
  NORTH_STAR:    { label: "north star", Icon: Star,         tone: "border-amber-200/35 bg-amber-200/10 text-amber-100",   dot: "bg-amber-200" },
  IDENTITY_STAR: { label: "identity",   Icon: Target,       tone: "border-white/20 bg-white/[0.06] text-white",            dot: "bg-white/80" },
  TODAY_STAR:    { label: "today",      Icon: Zap,          tone: "border-amber-300/45 bg-amber-300/10 text-amber-100",   dot: "bg-amber-300" },
  WORKSTREAM_STAR:{label: "lane",       Icon: Circle,       tone: "border-violet-200/30 bg-violet-200/10 text-violet-100",dot: "bg-violet-200" },
  TASK_STAR:     { label: "task",       Icon: Circle,       tone: "border-blue-200/25 bg-blue-200/10 text-blue-100",      dot: "bg-blue-200" },
  PROOF_STAR:    { label: "proof",      Icon: CheckCircle2, tone: "border-emerald-200/30 bg-emerald-200/10 text-emerald-100", dot: "bg-emerald-200" },
  GATE_STAR:     { label: "locked",     Icon: Lock,         tone: "border-white/10 bg-white/[0.035] text-white/55",       dot: "bg-white/35" },
  FRICTION_STAR: { label: "signal",     Icon: AlertTriangle,tone: "border-orange-200/30 bg-orange-200/10 text-orange-100",dot: "bg-orange-200" },
  SCHEDULE_STAR: { label: "scheduled",  Icon: Calendar,     tone: "border-sky-200/25 bg-sky-200/10 text-sky-100",         dot: "bg-sky-200" },
};

const ORDER: ConstellationNodeType[] = [
  "NORTH_STAR", "IDENTITY_STAR", "TODAY_STAR",
  "WORKSTREAM_STAR", "TASK_STAR", "SCHEDULE_STAR",
  "PROOF_STAR", "FRICTION_STAR", "GATE_STAR",
];

const compactText = (text?: string, fallback = "No detail logged yet.") => {
  const v = text?.trim() || fallback;
  return v.length > 138 ? `${v.slice(0, 135)}…` : v;
};

export const JourneyConstellation = ({ state }: Props) => {
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(false);
  const constellationRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const nodeCap = isMobile ? 6 : 12;

  const raw = useMemo(() => computeConstellationNodes(state), [
    state.active_goal, state.tasks, state.pursuit_model,
    state.execution_feedback, state.today_state,
    state.schedule_state?.week_plan, state.schedule_state?.week_plan_generated_at,
  ]);

  const { route, counts, starNodes, starEdges } = useMemo(() => {
    const sorted = [...raw].sort((a, b) => {
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

    const stars: StarNode[] = primary.map((n) => ({
      id: n.id,
      title: n.title,
      subtitle: NODE_META[n.type].label,
      tone: TYPE_TONE[n.type],
      isLocked: n.status === "locked",
      isFocus: n.type === "TODAY_STAR" || (n.type === "TASK_STAR" && n.status === "active"),
      panelBody: n.next_action || n.why_it_matters,
      meta: n.subtitle,
    }));

    const edges: StarEdge[] = [];
    for (let i = 0; i < stars.length - 1; i++) {
      edges.push({ from: stars[i].id, to: stars[i + 1].id, kind: "spine" });
    }
    const north = stars.find((s) => s.subtitle === "north star");
    if (north) {
      stars.filter((s) => s.subtitle === "lane").forEach((w) => {
        if (!edges.find((e) => e.from === north.id && e.to === w.id)) {
          edges.push({ from: north.id, to: w.id, kind: "support" });
        }
      });
    }

    return {
      route: primary,
      starNodes: stars,
      starEdges: edges,
      counts: {
        proofs: raw.filter((n) => n.type === "PROOF_STAR").length,
        locked: raw.filter((n) => n.type === "GATE_STAR").length,
        active: raw.filter((n) => n.status === "active").length,
      },
    };
  }, [raw]);

  const nextFocus = useMemo(
    () => route.find((n) => n.type === "TODAY_STAR" || (n.type === "TASK_STAR" && n.status === "active")),
    [route],
  );

  // When a block is clicked, scroll the constellation map into view.
  useEffect(() => {
    if (!focusedId || !constellationRef.current) return;
    constellationRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [focusedId]);

  if (raw.length === 0) {
    return (
      <section className="relative flex min-h-72 flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900 p-8 text-center">
        <Mote size={88} mood="calm" />
        <p className="max-w-xs text-sm text-white/55">Set your goal and I'll start lighting the path with you.</p>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/35">— mote</p>
      </section>
    );
  }


  return (
    <section className="space-y-4">
      {nextFocus && (
        <button
          type="button"
          onClick={() => setFocusedId(nextFocus.id)}
          className="flex w-full items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/5 p-4 text-left transition hover:border-amber-300/50 hover:bg-amber-400/10"
        >
          <Mote size={48} mood="focused" />
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-600 dark:text-amber-300/70">mote · what to move next</div>
            <div className="mt-1 text-sm font-semibold leading-snug text-foreground">{nextFocus.title}</div>
            <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{compactText(nextFocus.next_action || nextFocus.why_it_matters)}</div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {counts.active} active · {counts.proofs} proven · {counts.locked} locked
            </div>
          </div>
        </button>
      )}


      {/* Constellation map — shows where the selected task lives */}
      <div ref={constellationRef}>
        <ConstellationGraph
          nodes={starNodes}
          edges={starEdges}
          hudLabel="constellation map"
          hudMeta={focusedId ? "highlighted star" : "tap a block above"}
          focusedId={focusedId}
          onFocusChange={setFocusedId}
          hideChipNav
          minHeight={360}
        />
      </div>
    </section>
  );
};
