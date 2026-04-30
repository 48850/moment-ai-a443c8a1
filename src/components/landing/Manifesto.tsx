import { motion } from "motion/react";

export const Manifesto = () => (
  <section id="manifesto" className="relative mx-auto w-full max-w-5xl px-6 py-32 md:px-10">
    <div className="mb-8 font-mono text-[11px] uppercase tracking-[0.2em] text-primary">/ manifesto</div>
    <motion.blockquote
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8 }}
      className="text-balance font-display text-3xl font-medium leading-[1.15] tracking-tight sm:text-5xl"
    >
      We are tired of apps that <span className="italic text-muted-foreground">simulate progress</span>.
      Streaks that mean nothing. Notifications that mean less. Moment is for the kid who wants the
      <span className="text-gradient-spark"> real thing</span> — to look back in a year and see a
      different person staring back.
    </motion.blockquote>
    <div className="mt-10 flex items-center gap-3 font-mono text-xs uppercase tracking-wider text-muted-foreground">
      <span className="h-px w-10 bg-foreground/30" />
      The Moment team
    </div>
  </section>
);
