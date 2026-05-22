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
  const svgRef = useRef<SVGSVGElement>(null);

  const data = useMemo(() => {
    const nodes: Node[] = blocks.map((b) => ({
      id: b.id,
      title: b.title,
      type: b.type,
      status: b.status || "upcoming",
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

  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    const glow = defs.append("filter").attr("id", "schedule-star-glow").attr("x", "-100%").attr("y", "-100%").attr("width", "300%").attr("height", "300%");
    glow.append("feGaussianBlur").attr("stdDeviation", "2.5").attr("result", "blur");
    const merge = glow.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    const colorOf = (d: any): string => {
      if (d.isDecisive) return DECISIVE;
      if (d.status === "completed" || d.status === "done") return DONE;
      if (d.status === "active") return ACTIVE;
      if (d.status === "missed") return MISSED;
      return ANCHOR;
    };

    const simulation = d3
      .forceSimulation<Node>(data.nodes)
      .force("link", d3.forceLink<Node, Link>(data.links).id((d) => d.id).distance(90))
      .force("charge", d3.forceManyBody().strength(-230))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(36));

    const g = svg.append("g");

    const link = g.append("g")
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("stroke", (d: any) => linkColor[d.type] ?? linkColor.sequential)
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d: any) => (d.type === "sequential" ? 1 : 1.5))
      .attr("stroke-dasharray", (d: any) => (d.type === "sequential" ? "3 4" : "none"))
      .attr("filter", (d: any) => d.type === "support" ? "url(#schedule-star-glow)" : null);

    const node = g.append("g")
      .selectAll("g")
      .data(data.nodes)
      .join("g")
      .call(
        d3.drag<SVGGElement, Node>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended) as any,
      )
      .on("click", (_e: any, d: Node) => {
        if (onNodeClick && d.type !== "fixed_commitment") onNodeClick(d.id);
      })
      .style("cursor", (d: Node) => (d.type === "fixed_commitment" ? "default" : "pointer"));

    // halo
    node.append("circle")
      .attr("r", (d: any) => (d.isDecisive ? 22 : 14))
      .attr("fill", colorOf)
      .attr("opacity", 0.2)
      .attr("filter", "url(#schedule-star-glow)");

    // core
    node.append("circle")
      .attr("r", (d: any) => (d.isDecisive ? 7 : 4.5))
      .attr("fill", colorOf)
      .attr("filter", "url(#schedule-star-glow)");

    // pulse on decisive
    node.filter((d: any) => d.isDecisive)
      .append("circle")
      .attr("r", 7)
      .attr("fill", "none")
      .attr("stroke", DECISIVE)
      .attr("stroke-opacity", 0.6)
      .style("animation", "schedule-pulse 2.4s ease-in-out infinite");

    node.append("text")
      .text((d: any) => d.title.length > 26 ? d.title.slice(0, 24) + "…" : d.title)
      .attr("x", 14)
      .attr("y", 4)
      .attr("font-size", "10px")
      .attr("font-weight", (d: any) => (d.isDecisive ? "600" : "400"))
      .attr("fill", (d: any) => d.isDecisive ? "rgba(255,225,170,0.95)" : "rgba(255,255,255,0.7)")
      .attr("pointer-events", "none")
      .attr("style", "text-shadow: 0 0 5px rgba(0,0,0,0.9)");

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => { simulation.stop(); };
  }, [data, onNodeClick]);

  if (blocks.length === 0) return null;

  const doneCount = blocks.filter((b) => b.status === "completed").length;

  return (
    <div
      className="relative h-72 w-full overflow-hidden rounded-2xl border border-white/10"
      style={{ background: DEEP_SPACE_BG }}
    >
      <ConstellationHud
        label="schedule constellation"
        meta={`${doneCount}/${blocks.length} lit`}
      />
      <div className="relative h-[calc(100%-37px)] w-full">
        <Starfield density={3200} nebulaHue="violet" showShootingStars={false} />
        <div className="absolute left-3 top-3 z-10 flex items-center gap-3">
          <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full" style={{ background: DECISIVE, boxShadow: `0 0 6px ${DECISIVE}` }} /><span className="text-[9px] uppercase tracking-wider text-white/60">decisive</span></div>
          <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full" style={{ background: DONE, boxShadow: `0 0 6px ${DONE}` }} /><span className="text-[9px] uppercase tracking-wider text-white/60">lit</span></div>
          <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-white/40" /><span className="text-[9px] uppercase tracking-wider text-white/60">anchor</span></div>
        </div>
        <svg ref={svgRef} className="relative z-[1] h-full w-full" />
      </div>
      <style>{`
        @keyframes schedule-pulse {
          0%, 100% { opacity: 0.3; r: 7; }
          50%      { opacity: 0.7; r: 16; }
        }
      `}</style>
    </div>
  );
}
