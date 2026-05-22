import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { CompiledPursuitModel } from "@/lib/types";
import type { WorkstreamAnalytics } from "@/lib/selectors/mission-analytics";
import { Starfield, DEEP_SPACE_BG, ConstellationHud } from "@/components/app/constellation/Starfield";

interface Node extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  kind: "goal" | "workstream" | "capability" | "signal";
  health?: number;
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

/* Deep-space themed colors */
const HEALTHY_COLOR  = "rgb(180,210,255)"; // blue-white star
const SLIPPING_COLOR = "rgb(251,191,36)";  // amber
const STALLED_COLOR  = "rgb(248,113,113)"; // red
const GOAL_COLOR     = "rgb(255,225,170)"; // warm north-star
const CAP_COLOR      = "rgb(167,139,250)"; // violet
const SIG_COLOR      = "rgb(110,231,183)"; // green
const LINK_COLOR     = "rgba(163,201,255,0.5)";

const healthColor = (h: number) =>
  h >= 70 ? HEALTHY_COLOR : h >= 45 ? SLIPPING_COLOR : STALLED_COLOR;

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
      const sigTokens = sig.name.toLowerCase().split(/\W+/).filter((x) => x.length > 3);
      const w = model.workstreams.find((ws) => {
        const wt = ws.name.toLowerCase();
        return sigTokens.some((t) => wt.includes(t));
      });
      if (w) links.push({ source: sig.id, target: w.id, kind: "evidences", weight: 0.4 });
    }

    return { nodes, links };
  }, [model, analytics]);

  // Quick intelligence summary for HUD
  const intel = useMemo(() => {
    const healthy = analytics.filter((a) => a.health >= 70).length;
    const stalled = analytics.filter((a) => a.health < 45).length;
    return { total: analytics.length, healthy, stalled };
  }, [analytics]);

  useEffect(() => {
    if (!svgRef.current || data.nodes.length === 0) return;
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // SVG defs: glow filter + gradient for pathway lines
    const defs = svg.append("defs");
    const glow = defs.append("filter").attr("id", "star-glow").attr("x", "-100%").attr("y", "-100%").attr("width", "300%").attr("height", "300%");
    glow.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "blur");
    const merge = glow.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");

    const sim = d3
      .forceSimulation<Node>(data.nodes)
      .force("link", d3.forceLink<Node, Link>(data.links).id((d) => d.id)
        .distance((l) => l.kind === "anchors" ? 120 : 75).strength((l) => l.weight))
      .force("charge", d3.forceManyBody().strength((d: any) => d.kind === "goal" ? -700 : -200))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d: any) =>
        d.kind === "goal" ? 36 : d.kind === "workstream" ? 24 : 14));

    const goalNode = data.nodes.find((n) => n.kind === "goal");
    if (goalNode) { goalNode.fx = width / 2; goalNode.fy = height / 2; }

    const g = svg.append("g");

    // Pathway links — bright trails from goal to workstreams, faint dashes elsewhere
    const link = g.append("g")
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("stroke", (d) => d.kind === "anchors" ? LINK_COLOR : "rgba(255,255,255,0.18)")
      .attr("stroke-opacity", (d) => d.kind === "anchors" ? 0.7 : 0.35)
      .attr("stroke-width", (d) => d.kind === "anchors" ? 1.5 : 0.8)
      .attr("stroke-dasharray", (d) => d.kind === "anchors" ? "none" : "2 4")
      .attr("filter", (d) => d.kind === "anchors" ? "url(#star-glow)" : null);

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

    // Outer glow halo
    node.append("circle")
      .attr("r", (d) => d.kind === "goal" ? 32 : d.kind === "workstream" ? 18 + ((d.health ?? 0) / 100) * 8 : d.kind === "capability" ? 10 : 8)
      .attr("fill", (d) => {
        if (d.kind === "goal") return GOAL_COLOR;
        if (d.kind === "workstream") return healthColor(d.health ?? 0);
        if (d.kind === "capability") return CAP_COLOR;
        return SIG_COLOR;
      })
      .attr("opacity", 0.18)
      .attr("filter", "url(#star-glow)");

    // Core star
    node.append("circle")
      .attr("r", (d) => d.kind === "goal" ? 10 : d.kind === "workstream" ? 5 + ((d.health ?? 0) / 100) * 3 : d.kind === "capability" ? 3.5 : 3)
      .attr("fill", (d) => {
        if (d.kind === "goal") return GOAL_COLOR;
        if (d.kind === "workstream") return healthColor(d.health ?? 0);
        if (d.kind === "capability") return CAP_COLOR;
        return SIG_COLOR;
      })
      .attr("filter", "url(#star-glow)");

    // Twinkle pulse for goal + workstreams
    node.filter((d) => d.kind === "goal" || d.kind === "workstream")
      .append("circle")
      .attr("r", (d) => d.kind === "goal" ? 10 : 5)
      .attr("fill", "none")
      .attr("stroke", (d) => d.kind === "goal" ? GOAL_COLOR : healthColor(d.health ?? 0))
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", 1)
      .style("animation", "constellation-pulse 2.6s ease-in-out infinite");

    // Goal label
    node.filter((d) => d.kind === "goal")
      .append("text")
      .text("NORTH STAR")
      .attr("text-anchor", "middle")
      .attr("dy", -22)
      .attr("font-size", "9px")
      .attr("font-weight", "600")
      .attr("letter-spacing", "2")
      .attr("fill", "rgba(255,225,170,0.9)");

    // Other labels
    node.filter((d) => d.kind !== "goal")
      .append("text")
      .text((d) => d.label.length > 24 ? d.label.slice(0, 22) + "…" : d.label)
      .attr("x", (d) => d.kind === "workstream" ? 16 : 10)
      .attr("y", 4)
      .attr("font-size", (d) => d.kind === "workstream" ? "11px" : "9.5px")
      .attr("font-weight", (d) => d.kind === "workstream" ? "600" : "400")
      .attr("fill", (d) => d.kind === "workstream" ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.55)")
      .attr("pointer-events", "none")
      .attr("style", "text-shadow: 0 0 6px rgba(0,0,0,0.9)");

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
    <div
      className="relative h-[440px] w-full overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_40px_-10px_rgba(99,102,241,0.4)]"
      style={{ background: DEEP_SPACE_BG }}
    >
      <ConstellationHud
        label="mission constellation"
        meta={`${intel.healthy} bright · ${intel.stalled} dim · ${intel.total} lanes`}
      />
      <div className="relative h-[calc(100%-37px)] w-full">
        <Starfield density={2800} nebulaHue="indigo" />
        {/* Legend */}
        <div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full" style={{ background: HEALTHY_COLOR, boxShadow: `0 0 6px ${HEALTHY_COLOR}` }} /><span className="text-[9px] uppercase tracking-wider text-white/60">healthy</span></div>
            <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full" style={{ background: SLIPPING_COLOR, boxShadow: `0 0 6px ${SLIPPING_COLOR}` }} /><span className="text-[9px] uppercase tracking-wider text-white/60">slipping</span></div>
            <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full" style={{ background: STALLED_COLOR, boxShadow: `0 0 6px ${STALLED_COLOR}` }} /><span className="text-[9px] uppercase tracking-wider text-white/60">dim</span></div>
          </div>
        </div>
        {hovered && hovered.kind === "workstream" && (
          <div className="absolute right-3 top-3 z-10 max-w-[55%] rounded-xl border border-white/10 bg-black/70 p-2.5 backdrop-blur">
            <div className="text-xs font-semibold text-white">{hovered.label}</div>
            {hovered.meta && <div className="mt-0.5 text-[11px] text-white/60">{hovered.meta}</div>}
            {typeof hovered.health === "number" && (
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full rounded-full" style={{ width: `${hovered.health}%`, background: healthColor(hovered.health) }} />
                </div>
                <span className="font-mono text-[10px] text-white/60">{hovered.health}</span>
              </div>
            )}
          </div>
        )}
        <svg ref={svgRef} className="relative z-[1] h-full w-full" />
      </div>
      {/* keyframes */}
      <style>{`
        @keyframes constellation-pulse {
          0%, 100% { opacity: 0.25; transform: scale(1); transform-box: fill-box; transform-origin: center; }
          50%      { opacity: 0.7;  transform: scale(2.2); transform-box: fill-box; transform-origin: center; }
        }
      `}</style>
    </div>
  );
}
