import { DecisiveMoveCard } from "@/components/landing/DecisiveMoveCard";

const Dashboard = () => (
  <div className="mx-auto max-w-5xl">
    <div className="mb-8">
      <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">Day 18 · 92-day pursuit</div>
      <h1 className="mt-2 font-display text-4xl tracking-tight">Welcome back, <span className="italic text-gradient-spark">Alex.</span></h1>
      <p className="mt-2 max-w-xl text-muted-foreground">Here's the one move that matters today. Everything else can wait.</p>
    </div>

    <div className="grid gap-8 lg:grid-cols-2">
      <DecisiveMoveCard />
      <div className="space-y-4">
        <div className="rounded-2xl border border-border bg-background p-5">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Goal</div>
          <div className="mt-1 font-display text-2xl">Stanford 2027</div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div className="h-full w-[19%] gradient-spark" />
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>19% pursuit</span><span>74 days left</span>
          </div>
        </div>
        <div className="rounded-2xl border border-border bg-background p-5">
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">Streak</div>
          <div className="mt-1 font-display text-2xl">12 decisive days 🔥</div>
        </div>
      </div>
    </div>
  </div>
);

export default Dashboard;
