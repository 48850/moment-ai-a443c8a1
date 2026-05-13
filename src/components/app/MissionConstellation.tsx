import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { CompiledPursuitModel } from "@/lib/types";
import type { WorkstreamAnalytics } from "@/lib/selectors/mission-analytics";

interface Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  kind: "goal" | "workstream" | "capability" | "signal";
  health?: number; // 0-100
  status?: string;
  meta?: string;
}

interface Link extends d3.SimulationLinkDatum<Node> {
  kind: "supports" | "evidences" | "anchors";
  weight: number;
}

interface Props {
  model: CompiledPursuitModel;
  analytics: WorkstreamAnalytics[];
  onWorkstreamClick?: (id: string) => void;
}

/**
 * Mission Constellation — same force-directed visual language as Plan's
 * constellation map. Nodes = goal core, workstreams (sized by health),
 * capabilities, signals. Links carry the relationship semantics.
 */
export function MissionConstellation({ model, analytics, onWorkstreamClick }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hovered, setHovered] = useState<Node | null>(null);

  const data = useMemo(() => {
    const nodes: Node[] = [];
    const links: Link[] = [];

    nodes.push({ id: "__goal", label: "GOAL", kind: "goal" });

    const wsById = new Map<string, WorkstreamAnalytics>();
    analytics.forEach((a) => wsById.set(a.workstream.id, a));

    for (const ws of model.workstreams) {
      const a = wsById.get(ws.id);
      nodes.push({
        id: ws.id,
        label: ws.name,
        kind: "workstream",
        health: a?.health ?? 50,
        status: ws.status,
        meta: a ? `${a.tasks.done}/${a.tasks.total} · ${a.headline}` : undefined,
      });
      links.push({ source: "__goal", target: ws.id, kind: "anchors", weight: 1 });
    }

    for (const cap of model.capability_clusters) {
      nodes.push({ id: cap.id, label: cap.name, kind: "capability", status: cap.status });
      // attach to two nearest workstreams by name token overlap
      const capTokens = new Set(cap.name.toLowerCase().split(/\W+/).filter((x) => x.length > 3));
      const scored = model.workstreams.map((w) => {
        const wt = w.name.toLowerCase().split(/\W+/);
        const overlap = wt.filter((t) => capTokens.has(t)).length;
        return { id: w.id, overlap };
      }).sort((a, b) => b.overlap - a.overlap);
      const targets = scored.slice(0, Math.min(2, scored.length));
      for (const t of targets) {
        links.push({ source: cap.id, target: t.id, kind: "supports", weight: 0.5 });
      }
    }

    for (const sig of model.evidence_signals) {
      nodes.push({ id: sig.id, label: sig.name, kind: "signal", meta: sig.last_value });
      // attach to first workstream containing a token
      const sigTokens = sig.name.toLowerCase().split(/\W+/).filter((x) => x.length > 3);
      const w = model.workstreams.find((ws) => {
        const wt = ws.name.toLowerCase();
        return sigTokens.some((t) => wt.includes(t));
      });
      if (w) links.push({ source: sig.id, target: w.id, kind: "evidences", weight: 0.4 });
    }

    return { nodes, links };
  }, [model, analytics]);

  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const css = getComputedStyle(svgRef.current);
    const tok = (n: string) => `hsl(${css.getPropertyValue(n).trim()})`;
    const primary = tok("--primary");
    const border = tok("--border");
    const muted = tok("--muted-foreground");
    const card = tok("--card");
    const fg = tok("--foreground");

    const healthColor = (h: number) =>
      h >= 70 ? primary : h >= 45 ? "hsl(38 92% 60%)" : "hsl(0 72% 60%)";

    const linkColor: Record<Link["kind"], string> = {
      anchors: primary,
      supports: border,
      evidences: muted,
    };

    const sim = d3
      .forceSimulation<Node>(data.nodes)
      .force("link", d3.forceLink<Node, Link>(data.links).id((d) => d.id)
        .distance((l) => l.kind === "anchors" ? 110 : 70).strength((l) => l.weight))
      .force("charge", d3.forceManyBody().strength((d: any) => d.kind === "goal" ? -600 : -180))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d: any) =>
        d.kind === "goal" ? 32 : d.kind === "workstream" ? 22 : 14));

    // pin goal to center
    const goalNode = data.nodes.find((n) => n.kind === "goal");
    if (goalNode) { goalNode.fx = width / 2; goalNode.fy = height / 2; }

    const g = svg.append("g");

    const link = g.append("g")
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("stroke", (d) => linkColor[d.kind])
      .attr("stroke-opacity", (d) => d.kind === "anchors" ? 0.5 : 0.25)
      .attr("stroke-width", (d) => d.kind === "anchors" ? 1.5 : 1)
      .attr("stroke-dasharray", (d) => d.kind === "supports" ? "3 3" : "none");

    const node = g.append("g")
      .selectAll("g")
      .data(data.nodes)
      .join("g")
      .style("cursor", (d) => d.kind === "workstream" ? "pointer" : "default")
      .on("mouseenter", (_e, d) => setHovered(d))
      .on("mouseleave", () => setHovered(null))
      .on("click", (_e, d) => { if (d.kind === "workstream" && onWorkstreamClick) onWorkstreamClick(d.id); })
      .call(d3.drag<SVGGElement, Node>()
        .on("start", (event) => { if (!event.active) sim.alphaTarget(0.3).restart(); event.subject.fx = event.subject.x; event.subject.fy = event.subject.y; })
        .on("drag", (event) => { event.subject.fx = event.x; event.subject.fy = event.y; })
        .on("end", (event) => { if (!event.active) sim.alphaTarget(0); if (event.subject.kind !== "goal") { event.subject.fx = null; event.subject.fy = null; } }) as any);

    // glow ring for workstreams
    node.filter((d) => d.kind === "workstream")
      .append("circle")
      .attr("r", (d) => 14 + ((d.health ?? 0) / 100) * 8)
      .attr("fill", "none")
      .attr("stroke", (d) => healthColor(d.health ?? 0))
      .attr("stroke-opacity", 0.18)
      .attr("stroke-width", 8);

    node.append("circle")
      .attr("r", (d) => d.kind === "goal" ? 22 : d.kind === "workstream" ? 10 + ((d.health ?? 0) / 100) * 5 : d.kind === "capability" ? 5 : 4)
      .attr("fill", (d) => {
        if (d.kind === "goal") return primary;
        if (d.kind === "workstream") return healthColor(d.health ?? 0);
        return card;
      })
      .attr("stroke", (d) => d.kind === "workstream" ? "hsl(var(--background))" : border)
      .attr("stroke-width", (d) => d.kind === "workstream" ? 2 : 1);

    node.filter((d) => d.kind === "goal")
      .append("text")
      .text("GOAL")
      .attr("text-anchor", "middle")
      .attr("dy", 4)
      .attr("font-size", "10px")
      .attr("font-weight", "700")
      .attr("letter-spacing", "1.5")
      .attr("fill", "hsl(var(--primary-foreground))");

    node.filter((d) => d.kind !== "goal")
      .append("text")
      .text((d) => d.label.length > 22 ? d.label.slice(0, 20) + "…" : d.label)
      .attr("x", (d) => d.kind === "workstream" ? 18 : 10)
      .attr("y", 4)
      .attr("font-size", (d) => d.kind === "workstream" ? "11px" : "9px")
      .attr("font-weight", (d) => d.kind === "workstream" ? "600" : "400")
      .attr("fill", (d) => d.kind === "workstream" ? fg : muted)
      .attr("pointer-events", "none");

    sim.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => { sim.stop(); };
  }, [data, onWorkstreamClick]);

  if (data.nodes.length <= 1) return null;

  return (
    <div className="relative h-[420px] w-full overflow-hidden rounded-2xl border border-border bg-card/50">
      <div className="absolute left-3 top-3 z-10 flex flex-col gap-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          mission constellation
        </span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-primary" /><span className="text-[9px] text-muted-foreground">healthy</span></div>
          <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full" style={{ background: "hsl(38 92% 60%)" }} /><span className="text-[9px] text-muted-foreground">slipping</span></div>
          <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full" style={{ background: "hsl(0 72% 60%)" }} /><span className="text-[9px] text-muted-foreground">stalled</span></div>
        </div>
      </div>
      {hovered && hovered.kind === "workstream" && (
        <div className="absolute right-3 top-3 z-10 max-w-[55%] rounded-xl border border-border bg-background/90 p-2.5 backdrop-blur">
          <div className="text-xs font-semibold">{hovered.label}</div>
          {hovered.meta && <div className="mt-0.5 text-[11px] text-muted-foreground">{hovered.meta}</div>}
          {typeof hovered.health === "number" && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
                <div className="h-full rounded-full bg-primary" style={{ width: `${hovered.health}%` }} />
              </div>
              <span className="font-mono text-[10px] text-muted-foreground">{hovered.health}</span>
            </div>
          )}
        </div>
      )}
      <svg ref={svgRef} className="h-full w-full" />
    </div>
  );
}
