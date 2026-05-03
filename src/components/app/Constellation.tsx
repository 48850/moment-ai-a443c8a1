import { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import type { ScheduleBlock } from "@/lib/types";

interface Node extends d3.SimulationNodeDatum {
  id: string;
  title: string;
  type: string;
  status: string;
  isDecisive?: boolean;
}

interface Link extends d3.SimulationLinkDatum<Node> {
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

/**
 * Force-directed constellation map of schedule blocks.
 * Themed with semantic tokens; colors resolved via CSS variables.
 */
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

    for (let i = 0; i < nodes.length - 1; i++) {
      const from = nodes[i].id;
      const to = nodes[i + 1].id;
      if (!links.find((l) => l.source === from && l.target === to)) {
        links.push({ source: from, target: to, type: "sequential" });
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

    // Resolve semantic tokens at runtime so theme switches apply.
    const css = getComputedStyle(svgRef.current);
    const tok = (name: string) => `hsl(${css.getPropertyValue(name).trim()})`;
    const primary = tok("--primary");
    const border = tok("--border");
    const muted = tok("--muted-foreground");
    const card = tok("--card");
    const accent = tok("--accent");
    const destructive = tok("--destructive");

    const colorByLink: Record<string, string> = {
      support: primary,
      constraint: destructive,
      protection: accent,
      sequential: border,
    };

    const simulation = d3
      .forceSimulation<Node>(data.nodes)
      .force("link", d3.forceLink<Node, Link>(data.links).id((d) => d.id).distance(80))
      .force("charge", d3.forceManyBody().strength(-200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius(40));

    const g = svg.append("g");

    const link = g
      .append("g")
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("stroke", (d: any) => colorByLink[d.type] ?? border)
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d: any) => (d.type === "sequential" ? 1 : 2))
      .attr("stroke-dasharray", (d: any) => (d.type === "sequential" ? "4 2" : "none"));

    const node = g
      .append("g")
      .selectAll("g")
      .data(data.nodes)
      .join("g")
      .call(
        d3
          .drag<SVGGElement, Node>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended) as any,
      )
      .on("click", (_e: any, d: Node) => {
        if (onNodeClick && d.type !== "fixed_commitment") onNodeClick(d.id);
      })
      .style("cursor", (d: Node) => (d.type === "fixed_commitment" ? "default" : "pointer"));

    node
      .append("circle")
      .attr("r", (d: any) => (d.isDecisive ? 12 : 8))
      .attr("fill", (d: any) => {
        if (d.isDecisive) return primary;
        if (d.type === "fixed_commitment" || d.type === "commute" || d.type === "wind_down") return muted;
        return card;
      })
      .attr("stroke", (d: any) => {
        if (d.status === "completed" || d.status === "done") return primary;
        if (d.status === "active") return accent;
        if (d.status === "missed") return destructive;
        return border;
      })
      .attr("stroke-width", 2);

    node
      .append("text")
      .text((d: any) => d.title)
      .attr("x", 14)
      .attr("y", 4)
      .attr("font-size", "10px")
      .attr("font-weight", (d: any) => (d.isDecisive ? "600" : "400"))
      .attr("fill", muted)
      .attr("pointer-events", "none");

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

    return () => {
      simulation.stop();
    };
  }, [data, onNodeClick]);

  if (blocks.length === 0) return null;

  return (
    <div className="relative h-64 w-full overflow-hidden rounded-2xl border border-border bg-card/50">
      <div className="absolute left-3 top-3 flex flex-col gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Constellation map
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-[9px] text-muted-foreground">Decisive</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-muted-foreground" />
            <span className="text-[9px] text-muted-foreground">Anchor</span>
          </div>
        </div>
      </div>
      <svg ref={svgRef} className="h-full w-full" />
    </div>
  );
}
