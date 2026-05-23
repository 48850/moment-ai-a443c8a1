import { useMemo } from "react";
import type { MomentState } from "@/lib/types";
import { computeConstellationNodes, type ConstellationNodeType } from "@/lib/selectors/constellation";
import { ConstellationGraph, type StarNode, type StarEdge, type StarTone } from "@/components/app/constellation/ConstellationGraph";

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

const TYPE_LABEL: Record<ConstellationNodeType, string> = {
  NORTH_STAR: "north star",
  IDENTITY_STAR: "identity",
  TODAY_STAR: "today",
  WORKSTREAM_STAR: "lane",
  TASK_STAR: "task",
  PROOF_STAR: "proof",
  GATE_STAR: "locked",
  FRICTION_STAR: "signal",
  SCHEDULE_STAR: "scheduled",
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

export const JourneyConstellation = ({ state }: Props) => {
  const raw = useMemo(() => computeConstellationNodes(state), [
    state.active_goal, state.tasks, state.pursuit_model,
    state.execution_feedback, state.today_state,
    state.schedule_state?.week_plan, state.schedule_state?.week_plan_generated_at,
  ]);

  const { nodes, edges, counts } = useMemo(() => {
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
    }).slice(0, 11);

    const starNodes: StarNode[] = primary.map((n) => ({
      id: n.id,
      title: n.title,
      subtitle: TYPE_LABEL[n.type],
      tone: TYPE_TONE[n.type],
      isLocked: n.status === "locked",
      isFocus: n.type === "TODAY_STAR" || (n.type === "TASK_STAR" && n.status === "active"),
      panelBody: n.next_action || n.why_it_matters,
      meta: n.subtitle,
    }));

    const edges: StarEdge[] = [];
    // Spine in display order
    for (let i = 0; i < starNodes.length - 1; i++) {
      edges.push({ from: starNodes[i].id, to: starNodes[i + 1].id, kind: "spine" });
    }
    // Cross-link North Star to every workstream as support arcs
    const north = starNodes.find((n) => n.subtitle === "north star");
    if (north) {
      starNodes.filter((n) => n.subtitle === "lane").forEach((w) => {
        if (!edges.find((e) => e.from === north.id && e.to === w.id)) {
          edges.push({ from: north.id, to: w.id, kind: "support" });
        }
      });
    }

    return {
      nodes: starNodes,
      edges,
      counts: {
        proofs: raw.filter((n) => n.type === "PROOF_STAR").length,
        locked: raw.filter((n) => n.type === "GATE_STAR").length,
        active: raw.filter((n) => n.status === "active").length,
      },
    };
  }, [raw]);

  return (
    <ConstellationGraph
      nodes={nodes}
      edges={edges}
      hudLabel="journey constellation"
      hudMeta={`${counts.active} active · ${counts.proofs} proven · ${counts.locked} locked`}
      emptyHint="Once you set your goal, Moment will map the pathway here."
      nebulaHue="indigo"
      minHeight={420}
    />
  );
};
