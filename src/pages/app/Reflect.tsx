import { useMemo, useState } from "react";
import { useStateStore } from "@/stores/state-store";
import type { Reflection } from "@/lib/types";
import { getTodayString } from "@/lib/engine/next-best-task";
import { FeedbackChips } from "@/components/app/FeedbackChips";
import { PatternBanner } from "@/components/app/PatternBanner";
import { AIInsight } from "@/components/app/AIInsight";
import { useAI } from "@/lib/ai/useAI";

const Reflect = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const today = getTodayString();
  const existing = useMemo(
    () => state?.reflections.find((r) => r.date === today),
    [state?.reflections, today],
  );

  const [energy, setEnergy] = useState<number>(existing?.energy_rating ?? 3);
  const [win, setWin] = useState<string>(existing?.win ?? existing?.accomplishment ?? "");
  const [struggle, setStruggle] = useState<string>(existing?.struggle ?? "");
  const [tomorrow, setTomorrow] = useState<string>(existing?.tomorrow_intention ?? "");
  const [saved, setSaved] = useState(false);
  const debrief = useAI<{ headline: string; win?: string; friction?: string; tomorrow_intention?: string }>("daily_debrief");

  if (!state) return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;

  const save = () => {
    const r: Reflection = {
      id: existing?.id ?? crypto.randomUUID(),
      date: today,
      energy_rating: energy,
      accomplishment: win,
      struggle,
      tomorrow_intention: tomorrow,
      created_at: existing?.created_at ?? new Date().toISOString(),
      win,
    };
    dispatch({ type: "reflection/add", payload: r });
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="text-xs text-muted-foreground">/ reflect</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">How was today?</h1>
        <p className="mt-1 text-sm text-muted-foreground">A two-minute check-in. No pressure.</p>
      </div>

      <PatternBanner />

      <AIInsight
        label="today's debrief"
        loading={debrief.loading}
        error={debrief.error}
        onRun={() => debrief.run({ tasks: state.tasks.filter(t => t.status === "done").map(t => t.title), reflections: state.reflections.slice(-3) })}
        cta={debrief.result ? "Refresh" : "Generate"}
      >
        {debrief.result && (
          <div className="space-y-1.5">
            <div className="font-medium">{debrief.result.headline}</div>
            {debrief.result.win && <div className="text-xs"><span className="text-muted-foreground">win · </span>{debrief.result.win}</div>}
            {debrief.result.friction && <div className="text-xs"><span className="text-muted-foreground">friction · </span>{debrief.result.friction}</div>}
            {debrief.result.tomorrow_intention && (
              <button
                onClick={() => setTomorrow(debrief.result!.tomorrow_intention!)}
                className="mt-1 text-xs text-primary underline-offset-2 hover:underline"
              >
                Use as tomorrow intention →
              </button>
            )}
          </div>
        )}
      </AIInsight>


      <section className="rounded-2xl border border-border bg-card p-5 space-y-5">
        <div>
          <div className="text-sm font-medium">Energy level</div>
          <div className="mt-2 flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setEnergy(n)}
                className={`h-9 w-9 rounded-full border text-sm transition-colors ${
                  energy === n
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-secondary text-muted-foreground hover:border-primary/60"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">One thing that went well</label>
          <textarea
            value={win}
            onChange={(e) => setWin(e.target.value)}
            rows={2}
            placeholder="A small win counts."
            className="mt-2 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium">What was hard?</label>
          <textarea
            value={struggle}
            onChange={(e) => setStruggle(e.target.value)}
            rows={2}
            placeholder="Be honest with yourself."
            className="mt-2 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div>
          <label className="text-sm font-medium">Tomorrow, I want to…</label>
          <input
            value={tomorrow}
            onChange={(e) => setTomorrow(e.target.value)}
            placeholder="One sentence."
            className="mt-2 w-full rounded-md border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <FeedbackChips
            source="reflection"
            targetId={today}
            groups={["energy", "tone"]}
            prompt="How did today's plan feel?"
          />
          <button
            onClick={save}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {saved ? "Saved ✓" : existing ? "Update" : "Save reflection"}
          </button>
        </div>
      </section>

      {state.reflections.length > 0 && (
        <section>
          <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Recent
          </div>
          <ul className="space-y-2">
            {[...state.reflections]
              .sort((a, b) => b.date.localeCompare(a.date))
              .slice(0, 7)
              .map((r) => (
                <li key={r.id} className="rounded-xl border border-border bg-card p-3 text-sm">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{r.date}</span>
                    <span>energy {r.energy_rating}/5</span>
                  </div>
                  {r.accomplishment && <div className="mt-1.5">✓ {r.accomplishment}</div>}
                  {r.struggle && <div className="mt-0.5 text-muted-foreground">— {r.struggle}</div>}
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
};

export default Reflect;
