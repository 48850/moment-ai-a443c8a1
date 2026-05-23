import { useMemo } from "react";
import type { ScheduleBlock } from "@/lib/types";
import { ConstellationGraph, type StarNode, type StarEdge, type StarTone } from "@/components/app/constellation/ConstellationGraph";

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

const toneFor = (b: ScheduleBlock, isDecisive: boolean): StarTone => {
  if (isDecisive) return "amber";
  if (b.status === "completed" || b.status === "done") return "emerald";
  if (b.status === "active") return "bright";
  if (b.status === "missed") return "rose";
  if (b.type === "fixed_commitment") return "violet";
  return "dim";
};

export function Constellation({
  blocks,
  relationships = [],
  decisiveMoveTitle,
  onNodeClick,
}: ConstellationProps) {
  const { nodes, edges } = useMemo(() => {
    const nodes: StarNode[] = blocks.map((b) => {
      const isDecisive = !!decisiveMoveTitle && b.title === decisiveMoveTitle;
      const statusLabel =
        b.status === "completed" || b.status === "done" ? "done"
        : b.status === "active" ? "now"
        : b.status === "missed" ? "missed"
        : (b.status || "next");
      return {
        id: b.id,
        title: b.title,
        subtitle: isDecisive ? "decisive move" : b.type.replace(/_/g, " "),
        meta: `${b.start_time}–${b.end_time}`,
        detail: `${b.start_time}–${b.end_time} · ${statusLabel}`,
        panelBody: isDecisive
          ? "Your decisive move for today. Protect this window."
          : `Scheduled ${b.start_time}–${b.end_time}.`,
        tone: toneFor(b, isDecisive),
        isFocus: isDecisive || b.status === "active",
        isLocked: b.type === "fixed_commitment",
      };
    });

    const edges: StarEdge[] = [];
    const ids = new Set(nodes.map((n) => n.id));
    for (let i = 0; i < blocks.length - 1; i++) {
      edges.push({ from: blocks[i].id, to: blocks[i + 1].id, kind: "spine" });
    }
    for (const r of relationships) {
      if (!ids.has(r.from) || !ids.has(r.to)) continue;
      if (edges.find((e) => e.from === r.from && e.to === r.to)) continue;
      edges.push({ from: r.from, to: r.to, kind: "support" });
    }
    return { nodes, edges };
  }, [blocks, relationships, decisiveMoveTitle]);

  if (blocks.length === 0) return null;

  const done = nodes.filter((n) => n.tone === "emerald").length;

  return (
    <ConstellationGraph
      nodes={nodes}
      edges={edges}
      hudLabel="today constellation"
      hudMeta={`${done}/${nodes.length} done`}
      onNodeClick={onNodeClick}
      nebulaHue="indigo"
      minHeight={300}
    />
  );
}
