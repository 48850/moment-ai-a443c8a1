import { useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, Loader2, Compass } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { selectPlanViewModel } from "@/lib/selectors/plan";
import { Constellation } from "@/components/app/Constellation";
import type { MomentState, ScheduleBlock } from "@/lib/types";

interface PursuitTile {
  kind: "workstream" | "capability" | "evidence" | "risk";
  name: string;
  detail: string;
}

function selectPursuitPreview(state: MomentState | null): PursuitTile[] {
  const pm = state?.pursuit_model;
  if (!pm) return [];
  const tiles: PursuitTile[] = [];
  const wp = { critical: 0, high: 1, medium: 2, low: 3 } as const;
  const ws = [...pm.workstreams].sort((a, b) => (wp[a.priority] ?? 4) - (wp[b.priority] ?? 4))[0];
  if (ws) tiles.push({ kind: "workstream", name: ws.name, detail: ws.next_proof || ws.bottleneck || ws.description || "Push the next proof." });
  const cr = { not_started: 0, emerging: 1, developing: 2, solid: 3, mastered: 4 } as const;
  const cap = [...pm.capability_clusters].sort((a, b) => (cr[a.status] ?? 0) - (cr[b.status] ?? 0))[0];
  if (cap) tiles.push({ kind: "capability", name: cap.name, detail: cap.why_it_matters || cap.description || `Status: ${cap.status}.` });
  const lead = pm.evidence_signals.find((s) => s.kind === "leading");
  if (lead) {
    tiles.push({ kind: "evidence", name: lead.name, detail: lead.last_value ? `Last: ${lead.last_value}` : lead.description || "Track this signal." });
  } else {
    const sr = { critical: 0, high: 1, medium: 2, low: 3 } as const;
    const risk = [...pm.risks].sort((a, b) => (sr[a.severity] ?? 4) - (sr[b.severity] ?? 4))[0];
    if (risk) tiles.push({ kind: "risk", name: risk.name, detail: risk.mitigation || risk.description || `${risk.severity} severity.` });
  }
  return tiles.slice(0, 3);
}

const TILE_LABEL: Record<PursuitTile["kind"], string> = {
  workstream: "Workstream", capability: "Capability", evidence: "Signal", risk: "Risk",
};
const TILE_TONE: Record<PursuitTile["kind"], string> = {
  workstream: "border-primary/40",
  capability: "border-accent/40",
  evidence: "border-primary/40",
  risk: "border-destructive/40",
};

const typeStyles: Record<string, string> = {
  study: "bg-primary/15 text-primary border-primary/30",
  goal_work: "bg-primary/15 text-primary border-primary/30",
  exercise: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  commute: "bg-secondary text-muted-foreground border-border",
  buffer: "bg-secondary text-muted-foreground border-border",
  fixed_commitment: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  meal: "bg-secondary text-muted-foreground border-border",
  recovery: "bg-secondary text-muted-foreground border-border",
  wind_down: "bg-secondary text-muted-foreground border-border",
};

const Plan = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [reformOpen, setReformOpen] = useState(false);
  const [reformNote, setReformNote] = useState("");
  const [reforming, setReforming] = useState(false);

  if (!state) return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;
  const vm = selectPlanViewModel(state);

  const setActivePlan = (plan: "plan_a" | "plan_b") => {
    dispatch({ type: "home/setPlan", payload: plan });
  };

  const onReform = () => {
    if (!reformNote.trim()) return;
    setReforming(true);
    // Deterministic local reform: drop linked tasks tagged too_vague/too_big and
    // prepend a "Revised" placeholder block so the user sees an immediate change.
    setTimeout(() => {
      const recentBad = new Set(
        (state.execution_feedback ?? [])
          .filter((f) => f.feedback === "too_vague" || f.feedback === "too_big")
          .map((f) => f.task_id),
      );
      const basePlan = state.schedule_state.day_plan;
      const reformed: ScheduleBlock[] = [
        {
          id: `reform-${Date.now()}`,
          title: `Revised: ${reformNote.trim()}`,
          type: "goal_work",
          start_time: "16:00",
          end_time: "16:30",
          duration_minutes: 30,
          priority: 1,
          is_fixed: false,
          source: "quick_reform",
          goal_link: state.active_goal?.statement ?? "",
          fallback_version: "",
          status: "upcoming",
        },
        ...basePlan.filter((b) => !(b.linked_task_ids ?? []).some((id) => recentBad.has(id))),
      ];
      dispatch({
        type: "plan/reform",
        payload: { reformed_plan: reformed, reform_note: reformNote.trim() },
      });
      setReforming(false);
      setReformOpen(false);
      setReformNote("");
    }, 500);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="text-xs text-muted-foreground">/ plan</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Today, mapped out</h1>
      </div>

      {vm.hasPlanB && (
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          <button
            onClick={() => setActivePlan("plan_a")}
            className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
              vm.activePlan === "plan_a"
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Original
          </button>
          <button
            onClick={() => setActivePlan("plan_b")}
            className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
              vm.activePlan === "plan_b"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Adjusted
          </button>
        </div>
      )}

      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        {vm.scheduleBlocks.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing planned yet.</div>
        ) : (
          <ul className="divide-y divide-border">
            {vm.scheduleBlocks.map((b) => {
              const isDecisive = (b.linked_task_ids ?? []).includes("t-essay-opener");
              return (
                <li
                  key={b.id}
                  className={`flex items-center gap-4 px-4 py-3 ${
                    b.status === "completed" ? "opacity-50" : ""
                  } ${isDecisive ? "border-l-2 border-l-primary" : ""}`}
                >
                  <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                    {b.start_time}–{b.end_time}
                  </span>
                  <span className="flex-1 text-sm">{b.title}</span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] lowercase ${
                      typeStyles[b.type] ?? "bg-secondary text-muted-foreground border-border"
                    }`}
                  >
                    {b.type.replace("_", " ")}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card/50 p-4">
        {!reformOpen ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4" /> Day not feeling right?
            </div>
            <button
              onClick={() => setReformOpen(true)}
              className="rounded-md px-3 py-1.5 text-xs text-foreground hover:bg-secondary"
            >
              Adjust it
            </button>
          </div>
        ) : (
          <div>
            <div className="text-sm">What's not working?</div>
            <div className="mt-1 text-xs text-muted-foreground">
              We'll keep your original plan so you can switch back anytime.
            </div>
            <input
              value={reformNote}
              onChange={(e) => setReformNote(e.target.value)}
              placeholder="e.g. I'm low energy — cut study to 30 min"
              className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => setReformOpen(false)}
                className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={onReform}
                disabled={reforming || !reformNote.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {reforming && <Loader2 className="h-3 w-3 animate-spin" />}
                {reforming ? "Adjusting…" : "Adjust my day"}
              </button>
            </div>
          </div>
        )}
      </section>

      {vm.unscheduledTasks.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Unscheduled
          </div>
          <ul className="space-y-2">
            {vm.unscheduledTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm">
                <span>{t.title}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">
                  {t.estimated_minutes}m
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default Plan;
