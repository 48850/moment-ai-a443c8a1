import { useState } from "react";
import { Loader2, Sparkles, BookOpen, X } from "lucide-react";
import { useAI } from "@/lib/ai/useAI";

interface TaskNote {
  id: string;
  content: string;
  created_at: string;
}

interface QuickReviewResult {
  headline: string;
  key_insights: string[];
  gaps?: string[];
  mini_lesson: { title: string; body: string };
  next_step: string;
}

export function QuickReviewNotes({
  taskTitle,
  taskContext,
  notes,
}: {
  taskTitle: string;
  taskContext?: string;
  notes: TaskNote[];
}) {
  const ai = useAI<QuickReviewResult>("notes_quick_review");
  const [open, setOpen] = useState(false);

  const handleRun = async () => {
    setOpen(true);
    await ai.run({
      task_title: taskTitle,
      task_context: taskContext ?? "",
      notes: [...notes]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((n) => ({ content: n.content, created_at: n.created_at })),
    });
  };

  if (notes.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          onClick={handleRun}
          disabled={ai.loading}
          className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
        >
          {ai.loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Sparkles className="h-3 w-3" />
          )}
          Quick review
        </button>
        {open && ai.result && (
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground"
            aria-label="Close review"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {open && ai.error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-destructive">
          {ai.error}
        </div>
      )}

      {open && ai.result && (
        <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/[0.03] p-3 text-xs">
          <div>
            <div className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
              Through-line
            </div>
            <p className="text-sm font-medium leading-snug">{ai.result.headline}</p>
          </div>

          {ai.result.key_insights?.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                What stood out
              </div>
              <ul className="space-y-1">
                {ai.result.key_insights.map((s, i) => (
                  <li key={i} className="flex gap-1.5 leading-relaxed">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ai.result.gaps && ai.result.gaps.length > 0 && (
            <div>
              <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Gaps to probe
              </div>
              <ul className="space-y-1">
                {ai.result.gaps.map((s, i) => (
                  <li key={i} className="flex gap-1.5 leading-relaxed text-muted-foreground">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500/60" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ai.result.mini_lesson && (
            <div className="rounded-lg border border-border bg-background/60 p-3">
              <div className="mb-1 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                <BookOpen className="h-3 w-3" /> Mini-lesson · {ai.result.mini_lesson.title}
              </div>
              <p className="leading-relaxed">{ai.result.mini_lesson.body}</p>
            </div>
          )}

          {ai.result.next_step && (
            <div>
              <div className="mb-0.5 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Next step
              </div>
              <p className="leading-relaxed">{ai.result.next_step}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
