import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { selectMissionViewModel } from "@/lib/selectors/mission";
import { RelationshipGraph } from "@/components/app/RelationshipGraph";
import type { CapabilityCluster, EvidenceSignal, PursuitWorkstream } from "@/lib/types";
import { FeedbackChips } from "@/components/app/FeedbackChips";
import { PatternBanner } from "@/components/app/PatternBanner";

const wsStatus: Record<PursuitWorkstream["status"], string> = {
  on_track: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  slipping: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  stalled: "bg-red-500/15 text-red-400 border-red-500/30",
  complete: "bg-secondary text-muted-foreground border-border",
  not_started: "bg-secondary text-muted-foreground border-border",
};

const ccStatus: Record<CapabilityCluster["status"], string> = {
  mastered: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  solid: "bg-primary/15 text-primary border-primary/30",
  developing: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  emerging: "bg-secondary text-muted-foreground border-border",
  not_started: "bg-secondary/50 text-muted-foreground border-border",
};

const sigStyle = (kind: EvidenceSignal["kind"]) =>
  kind === "leading" ? "border-primary/40 text-primary" : "border-border text-muted-foreground";

const Mission = () => {
  const state = useStateStore((s) => s.state);
  const [open, setOpen] = useState<string | null>(null);

  if (!state) return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;
  const m = selectMissionViewModel(state);

  if (!m.hasModel) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="text-xs text-muted-foreground">/ mission</div>
          <h1 className="mt-1 text-xl font-semibold leading-snug">No goal set yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Tell Moment what you're chasing in chat. We'll map it out together.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="rounded-2xl border border-border bg-card p-5">
        <div className="text-xs text-muted-foreground">/ mission</div>
        <h1 className="mt-1 text-xl font-semibold leading-snug">{m.goal.statement}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {m.activeOperatingMode && (
            <span className="rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
              mode · {m.activeOperatingMode.name}
            </span>
          )}
        </div>
      </section>

      <PatternBanner />

      {state.pursuit_model && <RelationshipGraph model={state.pursuit_model} />}

      {m.workstreams.length > 0 && (
        <section>
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Workstreams
          </div>
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {m.workstreams.map((w) => {
              const isOpen = open === w.id;
              return (
                <li key={w.id} className="border-b border-border last:border-b-0">
                  <button
                    onClick={() => setOpen(isOpen ? null : w.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-secondary/40"
                  >
                    <ChevronDown
                      className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${
                        isOpen ? "rotate-0" : "-rotate-90"
                      }`}
                    />
                    <span className="flex-1 text-sm">{w.name}</span>
                    {w.bottleneck && (
                      <span className="hidden text-xs text-amber-400 sm:block">{w.bottleneck}</span>
                    )}
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] lowercase ${wsStatus[w.status]}`}>
                      {w.status.replace("_", " ")}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="space-y-2 border-t border-border bg-background/40 px-4 py-3 text-sm text-muted-foreground">
                      <div>{w.description}</div>
                      {w.next_proof && (
                        <div>
                          <span className="text-foreground">Next proof: </span>
                          {w.next_proof}
                        </div>
                      )}
                      <div className="pt-1">
                        <FeedbackChips
                          source="mission"
                          targetId={w.id}
                          taskTitle={w.name}
                          groups={["fit", "value", "tone"]}
                          prompt="How does this workstream feel?"
                        />
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {m.capabilityClusters.length > 0 && (
        <section>
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Capability clusters
          </div>
          <div className="grid grid-cols-2 gap-3">
            {m.capabilityClusters.map((c) => (
              <div key={c.id} className="rounded-xl border border-border bg-card p-3">
                <div className="text-sm">{c.name}</div>
                <span
                  className={`mt-2 inline-block rounded-full border px-2 py-0.5 text-[10px] lowercase ${ccStatus[c.status]}`}
                >
                  {c.status.replace("_", " ")}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {m.evidenceSignals.length > 0 && (
        <section>
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Evidence signals
          </div>
          <ul className="overflow-hidden rounded-2xl border border-border bg-card">
            {m.evidenceSignals.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
              >
                <span className="flex-1 text-sm">{s.name}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] lowercase ${sigStyle(s.kind)}`}
                >
                  {s.kind}
                </span>
                <span className="w-16 text-right font-mono text-xs">{s.last_value || "—"}</span>
                <span className="hidden w-20 text-right text-[10px] text-muted-foreground sm:inline">
                  {s.target || "—"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default Mission;
