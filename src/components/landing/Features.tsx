import { motion } from "motion/react";
import { Compass, Crosshair, GitBranch, LifeBuoy, Sparkles, TrendingUp } from "lucide-react";

const features = [
  { icon: Crosshair, title: "Decisive Move engine", body: "No to-do soup. Each morning, Moment names the single move that actually advances your goal." },
  { icon: GitBranch, title: "Pursuit planner", body: "Your big ambition is compiled into a living plan — milestones, dependencies, and deadlines that adapt to reality." },
  { icon: Compass, title: "Mission graph", body: "See how every micro-task ladders to identity-level outcomes. Zoom in on today, zoom out on a year." },
  { icon: LifeBuoy, title: "Rescue mode", body: "Slipped a week? Moment rebuilds your runway in seconds — no shame spiral, no blank page." },
  { icon: TrendingUp, title: "Honest momentum", body: "Streaks that measure depth, not vanity. Built for teens who want to ship, not perform." },
  { icon: Sparkles, title: "Mentor in your pocket", body: "Reflect, adjust, and get unstuck with an AI that knows your goal — and remembers." },
];

export const Features = () => (
  <section id="why" className="relative mx-auto w-full max-w-7xl px-6 py-28 md:px-10">
    <div className="mb-16 max-w-2xl">
      <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">/ why moment</div>
      <h2 className="text-balance font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
        Most apps make you <span className="italic">busy.</span><br />
        Moment makes you <span className="text-gradient-spark">arrive.</span>
      </h2>
    </div>

    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-[28px] border border-border bg-border/40 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((f, i) => (
        <motion.div
          key={f.title}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, delay: i * 0.05 }}
          className="group relative bg-background p-8 transition-colors hover:bg-muted/40"
        >
          <f.icon className="h-6 w-6 text-primary transition-transform group-hover:-rotate-6" strokeWidth={1.75} />
          <h3 className="mt-6 font-display text-xl font-medium">{f.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
        </motion.div>
      ))}
    </div>
  </section>
);
