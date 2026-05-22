import { useMemo } from "react";
import type { CompiledPursuitModel } from "@/lib/types";
import type { WorkstreamAnalytics } from "@/lib/selectors/mission-analytics";
import { Starfield, DEEP_SPACE_BG, ConstellationHud } from "@/components/app/constellation/Starfield";

interface Props {
  model: CompiledPursuitModel;
  analytics: WorkstreamAnalytics[];
  onWorkstreamClick?: (id: string) => void;
}

const healthTone = (health: number) => {
  if (health >= 70) return {
    dot: "bg-blue-100",
    border: "border-blue-200/35",
    fill: "bg-blue-200",
    label: "bright",
  };
  if (health >= 45) return {
    dot: "bg-amber-200",
    border: "border-amber-200/35",
    fill: "bg-amber-200",
    label: "needs push",
  };
  return {
    dot: "bg-red-300",
    border: "border-red-300/35",
    fill: "bg-red-300",
    label: "blocked",
  };
};

const priorityRank: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

export function MissionConstellation({ model, analytics, onWorkstreamClick }: Props) {
  const rows = useMemo(() => {
    const analyticsById = new Map(analytics.map((a) => [a.workstream.id, a]));
    return [...model.workstreams]
      .sort((a, b) => (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9))
      .map((workstream, index) => {
        const item = analyticsById.get(workstream.id);
        const health = item?.health ?? (workstream.status === "complete" ? 100 : workstream.status === "stalled" ? 25 : 55);
        return {
          index,
          workstream,
          health,
          analytics: item,
          tone: healthTone(health),
        };
      });
  }, [analytics, model.workstreams]);

  const intel = useMemo(() => {
    const firstBlocked = rows.find((r) => r.health < 45 || r.workstream.bottleneck)?.workstream;
    const next = rows.find((r) => r.workstream.next_proof)?.workstream;
    return {
      bright: rows.filter((r) => r.health >= 70).length,
      blocked: rows.filter((r) => r.health < 45).length,
      focus: firstBlocked?.bottleneck || next?.next_proof || model.summary || "Choose the next proof to light the route.",
    };
  }, [model.summary, rows]);

  if (rows.length === 0) return null;

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-white/10 shadow-[0_0_40px_-10px_rgba(99,102,241,0.4)]"
      style={{ background: DEEP_SPACE_BG }}
    >
      <ConstellationHud
        label="mission pathway"
        meta={`${intel.bright} bright · ${intel.blocked} blocked · ${rows.length} lanes`}
      />
      <div className="relative p-4 sm:p-5">
        <Starfield density={4300} nebulaHue="indigo" showShootingStars={false} />

        <div className="relative z-10 mb-4 rounded-xl border border-amber-200/20 bg-amber-200/[0.06] p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-amber-100/60">next intelligent move</div>
          <div className="mt-1 text-sm font-semibold leading-snug text-white">{intel.focus}</div>
        </div>

        <div className="relative z-10 grid gap-3">
          {rows.map(({ workstream, health, analytics: item, tone }, index) => {
            const canOpen = !!onWorkstreamClick;
            return (
              <button
                key={workstream.id}
                type="button"
                onClick={() => canOpen && onWorkstreamClick?.(workstream.id)}
                className={`group relative grid gap-3 rounded-xl border ${tone.border} bg-white/[0.045] p-4 text-left backdrop-blur transition ${canOpen ? "hover:border-white/35 hover:bg-white/[0.075]" : "cursor-default"}`}
              >
                {index < rows.length - 1 && (
                  <span className="absolute left-6 top-[calc(100%-2px)] h-5 w-px bg-gradient-to-b from-blue-200/45 to-transparent" />
                )}
                <div className="flex items-start gap-3">
                  <div className="mt-1 flex flex-col items-center gap-1.5">
                    <span className={`h-3 w-3 rounded-full ${tone.dot} shadow-[0_0_16px_currentColor]`} />
                    <span className="font-mono text-[9px] text-white/35">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-white">{workstream.name}</h3>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/45">
                        {workstream.priority}
                      </span>
                      <span className="rounded-full border border-white/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-white/45">
                        {tone.label}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-white/55">
                      {workstream.description || workstream.bottleneck || workstream.next_proof || "No pathway detail yet."}
                    </p>
                  </div>
                  <div className="w-16 text-right font-mono text-xs text-white/55">{health}</div>
                </div>

                <div className="ml-8 grid gap-2 sm:grid-cols-[1fr_1fr]">
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">next proof</div>
                    <div className="mt-1 text-xs text-white/70">{workstream.next_proof || item?.headline || "Define the proof that shows progress."}</div>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                    <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-white/35">bottleneck</div>
                    <div className="mt-1 text-xs text-white/70">{workstream.bottleneck || "No blocker logged."}</div>
                  </div>
                </div>

                <div className="ml-8 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div className={`h-full rounded-full ${tone.fill}`} style={{ width: `${Math.max(8, Math.min(100, health))}%` }} />
                </div>
              </button>
            );
          })}
        </div>

        {(model.capability_clusters.length > 0 || model.evidence_signals.length > 0) && (
          <div className="relative z-10 mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">capabilities</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {model.capability_clusters.slice(0, 6).map((c) => (
                  <span key={c.id} className="rounded-full border border-violet-200/20 bg-violet-200/10 px-2.5 py-1 text-[11px] text-violet-100/75">
                    {c.name} · {c.status}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/40">signals</div>
              <div className="mt-3 grid gap-2">
                {model.evidence_signals.slice(0, 3).map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 text-xs text-white/60">
                    <span className="truncate">{s.name}</span>
                    <span className="shrink-0 font-mono text-white/35">{s.last_value || s.cadence || s.kind}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
