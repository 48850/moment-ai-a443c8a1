import { Sparkles, Loader2 } from "lucide-react";
import { ReactNode } from "react";

interface Props {
  label?: string;
  loading?: boolean;
  error?: string | null;
  empty?: string;
  onRun?: () => void;
  cta?: string;
  children?: ReactNode;
}

export function AIInsight({ label = "AI insight", loading, error, empty, onRun, cta = "Ask Moment", children }: Props) {
  return (
    <section className="rounded-2xl border border-primary/30 bg-gradient-to-b from-primary/5 to-transparent p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
          <Sparkles className="h-3 w-3" /> {label}
        </div>
        {onRun && (
          <button
            onClick={onRun}
            disabled={loading}
            className="rounded-md border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : cta}
          </button>
        )}
      </div>
      <div className="mt-2 text-sm text-foreground/90">
        {error && <div className="text-xs text-destructive">{error}</div>}
        {!error && !children && !loading && (
          <div className="text-xs text-muted-foreground">{empty ?? "Tap to get a tailored read."}</div>
        )}
        {children}
      </div>
    </section>
  );
}
