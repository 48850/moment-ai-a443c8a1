import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useNavigate } from "react-router-dom";
import { Home, Calendar, Target, MessageSquare, ListChecks, Hammer, Users, Sparkles, ArrowRight, X } from "lucide-react";

const KEY = "moment.tutorial.v1";

type Step = {
  icon: React.ComponentType<{ className?: string }>;
  tag: string;
  title: string;
  body: string;
  goTo?: string;
};

const steps: Step[] = [
  {
    icon: Sparkles,
    tag: "welcome",
    title: "Welcome to Moment.",
    body: "A quick 60-second tour so you know where everything lives. You can skip any time — your plan is already waiting.",
  },
  {
    icon: Home,
    tag: "today",
    title: "Today — your decisive move",
    body: "Each morning Moment names the single move that actually advances your goal, with a resource pre-attached and a notes drawer for what you learn.",
    goTo: "/app",
  },
  {
    icon: MessageSquare,
    tag: "chat & reflect",
    title: "Chat, Reflect, Rescue, Social",
    body: "Chat with a coach that remembers your week. Reflect to capture what worked. Rescue rebuilds your runway if you slip. Social shows aligned people moving on similar goals.",
    goTo: "/app/chat",
  },
  {
    icon: Calendar,
    tag: "plan",
    title: "Plan — the living roadmap",
    body: "Stages, workstreams and a real week of moves. Adapts to your school year, commitments and reality gap. Edit anything, it recompiles.",
    goTo: "/app/plan",
  },
  {
    icon: ListChecks,
    tag: "tasks",
    title: "Tasks — with a Declutter button",
    body: "Every pending task in one place. Hit Declutter and Moment scores, archives stale items and promotes the top 3 most important to high priority.",
    goTo: "/app/tasks",
  },
  {
    icon: Hammer,
    tag: "forge",
    title: "Forge — focused mini-apps",
    body: "Stuck on something hard? Spin up an essay opener, problem-set crusher, interview rehearsal — wired to your goal and your context.",
    goTo: "/app/forge",
  },
  {
    icon: Target,
    tag: "mission",
    title: "Mission — the honest read",
    body: "Momentum, drift, bottlenecks and blind spots based on your actual workstreams. Plus summary clips of the arc so far.",
    goTo: "/app/mission",
  },
  {
    icon: Users,
    tag: "ready",
    title: "You're set.",
    body: "Open Today and make the move. You can restart this tour any time from Settings.",
    goTo: "/app",
  },
];

export const AppTutorial = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(KEY);
    if (!seen) {
      // Defer a tick so the shell renders behind the overlay
      const t = setTimeout(() => setOpen(true), 350);
      return () => clearTimeout(t);
    }
    const onReplay = () => {
      setI(0);
      setOpen(true);
    };
    window.addEventListener("moment:tutorial:replay", onReplay);
    return () => window.removeEventListener("moment:tutorial:replay", onReplay);
  }, []);

  const finish = () => {
    window.localStorage.setItem(KEY, "1");
    setOpen(false);
  };

  const next = () => {
    const step = steps[i];
    if (step.goTo) navigate(step.goTo);
    if (i >= steps.length - 1) {
      finish();
      return;
    }
    setI((n) => n + 1);
  };

  const step = steps[i];
  const Icon = step?.icon ?? Sparkles;

  return (
    <AnimatePresence>
      {open && step && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-background/70 px-4 pb-6 backdrop-blur-sm sm:items-center sm:pb-0"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tutorial-title"
        >
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8"
          >
            <button
              onClick={finish}
              aria-label="Skip tutorial"
              className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>

            <div className="mb-5 flex items-center gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                / {step.tag}
              </span>
            </div>

            <h2 id="tutorial-title" className="font-display text-2xl leading-tight tracking-tight">
              {step.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{step.body}</p>

            <div className="mt-6 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5" aria-label="progress">
                {steps.map((_, k) => (
                  <span
                    key={k}
                    className={`h-1 rounded-full transition-all ${
                      k === i ? "w-6 bg-primary" : k < i ? "w-3 bg-primary/50" : "w-3 bg-border"
                    }`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={finish}
                  className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Skip
                </button>
                <button
                  onClick={next}
                  className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  {i === steps.length - 1 ? "Get started" : "Next"}
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
