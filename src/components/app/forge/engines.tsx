import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Check, X, Plus, Flame, Timer, Target, Shield } from "lucide-react";
import type { GeneratedModuleManifest, ModuleEntry } from "@/lib/types";

/* ===========================================================
   Shared engine contract
   Each engine receives the live module and a logEntry callback.
   It owns its own session state (timers, current step, scoring).
   =========================================================== */

export interface EngineProps {
  module: GeneratedModuleManifest;
  logEntry: (data: Record<string, unknown>, note?: string) => void;
}

export function ModuleEngine({ module: m, logEntry }: EngineProps) {
  switch (m.module_type) {
    case "practice_system":
      return <PracticeSystemEngine module={m} logEntry={logEntry} />;
    case "rescue_protocol":
      return <RescueProtocolEngine module={m} logEntry={logEntry} />;
    case "tracker":
    case "evidence_log":
      return <TrackerEngine module={m} logEntry={logEntry} />;
    case "planner":
      return <PlannerEngine module={m} logEntry={logEntry} />;
    case "review_engine":
    case "simulator":
    case "coach_loop":
    default:
      return <GenericRunEngine module={m} logEntry={logEntry} />;
  }
}

/* ===========================================================
   PRACTICE SYSTEM — runnable timed drill session
   Sequential drills with countdown, pause, skip, completion log.
   =========================================================== */

function PracticeSystemEngine({ module: m, logEntry }: EngineProps) {
  const drills: Array<{ name: string; minutes: number }> = m.config?.drills ?? [];
  const [running, setRunning] = useState(false);
  const [idx, setIdx] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState((drills[0]?.minutes ?? 0) * 60);
  const [completed, setCompleted] = useState<number[]>([]);
  const [notes, setNotes] = useState("");
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(id);
          handleDrillEnd();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, idx]);

  function start() {
    if (drills.length === 0) return;
    startedAtRef.current = Date.now();
    setSecondsLeft(drills[idx].minutes * 60);
    setRunning(true);
  }
  function pause() { setRunning(false); }
  function reset() {
    setRunning(false); setIdx(0); setCompleted([]);
    setSecondsLeft((drills[0]?.minutes ?? 0) * 60);
  }
  function handleDrillEnd() {
    setRunning(false);
    setCompleted((c) => [...c, idx]);
    if (idx < drills.length - 1) {
      const ni = idx + 1;
      setIdx(ni);
      setSecondsLeft(drills[ni].minutes * 60);
    } else {
      // session complete
      const totalMin = drills.reduce((a, d) => a + d.minutes, 0);
      logEntry({ session: "complete", drills_completed: drills.length, total_minutes: totalMin }, notes || undefined);
      setNotes("");
    }
  }
  function skip() { handleDrillEnd(); }

  if (drills.length === 0) return <Empty label="No drills configured." />;

  const cur = drills[idx];
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const pct = cur ? 1 - secondsLeft / (cur.minutes * 60) : 0;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-background p-5 text-center">
        <div className="flex items-center justify-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
          <Timer className="h-3 w-3" /> drill {idx + 1} / {drills.length}
        </div>
        <div className="mt-2 text-base font-medium">{cur.name}</div>
        <div className="mt-3 text-5xl font-light tabular-nums tracking-tight">{mm}:{ss}</div>
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-secondary">
          <div className="h-full bg-primary transition-all" style={{ width: `${pct * 100}%` }} />
        </div>
        <div className="mt-4 flex justify-center gap-2">
          {!running ? (
            <button onClick={start} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              <Play className="h-3.5 w-3.5" /> {secondsLeft === cur.minutes * 60 ? "Start" : "Resume"}
            </button>
          ) : (
            <button onClick={pause} className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium">
              <Pause className="h-3.5 w-3.5" /> Pause
            </button>
          )}
          <button onClick={skip} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm">
            Skip <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm">
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <ol className="space-y-1.5">
        {drills.map((d, i) => (
          <li key={i} className={`flex items-center justify-between rounded-md border px-3 py-2 text-xs ${
            i === idx ? "border-primary bg-primary/5" :
            completed.includes(i) ? "border-emerald-500/30 bg-emerald-500/5 text-muted-foreground line-through" :
            "border-border bg-background/50"
          }`}>
            <span>{i + 1}. {d.name}</span>
            <span className="text-muted-foreground">{d.minutes}m</span>
          </li>
        ))}
      </ol>

      <textarea
        value={notes} onChange={(e) => setNotes(e.target.value)}
        rows={2} placeholder="What broke? What flowed?"
        className="w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs"
      />
      <SessionLog entries={m.entries ?? []} />
    </div>
  );
}

/* ===========================================================
   RESCUE PROTOCOL — guided sequential steps with checkoff
   =========================================================== */

function RescueProtocolEngine({ module: m, logEntry }: EngineProps) {
  const steps: string[] = m.config?.steps ?? [];
  const [running, setRunning] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [done, setDone] = useState<number[]>([]);
  const [howFeel, setHowFeel] = useState<"heavy" | "ok" | "lighter" | null>(null);

  if (steps.length === 0) return <Empty label="No steps configured." />;

  function begin() { setRunning(true); setStepIdx(0); setDone([]); setHowFeel(null); }
  function nextStep() {
    setDone((d) => [...d, stepIdx]);
    if (stepIdx < steps.length - 1) setStepIdx(stepIdx + 1);
    else setRunning(false);
  }
  function finish() {
    logEntry({ ran: true, steps_completed: done.length + (running ? 1 : 0), felt_after: howFeel }, undefined);
    setRunning(false); setStepIdx(0); setDone([]); setHowFeel(null);
  }

  if (!running && done.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-background p-5 text-center">
          <Shield className="mx-auto h-6 w-6 text-primary" />
          <div className="mt-2 text-sm font-medium">{m.title}</div>
          <p className="mt-1 text-xs text-muted-foreground">A short guided protocol. One step at a time.</p>
          <button onClick={begin} className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            <Play className="h-3.5 w-3.5" /> Begin protocol
          </button>
        </div>
        <SessionLog entries={m.entries ?? []} />
      </div>
    );
  }

  if (running) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-background p-5">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary">step {stepIdx + 1} of {steps.length}</div>
          <p className="mt-2 text-base">{steps[stepIdx]}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button onClick={() => setRunning(false)} className="rounded-md px-3 py-1.5 text-xs text-muted-foreground">Pause</button>
            <button onClick={nextStep} className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              <Check className="h-3.5 w-3.5" /> {stepIdx === steps.length - 1 ? "Done" : "Next step"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Finished — collect quick feedback
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5 text-center">
        <Check className="mx-auto h-5 w-5 text-emerald-500" />
        <div className="mt-2 text-sm">All steps complete.</div>
        <div className="mt-3 text-xs text-muted-foreground">How does it feel now?</div>
        <div className="mt-2 flex justify-center gap-2">
          {(["heavy", "ok", "lighter"] as const).map((f) => (
            <button key={f} onClick={() => setHowFeel(f)}
              className={`rounded-full border px-3 py-1 text-xs capitalize ${howFeel === f ? "border-primary bg-primary/10" : "border-border"}`}>
              {f}
            </button>
          ))}
        </div>
        <button onClick={finish} className="mt-4 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Save run
        </button>
      </div>
    </div>
  );
}

/* ===========================================================
   TRACKER / EVIDENCE LOG — structured entry logger w/ history
   =========================================================== */

function TrackerEngine({ module: m, logEntry }: EngineProps) {
  const fields: Array<{ key: string; label: string; kind: "number" | "text" | "rating" }> =
    m.config?.fields ?? [{ key: "value", label: "Value", kind: "number" }, { key: "note", label: "Note", kind: "text" }];
  const [data, setData] = useState<Record<string, string | number>>({});
  const [open, setOpen] = useState(false);

  function submit() {
    const filled = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== "" && v !== undefined));
    if (Object.keys(filled).length === 0) return;
    logEntry(filled);
    setData({}); setOpen(false);
  }

  const entries = m.entries ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-background p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <div className="text-sm font-medium">Log a signal</div>
          </div>
          <button onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
            <Plus className="h-3 w-3" /> {open ? "Close" : "New entry"}
          </button>
        </div>
        {open && (
          <div className="mt-3 space-y-2">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{f.label}</label>
                {f.kind === "rating" ? (
                  <div className="mt-1 flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button key={n} onClick={() => setData((d) => ({ ...d, [f.key]: n }))}
                        className={`h-8 w-8 rounded-md border text-xs ${data[f.key] === n ? "border-primary bg-primary/10" : "border-border"}`}>
                        {n}
                      </button>
                    ))}
                  </div>
                ) : (
                  <input
                    type={f.kind === "number" ? "number" : "text"}
                    value={(data[f.key] as string | number) ?? ""}
                    onChange={(e) => setData((d) => ({ ...d, [f.key]: f.kind === "number" ? Number(e.target.value) : e.target.value }))}
                    className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  />
                )}
              </div>
            ))}
            <div className="flex justify-end">
              <button onClick={submit} className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Save entry</button>
            </div>
          </div>
        )}
      </div>

      <TrackerHistory entries={entries} fields={fields} />
    </div>
  );
}

function TrackerHistory({ entries, fields }: { entries: ModuleEntry[]; fields: Array<{ key: string; label: string; kind: string }> }) {
  if (entries.length === 0) return <Empty label="No entries yet." />;
  const numericKey = fields.find((f) => f.kind === "number" || f.kind === "rating")?.key;
  const series = numericKey ? entries.map((e) => Number(e.data[numericKey] ?? 0)).filter((n) => !isNaN(n)) : [];
  const max = Math.max(1, ...series);
  return (
    <div className="space-y-3">
      {series.length > 1 && (
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">trend · {numericKey}</div>
          <div className="mt-2 flex h-16 items-end gap-1">
            {series.slice(-20).map((v, i) => (
              <div key={i} className="flex-1 rounded-t bg-primary/60" style={{ height: `${(v / max) * 100}%` }} title={String(v)} />
            ))}
          </div>
        </div>
      )}
      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">recent · {entries.length}</div>
        <ul className="mt-2 space-y-1.5">
          {entries.slice(-6).reverse().map((e) => (
            <li key={e.id} className="rounded-md border border-border bg-background/50 px-3 py-2 text-xs">
              <div className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div>
              <div>{Object.entries(e.data).map(([k, v]) => `${k}: ${v}`).join(" · ")}</div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ===========================================================
   PLANNER — slot-based weekly planner with check-ins per slot
   =========================================================== */

function PlannerEngine({ module: m, logEntry }: EngineProps) {
  const slots: Array<{ label: string; cadence: string }> = m.config?.slots ?? [];
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [note, setNote] = useState("");

  if (slots.length === 0) return <Empty label="No slots configured." />;

  function checkIn(i: number) {
    logEntry({ slot: slots[i].label, cadence: slots[i].cadence, status: "done" }, note || undefined);
    setActiveSlot(null); setNote("");
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {slots.map((s, i) => {
          const recentForSlot = (m.entries ?? []).filter((e) => e.data.slot === s.label).length;
          return (
            <li key={i} className="rounded-xl border border-border bg-background p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-[11px] text-muted-foreground">{s.cadence} · {recentForSlot} check-ins</div>
                </div>
                <button onClick={() => setActiveSlot(activeSlot === i ? null : i)}
                  className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                  <Check className="h-3 w-3" /> Check in
                </button>
              </div>
              {activeSlot === i && (
                <div className="mt-3 space-y-2">
                  <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="One sentence on how it went…"
                    className="w-full rounded-md border border-border bg-background px-3 py-2 text-xs" />
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setActiveSlot(null)} className="rounded-md px-2 py-1 text-xs text-muted-foreground">Cancel</button>
                    <button onClick={() => checkIn(i)} className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">Save</button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <SessionLog entries={m.entries ?? []} />
    </div>
  );
}

/* ===========================================================
   GENERIC RUN — fallback "run once" engine for any module
   =========================================================== */

function GenericRunEngine({ module: m, logEntry }: EngineProps) {
  const [note, setNote] = useState("");
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-background p-5 text-center">
        <Flame className="mx-auto h-5 w-5 text-primary" />
        <div className="mt-2 text-sm">{m.title}</div>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2}
          placeholder="What did you do this round?"
          className="mt-3 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-xs" />
        <button onClick={() => { logEntry({ ran: true }, note || undefined); setNote(""); }}
          className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          <Play className="h-3.5 w-3.5" /> Log run
        </button>
      </div>
      <SessionLog entries={m.entries ?? []} />
    </div>
  );
}

/* ===========================================================
   Shared bits
   =========================================================== */

function Empty({ label }: { label: string }) {
  return <div className="rounded-md border border-dashed border-border bg-background/50 p-4 text-center text-xs text-muted-foreground">{label}</div>;
}

function SessionLog({ entries }: { entries: ModuleEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">history · {entries.length}</div>
      <ul className="mt-2 space-y-1.5">
        {entries.slice(-5).reverse().map((e) => (
          <li key={e.id} className="rounded-md border border-border bg-background/50 px-3 py-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
              {e.note && <span className="ml-2 truncate text-muted-foreground/80">"{e.note}"</span>}
            </div>
            <div className="mt-0.5">{Object.entries(e.data).map(([k, v]) => `${k}: ${v}`).join(" · ")}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
