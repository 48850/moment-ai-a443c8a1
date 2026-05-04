import { useEffect, useState } from "react";
import { LifeBuoy, Wind, Coffee, Heart, Sparkles, Loader2 } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { selectNextBestTask } from "@/lib/engine/next-best-task";
import { useAI } from "@/lib/ai/useAI";
import { toast } from "sonner";
import type { RescueSignal } from "@/lib/types";

const reasons = [
  { id: "overwhelmed", label: "I'm overwhelmed" },
  { id: "tired", label: "I'm wiped out" },
  { id: "stuck", label: "I'm stuck on something" },
  { id: "anxious", label: "I'm anxious" },
] as const;

const protocols: Record<string, { title: string; steps: string[]; icon: typeof Wind }> = {
  overwhelmed: {
    title: "One small thing",
    icon: LifeBuoy,
    steps: [
      "Close every other tab.",
      "Pick the smallest task on your list.",
      "Set a 10-minute timer. That's it.",
    ],
  },
  tired: {
    title: "Recovery first",
    icon: Coffee,
    steps: [
      "Drink water. Eat something real.",
      "Lie down for 20 minutes (no screen).",
      "Reassess after — sometimes the answer is rest.",
    ],
  },
  stuck: {
    title: "Unblock by talking",
    icon: Wind,
    steps: [
      "Open chat and describe what's blocking you in one sentence.",
      "Lower the bar: what's the worst version of this you could ship?",
      "Do that worst version for 15 minutes.",
    ],
  },
  anxious: {
    title: "Ground yourself",
    icon: Heart,
    steps: [
      "Name 5 things you can see, 4 you can hear, 3 you can touch.",
      "Take 4 slow breaths in for 4 counts, out for 6.",
      "Pick one tiny next step. The rest will wait.",
    ],
  },
};

const Rescue = () => {
  const state = useStateStore((s) => s.state);
  const dispatch = useStateStore((s) => s.dispatch);
  const [picked, setPicked] = useState<keyof typeof protocols | null>(null);
  const ai = useAI<{ title: string; steps: string[]; soft_note?: string }>("rescue_protocol");

  const handlePick = (id: keyof typeof protocols) => {
    setPicked(id);
    if (!state) return;
    const next = selectNextBestTask(state).best;
    let switchedToPlanB = false;
    let shrunkTo = 0;

    // For overwhelmed/tired: actually mutate the day — switch to Plan B if we
    // have a snapshot, OR shrink the next-best task to its first 10 minutes.
    if ((id === "overwhelmed" || id === "tired") && next) {
      const halved = Math.max(10, Math.round(next.estimated_minutes / 2));
      shrunkTo = halved;
      dispatch({
        type: "task/tune",
        payload: {
          id: next.id,
          feedback: id === "overwhelmed" ? "overwhelmed" : "tired",
          change: `Lightened to ~${halved} min via Rescue.`,
          changes: {
            estimated_minutes: halved,
            energy_demand: "low",
            was_tuned: true,
            title: next.title.startsWith("First 10 min: ")
              ? next.title
              : `First 10 min: ${next.title}`,
            original_title: (next as any).original_title || next.title,
          },
        },
      });
      // Flip Home to Plan B as the active mode (visible to the user).
      if (state.home.active_plan !== "plan_b") {
        dispatch({ type: "home/setPlan", payload: "plan_b" });
        switchedToPlanB = true;
      }
      toast.success(`Today softened — ${halved}-min first move queued.`);
    }

    const signal: RescueSignal = {
      id: crypto.randomUUID(),
      reason: id as RescueSignal["reason"],
      created_at: new Date().toISOString(),
      affected_task_id: next?.id ?? "",
      shrunk_to_minutes: shrunkTo,
      switched_to_plan_b: switchedToPlanB,
      note: "",
    };
    dispatch({ type: "rescue/log", payload: signal });
  };

  useEffect(() => {
    if (picked) ai.run({ reason: picked });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  if (!state) return <div className="mx-auto max-w-2xl py-12 text-sm text-muted-foreground">Loading…</div>;

  const proto = picked ? protocols[picked] : null;
  const Icon = proto?.icon ?? LifeBuoy;
  const next = selectNextBestTask(state).best;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <div className="text-xs text-muted-foreground">/ rescue</div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">When today feels too much</h1>
        <p className="mt-1 text-sm text-muted-foreground">Pick what's true right now.</p>
      </div>

      <section className="grid grid-cols-2 gap-3">
        {reasons.map((r) => (
          <button
            key={r.id}
            onClick={() => handlePick(r.id as keyof typeof protocols)}
            className={`rounded-xl border p-4 text-left text-sm transition-colors ${
              picked === r.id
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-card hover:border-primary/40"
            }`}
          >
            {r.label}
          </button>
        ))}
      </section>

      {proto && (
        <section className="rounded-2xl border border-primary/40 bg-gradient-to-b from-primary/10 to-transparent p-5">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
            <Icon className="h-3 w-3" /> rescue protocol
          </div>
          <h2 className="mt-2 text-lg font-semibold flex items-center gap-2">
            {ai.result?.title ?? proto.title}
            {ai.loading && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
          </h2>
          <ol className="mt-3 space-y-2 text-sm">
            {(ai.result?.steps ?? proto.steps).map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[11px] font-medium text-primary">
                  {i + 1}
                </span>
                <span>{s}</span>
              </li>
            ))}
          </ol>
          {ai.result?.soft_note && (
            <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <Sparkles className="mt-0.5 h-3 w-3 text-primary" />
              <span>{ai.result.soft_note}</span>
            </div>
          )}

          {next && picked === "stuck" && (
            <div className="mt-4 rounded-lg border border-border bg-card p-3 text-sm">
              <div className="text-xs text-muted-foreground">Try this first</div>
              <div className="mt-1 font-medium">{next.title}</div>
              <div className="text-xs text-muted-foreground">{next.estimated_minutes}m · low pressure</div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default Rescue;
