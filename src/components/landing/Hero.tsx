import { motion } from "motion/react";
import { DecisiveMoveCard } from "./DecisiveMoveCard";

export const Hero = () => {
  return (
    <section className="relative overflow-hidden">
      {/* faint grid */}
      <div className="pointer-events-none absolute inset-0 ring-grid opacity-60" />
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-primary/15 blur-[120px]" />

      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 gap-12 px-6 pb-24 pt-12 md:px-10 lg:grid-cols-12 lg:gap-8 lg:pb-32 lg:pt-20">
        <div className="lg:col-span-7">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1 backdrop-blur"
          >
            <span className="h-1.5 w-1.5 animate-pulse-glow rounded-full bg-accent" />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Now in private beta · for ambitious teens
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
            className="text-balance font-display text-[44px] font-medium leading-[0.95] tracking-tight text-foreground sm:text-[64px] lg:text-[84px]"
          >
            One goal. <br className="hidden sm:block" />
            <span className="italic text-gradient-spark">One plan.</span> <br className="hidden sm:block" />
            One move at a time.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl"
          >
            Moment is a goal-specialized operating system that turns your wildest
            ambition into the next decisive move — every single day. No infinite to-dos.
            No noise. Just momentum.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.45 }}
            className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center"
          >
            <a
              href="#cta"
              className="group inline-flex items-center gap-3 rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-paper shadow-elevated transition-transform hover:-translate-y-0.5"
            >
              Claim your moment
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-paper/15 transition-transform group-hover:translate-x-0.5">→</span>
            </a>
            <a href="#how" className="text-sm font-medium text-foreground/80 underline-offset-4 hover:underline">
              See how it works
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.7 }}
            className="mt-14 flex items-center gap-6 text-xs text-muted-foreground"
          >
            <div>
              <div className="font-display text-2xl text-foreground">14k+</div>
              <div className="font-mono uppercase tracking-wider">teens on the list</div>
            </div>
            <div className="h-8 w-px bg-border" />
            <div>
              <div className="font-display text-2xl text-foreground">1 goal</div>
              <div className="font-mono uppercase tracking-wider">at a time. by design.</div>
            </div>
            <div className="hidden h-8 w-px bg-border sm:block" />
            <div className="hidden sm:block">
              <div className="font-display text-2xl text-foreground">∞ moves</div>
              <div className="font-mono uppercase tracking-wider">until you arrive</div>
            </div>
          </motion.div>
        </div>

        <div className="relative lg:col-span-5">
          <DecisiveMoveCard />
        </div>
      </div>
    </section>
  );
};
