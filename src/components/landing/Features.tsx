import { motion } from "motion/react";
import { Compass, Crosshair, Hammer, LifeBuoy, MessageSquare, Radar, ListChecks, Users, Sparkles } from "lucide-react";

const features = [
  { icon: Crosshair, title: "Decisive Move", body: "Every morning, Moment names the single move that actually advances your goal — with the resource pre-attached and a notes drawer for what you learn." },
  { icon: Compass, title: "Living plan", body: "Your ambition is compiled into stages, workstreams, and a real week — milestones, dependencies and resets that adapt to your school year and reality gap." },
  { icon: ListChecks, title: "Tasks with Declutter", body: "Every pending task in one place. Hit Declutter and Moment scores, archives stale items and promotes the three that actually matter today." },
  { icon: Radar, title: "Mission notices", body: "Tailored, grounded read-outs on momentum, drift, bottlenecks and blind spots — based on your actual workstreams, not generic productivity tropes." },
  { icon: Hammer, title: "The Forge", body: "Stuck on something hard? Spin up a focused mini-app — essay opener, problem-set crusher, interview rehearsal — wired to your goal and your context." },
  { icon: LifeBuoy, title: "Rescue mode", body: "Slipped a week? Moment rebuilds your runway in seconds and surfaces the smallest re-entry point. No shame spiral, no blank page." },
  { icon: MessageSquare, title: "A coach that remembers", body: "Chat and Reflect share the same memory of your goal, your week, your knowns and unknowns. Microfeedback tunes the next move toward what actually works." },
  { icon: Users, title: "Aligned social", body: "A privacy-first feed of people moving on the same goal. React, comment, follow — no metrics, no doomscroll. Just proof you're not alone." },
  { icon: Sparkles, title: "Guided onboarding", body: "A 60-second tour the first time you open the app, plus an honest intake that turns your ambition into stages before you do anything else." },
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
