import { useMemo } from "react";
import type { ScheduleBlock } from "@/lib/types";
import { Starfield, DEEP_SPACE_BG, ConstellationHud } from "@/components/app/constellation/Starfield";

interface Node {
  id: string;
  title: string;
  type: string;
  status: string;
  isDecisive?: boolean;
  time: string;
}

interface Link {
  source: string;
  target: string;
  type: string;
}

export interface ScheduleRelationship {
  from: string;
  to: string;
  type: "support" | "constraint" | "protection" | "sequential";
}

interface ConstellationProps {
  blocks: ScheduleBlock[];
  relationships?: ScheduleRelationship[];
  decisiveMoveTitle?: string;
  onNodeClick?: (id: string) => void;
}

const toneFor = (node: Node) => {
  if (node.isDecisive) return "border-amber-200/45 bg-amber-200/10 text-amber-100 shadow-[0_0_28px_-12px_rgba(251,191,36,0.9)]";
  if (node.status === "completed" || node.status === "done") return "border-emerald-300/35 bg-emerald-300/10 text-emerald-100";
  if (node.status === "active") return "border-blue-200/35 bg-blue-200/10 text-blue-100";
  if (node.status === "missed") return "border-red-300/35 bg-red-300/10 text-red-100";
  return "border-white/12 bg-white/[0.045] text-white/75";
};

export function Constellation({
  blocks,
  relationships = [],
  decisiveMoveTitle,
  onNodeClick,
}: ConstellationProps) {
  const data = useMemo(() => {
    const nodes: Node[] = blocks.map((b) => ({
      id: b.id,
      title: b.title,
      type: b.type,
      status: b.status || "upcoming",
      time: `${b.start_time}–${b.end_time}`,
      isDecisive: !!decisiveMoveTitle && b.title === decisiveMoveTitle,
    }));

    const links: Link[] = relationships
      .map((r) => ({ source: r.from, target: r.to, type: r.type }))
      .filter(
        (l) =>
          nodes.find((n) => n.id === l.source) &&
          nodes.find((n) => n.id === l.target),
      );

    for (let i = 0; i < blocks.length - 1; i++) {
      const a = blocks[i];
      const b = blocks[i + 1];
      const aIds = new Set(a.linked_task_ids ?? []);
      const sharesTask = (b.linked_task_ids ?? []).some((id) => aIds.has(id));
      const isAdjacent = a.end_time === b.start_time;
      if (!sharesTask && !isAdjacent) continue;
      if (!links.find((l) => l.source === a.id && l.target === b.id)) {
        links.push({ source: a.id, target: b.id, type: sharesTask ? "support" : "sequential" });
      }
    }
    return { nodes, links };
  }, [blocks, relationships, decisiveMoveTitle]);

  if (blocks.length === 0) return null;

  const doneCount = data.nodes.filter((b) => b.status === "completed" || b.status === "done").length;
  const linkedTargets = new Set(data.links.map((l) => l.target));

  return (
    <div
      className="relative min-h-72 w-full overflow-hidden rounded-2xl border border-white/10"
      style={{ background: DEEP_SPACE_BG }}
    >
      <ConstellationHud
        label="today pathway"
        meta={`${doneCount}/${data.nodes.length} done`}
      />
      <div className="relative w-full p-4">
        <Starfield density={4300} nebulaHue="violet" showShootingStars={false} />
        <div className="relative z-10 grid gap-2">
          {data.nodes.map((node, index) => {
            const canOpen = node.type !== "fixed_commitment" && !!onNodeClick;
            return (
              <button
                key={node.id}
                type="button"
                disabled={!canOpen}
                onClick={() => canOpen && onNodeClick?.(node.id)}
                className={`group relative grid grid-cols-[72px_1fr_auto] items-center gap-3 rounded-xl border px-3 py-3 text-left backdrop-blur transition ${toneFor(node)} ${canOpen ? "hover:border-white/35 hover:bg-white/10" : "cursor-default"}`}
              >
                {index < data.nodes.length - 1 && (
                  <span className="absolute left-[48px] top-[calc(50%+18px)] h-[calc(100%+8px)] w-px bg-gradient-to-b from-blue-200/50 to-transparent" />
                )}
                <span className="relative flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-white/45">
                  <span className={`h-2.5 w-2.5 rounded-full ${node.isDecisive ? "bg-amber-200" : linkedTargets.has(node.id) ? "bg-blue-200/70" : "bg-white/35"}`} />
                  {node.time}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-current">{node.title}</span>
                  <span className="mt-0.5 block text-[11px] uppercase tracking-[0.14em] text-white/35">{node.isDecisive ? "decisive move" : node.type.replace(/_/g, " ")}</span>
                </span>
                <span className="rounded-full border border-white/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-white/45">
                  {node.status === "completed" || node.status === "done" ? "done" : node.status}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
