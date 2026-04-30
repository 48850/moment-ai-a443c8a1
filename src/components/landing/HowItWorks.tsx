import { motion } from "motion/react";

const steps = [
  { n: "01", k: "Name it", t: "Tell Moment your one big goal", d: "Stanford. A first 10k. A song on Spotify. State it once — Moment turns it into a pursuit." },
  { n: "02", k: "Plan it", t: "We compile the path", d: "Milestones, dependencies, weekly resets — generated, not guessed. You can edit anything." },
  { n: "03", k: "Move it", t: "One decisive move per day", d: "Open the app. Do the thing. Close the app. Repeat until the world looks different." },
];

export const HowItWorks = () => (
  <section id="how" className="relative ink-bg text-paper">
    <div className="mx-auto w-full max-w-7xl px-6 py-28 md:px-10">
      <div className="mb-16 flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <div>
          <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-primary-glow">/ how it works</div>
          <h2 className="text-balance font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
            From vague ambition to <span className="italic text-gradient-spark">tomorrow morning.</span>
          </h2>
        </div>
        <p className="max-w-md text-pretty text-paper/60">
          Three steps. No onboarding sludge. No gamified noise. Just the shortest path between
          who you are and who you're becoming.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {steps.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: i * 0.12 }}
            className="relative overflow-hidden rounded-3xl border border-paper/10 bg-paper/[0.03] p-8 backdrop-blur"
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-paper/40">{s.n}</span>
              <span className="rounded-full border border-paper/15 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-paper/60">
                {s.k}
              </span>
            </div>
            <h3 className="mt-10 font-display text-3xl font-medium leading-tight">{s.t}</h3>
            <p className="mt-3 text-sm leading-relaxed text-paper/60">{s.d}</p>
            <div className="absolute -bottom-12 -right-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
