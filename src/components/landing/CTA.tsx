import { motion } from "motion/react";
import { useState } from "react";

export const CTA = () => {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  return (
    <section id="cta" className="relative mx-auto w-full max-w-7xl px-6 pb-28 md:px-10">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
        className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-foreground to-ink p-10 text-paper shadow-elevated md:p-16"
      >
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-primary/40 blur-[100px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-accent/30 blur-[100px]" />

        <div className="relative grid gap-10 md:grid-cols-2 md:items-end">
          <div>
            <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.2em] text-primary-glow">/ early access</div>
            <h2 className="text-balance font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
              Stop drifting. <br />
              <span className="italic text-gradient-spark">Start moving.</span>
            </h2>
            <p className="mt-5 max-w-md text-paper/70">
              Be among the first 1,000 teens shaping Moment. Free during beta. No spam — only
              actual progress.
            </p>
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); if (email) setSent(true); }}
            className="relative"
          >
            {sent ? (
              <div className="rounded-2xl border border-paper/15 bg-paper/5 p-6 text-paper">
                <div className="font-display text-2xl">You're in.</div>
                <p className="mt-2 text-sm text-paper/60">We'll email <span className="text-paper">{email}</span> when your moment opens.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  className="flex-1 rounded-full border border-paper/15 bg-paper/5 px-5 py-3.5 text-sm text-paper placeholder:text-paper/40 focus:border-primary-glow focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-full bg-paper px-6 py-3.5 text-sm font-medium text-ink transition-transform hover:-translate-y-0.5"
                >
                  Claim my spot →
                </button>
              </div>
            )}
            <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-paper/40">
              No credit card. Quit anytime. Built by people who almost didn't make it.
            </p>
          </form>
        </div>
      </motion.div>
    </section>
  );
};
