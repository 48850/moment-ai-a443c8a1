import { motion } from "motion/react";
import { Check, ExternalLink, NotebookPen, Sparkles, Target } from "lucide-react";

export const DecisiveMoveCard = () => (
  <motion.div
    initial={{ opacity: 0, y: 30, rotate: -2 }}
    animate={{ opacity: 1, y: 0, rotate: -1.5 }}
    transition={{ duration: 0.9, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
    className="relative mx-auto w-full max-w-md"
  >
    {/* orbit ring */}
    <div className="pointer-events-none absolute -inset-10 -z-10">
      <div className="absolute inset-0 animate-orbit rounded-full border border-dashed border-primary/30" />
      <div className="absolute inset-6 animate-orbit rounded-full border border-dashed border-accent/30" style={{ animationDirection: "reverse", animationDuration: "55s" }} />
    </div>

    <div className="relative rounded-[28px] border border-border bg-background p-6 shadow-elevated backdrop-blur">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full gradient-spark text-paper">
            <Target className="h-4 w-4" strokeWidth={2.5} />
          </span>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Today · Tue</div>
            <div className="font-display text-base font-medium">The next decisive move</div>
          </div>
        </div>
        <span className="rounded-full bg-accent/15 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-accent">live</span>
      </div>

      <div className="mt-6 rounded-2xl bg-muted/60 p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 border-foreground/30" />
          <div>
            <div className="font-display text-xl leading-tight">
              Draft 250 words for your <span className="italic text-primary">college essay opener.</span>
            </div>
            <div className="mt-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
              25 min · advances goal: <span className="text-foreground">Stanford 2027</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a
            href="#"
            onClick={(e) => e.preventDefault()}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-primary"
          >
            <ExternalLink className="h-3 w-3" />
            CommonApp · prompt #1
          </a>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            <NotebookPen className="h-3 w-3" />
            Notes · 2
          </span>
        </div>

        <div className="mt-5 flex gap-2">
          <button className="flex-1 rounded-full bg-ink py-2.5 text-xs font-medium text-paper">Start now</button>
          <button className="rounded-full border border-border bg-background px-4 py-2.5 text-xs font-medium">Swap</button>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {[
          { t: "Talked to Mr. Chen about rec letter", done: true },
          { t: "Practiced 12 calc problems", done: true },
          { t: "Reviewed essay outline with mentor", done: true },
        ].map((it) => (
          <div key={it.t} className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Check className="h-3 w-3" strokeWidth={3} />
            </span>
            <span className="line-through decoration-foreground/20">{it.t}</span>
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-xl bg-primary/8 p-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <p className="text-xs leading-relaxed text-foreground/80">
          <span className="font-medium">Moment:</span> You're 18 days into a 92-day pursuit.
          Stay on the opener — momentum compounds.
        </p>
      </div>
    </div>
  </motion.div>
);
