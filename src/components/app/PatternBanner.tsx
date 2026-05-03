import { Lightbulb } from "lucide-react";
import { useStateStore } from "@/stores/state-store";
import { detectFeedbackPatterns } from "@/lib/feedback/patterns";

/**
 * A calm, non-diagnostic banner that surfaces what Moment has noticed
 * from feedback so far. Speaks about the plan, never about the user.
 */
export const PatternBanner = ({ className = "" }: { className?: string }) => {
  const state = useStateStore((s) => s.state);
  const patterns = detectFeedbackPatterns(state);
  if (patterns.length === 0) return null;

  return (
    <section
      className={`rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-accent/5 p-4 ${className}`}
    >
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
        <Lightbulb className="h-3 w-3" /> what I'm noticing
      </div>
      <ul className="mt-2 space-y-2">
        {patterns.map((p) => (
          <li key={p.id} className="text-sm leading-snug text-foreground/90">
            {p.message}
          </li>
        ))}
      </ul>
    </section>
  );
};
