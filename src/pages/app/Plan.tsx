import { useState } from "react";
import { RefreshCw, Loader2 } from "lucide-react";
import { planMock, type ScheduleBlock } from "@/lib/mockData";

const typeStyles: Record<ScheduleBlock["type"], string> = {
  study: "bg-primary/15 text-primary border-primary/30",
  exercise: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  commute: "bg-secondary text-muted-foreground border-border",
  buffer: "bg-secondary text-muted-foreground border-border",
  fixed: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

const Plan = () => {
  const [blocks] = useState<ScheduleBlock[]>(planMock.scheduleBlocks);
  const [activePlan, setActivePlan] = useState<"plan_a" | "plan_b">(planMock.activePlan);
  const [hasPlanB, setHasPlanB] = useState(planMock.hasPlanB);
  const [reformOpen, setReformOpen] = useState(false);
  const [reformNote, setReformNote] = useState("");
  const [reforming, setReforming] = useState(false);
  const [reformError, setReformError] = useState<string | null>(null);

  const onReform = () => {
    if (!reformNote.trim()) return;
    setReforming(true);
    setReformError(null);
    setTimeout(() => {
      setReforming(false);
      setHasPlanB(true);
      setActivePlan("plan_b");
      setReformOpen(false);
      setReformNote("");
    }, 900);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="text-xs text-muted-foreground">/ plan</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Today's plan</h1>
      </div>

      {/* Plan A/B switcher */}
      {hasPlanB && (
        <div className="inline-flex rounded-lg border border-border bg-card p-1">
          <button
            onClick={() => setActivePlan("plan_a")}
            className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
              activePlan === "plan_a" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Plan A (original)
          </button>
          <button
            onClick={() => setActivePlan("plan_b")}
            className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
              activePlan === "plan_b" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Plan B (reformed)
          </button>
        </div>
      )}

      {/* Schedule */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <ul className="divide-y divide-border">
          {blocks.map((b) => (
            <li
              key={b.id}
              className={`flex items-center gap-4 px-4 py-3 ${b.status === "completed" ? "opacity-50" : ""} ${
                b.decisive ? "border-l-2 border-l-primary" : ""
              }`}
            >
              <span className="w-24 shrink-0 font-mono text-xs text-muted-foreground">
                {b.start_time}–{b.end_time}
              </span>
              <span className="flex-1 text-sm">{b.title}</span>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] lowercase ${typeStyles[b.type]}`}>{b.type}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Quick Reform */}
      <section className="rounded-2xl border border-border bg-card/50 p-4">
        {!reformOpen ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4" /> Quick Reform
            </div>
            <button
              onClick={() => setReformOpen(true)}
              className="rounded-md px-3 py-1.5 text-xs text-foreground hover:bg-secondary"
            >
              Adjust plan
            </button>
          </div>
        ) : (
          <div>
            <div className="text-sm">What feels unrealistic?</div>
            <div className="mt-1 text-xs text-muted-foreground">Your original plan will be preserved as Plan A.</div>
            <input
              value={reformNote}
              onChange={(e) => setReformNote(e.target.value)}
              placeholder="e.g. Cut study session to 30 min, I'm low energy"
              className="mt-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
            {reformError && <div className="mt-2 text-xs text-amber-400">{reformError}</div>}
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setReformOpen(false)} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
                Cancel
              </button>
              <button
                onClick={onReform}
                disabled={reforming || !reformNote.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
              >
                {reforming && <Loader2 className="h-3 w-3 animate-spin" />}
                {reforming ? "Reforming…" : "Reform to Plan B"}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Unscheduled */}
      {planMock.unscheduledTasks.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Unscheduled</div>
          <ul className="space-y-2">
            {planMock.unscheduledTasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between text-sm">
                <span>{t.title}</span>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{t.estimated_minutes}m</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default Plan;
