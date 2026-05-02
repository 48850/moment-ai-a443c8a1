import { Check } from "lucide-react";

const phases = [
  { name: "Foundation", weeks: "Weeks 1–3", done: true, items: ["Pick target schools", "Draft Common App profile", "Schedule SAT retake"] },
  { name: "Essay sprint", weeks: "Weeks 4–7", done: false, items: ["Opener draft", "Mentor review", "Final polish"] },
  { name: "Applications", weeks: "Weeks 8–11", done: false, items: ["Rec letters", "Submit EA", "Interview prep"] },
  { name: "Decision", weeks: "Week 12+", done: false, items: ["Compare offers", "Visit campus", "Commit"] },
];

const Plan = () => (
  <div className="mx-auto max-w-4xl">
    <div className="mb-8">
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">/ plan</div>
      <h1 className="mt-1 font-display text-4xl tracking-tight">The 92-day pursuit</h1>
      <p className="mt-2 text-muted-foreground">Goal: <span className="text-foreground">Stanford 2027</span></p>
    </div>

    <div className="space-y-4">
      {phases.map((p, i) => (
        <div key={p.name} className="rounded-2xl border border-border bg-background p-6">
          <div className="flex items-center gap-3">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs ${
              p.done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {p.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
            </span>
            <div>
              <div className="font-display text-xl">{p.name}</div>
              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{p.weeks}</div>
            </div>
          </div>
          <ul className="mt-4 ml-10 space-y-1.5 text-sm text-muted-foreground">
            {p.items.map((it) => <li key={it}>· {it}</li>)}
          </ul>
        </div>
      ))}
    </div>
  </div>
);

export default Plan;
