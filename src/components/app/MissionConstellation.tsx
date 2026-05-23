import { useMemo } from "react";
import type { CompiledPursuitModel } from "@/lib/types";
import type { WorkstreamAnalytics } from "@/lib/selectors/mission-analytics";
import { ConstellationGraph, type StarNode, type StarEdge, type StarTone } from "@/components/app/constellation/ConstellationGraph";
import { Mote } from "@/components/app/Mote";

interface Props {
  model: CompiledPursuitModel;
  analytics: WorkstreamAnalytics[];
  onWorkstreamClick?: (id: string) => void;
}

const priorityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

const healthTone = (health: number): StarTone => {
  if (health >= 70) return "bright";
  if (health >= 45) return "warm";
  return "rose";
};

export function MissionConstellation({ model, analytics, onWorkstreamClick }: Props) {
  const { nodes, edges, intel } = useMemo(() => {
    const analyticsById = new Map(analytics.map((a) => [a.workstream.id, a]));
    const lanes = [...model.workstreams]
      .sort((a, b) => (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9));

    const northId = "__north__";
    const nodes: StarNode[] = [];
    const edges: StarEdge[] = [];

    nodes.push({
      id: northId,
      title: "North Star",
      subtitle: model.summary ? "your mission" : "set your north star",
      tone: "amber",
      isFocus: true,
      panelBody: model.summary || "Define what success looks like to anchor the constellation.",
    });

    const laneNodes = lanes.map((w, i) => {
      const item = analyticsById.get(w.id);
      const health = item?.health ?? (w.status === "complete" ? 100 : w.status === "stalled" ? 25 : 55);
      const label = health >= 70 ? "bright" : health >= 45 ? "needs push" : "blocked";
      const node: StarNode = {
        id: w.id,
        title: w.name,
        subtitle: `${w.priority} · ${label}`,
        meta: `${health}`,
        tone: healthTone(health),
        panelBody:
          w.bottleneck
            ? `Bottleneck: ${w.bottleneck}`
            : w.next_proof
              ? `Next proof: ${w.next_proof}`
              : w.description || "No pathway detail yet.",
      };
      return node;
    });

    nodes.push(...laneNodes);
    laneNodes.forEach((n) => edges.push({ from: northId, to: n.id, kind: "spine" }));

    // Capability signal stars (support edges to first lane that mentions them, else north)
    model.capability_clusters.slice(0, 3).forEach((c) => {
      const id = `cap-${c.id}`;
      nodes.push({
        id,
        title: c.name,
        subtitle: `capability · ${c.status}`,
        tone: "violet",
        panelBody: c.why_it_matters || c.description || `Capability status: ${c.status}.`,
      });
      const anchor = laneNodes[0]?.id ?? northId;
      edges.push({ from: anchor, to: id, kind: "support" });
    });

    const blocked = laneNodes.filter((n) => n.tone === "rose").length;
    const bright = laneNodes.filter((n) => n.tone === "bright").length;
    const focus =
      lanes.find((w) => w.bottleneck)?.bottleneck ||
      lanes.find((w) => w.next_proof)?.next_proof ||
      model.summary ||
      "Choose the next proof to light the route.";

    return {
      nodes,
      edges,
      intel: { bright, blocked, lanes: laneNodes.length, focus },
    };
  }, [model, analytics]);

  if (nodes.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-xl border border-amber-200/25 bg-amber-200/[0.06] px-4 py-3">
        <Mote size={44} mood="focused" />
        <div className="min-w-0">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-100/70">mote says · next intelligent move</div>
          <div className="mt-1 text-sm font-semibold leading-snug text-white">{intel.focus}</div>
        </div>
      </div>
      <ConstellationGraph
        nodes={nodes}
        edges={edges}
        hudLabel="mission constellation"
        hudMeta={`${intel.bright} bright · ${intel.blocked} blocked · ${intel.lanes} lanes`}
        onNodeClick={(id) => id.startsWith("cap-") || id === "__north__" ? undefined : onWorkstreamClick?.(id)}
        nebulaHue="indigo"
        minHeight={380}
      />
    </div>
  );
}
