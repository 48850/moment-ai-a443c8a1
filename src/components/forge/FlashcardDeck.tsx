/**
 * FlashcardDeck — Brainscape-style flippable cue cards for Forge flashcard
 * outputs. Front shows the explanation (active recall prompt: "What term?"),
 * user types the term, AI grades via app-intelligence `exam_rate_answer`.
 * Back reveals the term, AI feedback, and a "Next" button.
 *
 * Lets users flip the direction (term → explanation) too.
 */
import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Sparkles, ArrowRight, Eye, CheckCircle2, AlertCircle, Repeat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStateStore } from "@/stores/state-store";
import { buildContextPacket } from "@/lib/ai/context-packet";
import { buildLocalFallbackRating } from "@/lib/trial/trial-helpers";
import type { QuestionRating } from "@/lib/types";

export interface FlashcardItem {
  term: string;
  explanation: string;
}

interface FlashcardDeckProps {
  items: FlashcardItem[];
  subject?: string;
}

type Direction = "explanation_to_term" | "term_to_explanation";

interface Attempt {
  answer: string;
  rating: QuestionRating;
}

const LEVEL_COLOUR: Record<QuestionRating["level"], { ring: string; bg: string; text: string; dot: string }> = {
  strong:      { ring: "ring-emerald-500/40", bg: "bg-emerald-500/10",  text: "text-emerald-300", dot: "bg-emerald-400" },
  solid:       { ring: "ring-green-500/40",   bg: "bg-green-500/10",    text: "text-green-300",   dot: "bg-green-400" },
  developing:  { ring: "ring-amber-500/40",   bg: "bg-amber-500/10",    text: "text-amber-300",   dot: "bg-amber-400" },
  needs_work:  { ring: "ring-red-500/40",     bg: "bg-red-500/10",      text: "text-red-300",     dot: "bg-red-400" },
};

export function FlashcardDeck({ items, subject }: FlashcardDeckProps) {
  const state = useStateStore((s) => s.state);
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<Direction>("explanation_to_term");
  const [answerText, setAnswerText] = useState("");
  const [loading, setLoading] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [attempts, setAttempts] = useState<Record<number, Attempt>>({});

  const card = items[index];

  useEffect(() => {
    setAnswerText("");
    setFlipped(false);
    setLoading(false);
  }, [index, direction]);

  const prompt = direction === "explanation_to_term" ? card?.explanation : card?.term;
  const answer = direction === "explanation_to_term" ? card?.term : card?.explanation;
  const promptLabel = direction === "explanation_to_term" ? "Definition" : "Term";
  const answerLabel = direction === "explanation_to_term" ? "Term" : "Definition";
  const placeholder =
    direction === "explanation_to_term"
      ? "Type the term this describes…"
      : "Type the definition in your own words…";

  const attempt = attempts[index];
  const levelStyle = attempt ? LEVEL_COLOUR[attempt.rating.level] : null;

  const strongCount = useMemo(
    () => Object.values(attempts).filter((a) => a.rating.level === "strong" || a.rating.level === "solid").length,
    [attempts],
  );

  async function gradeWithAI(text: string): Promise<QuestionRating> {
    try {
      const { data, error } = await supabase.functions.invoke("app-intelligence", {
        body: {
          intent: "exam_rate_answer",
          snapshot: buildContextPacket(state),
          payload: {
            subject: subject ?? "general knowledge",
            question_text:
              direction === "explanation_to_term"
                ? `What term is described by: "${card.explanation}"`
                : `Define: "${card.term}"`,
            question_type: direction === "explanation_to_term" ? "short" : "essay",
            model_answer: answer,
            correct_answer: answer,
            expected_points: [answer],
            answer_text: text,
          },
        },
      });
      if (error) throw error;
      const r = (data?.result ?? data) as any;
      const rating = r?.rating ?? r;
      if (rating?.level) {
        return {
          level: rating.level,
          practice_estimate_label: rating.practice_estimate_label ?? rating.level,
          strengths: Array.isArray(rating.strengths) ? rating.strengths : [],
          missing_points: Array.isArray(rating.missing_points) ? rating.missing_points : [],
          misconception: rating.misconception ?? undefined,
          next_fix: rating.next_fix ?? "Try the next card.",
        };
      }
    } catch (e) {
      console.warn("Flashcard grading fallback", e);
    }
    return buildLocalFallbackRating(text);
  }

  async function handleSubmit() {
    const text = answerText.trim();
    if (!text || loading || !card) return;
    setLoading(true);
    const rating = await gradeWithAI(text);
    setAttempts((prev) => ({ ...prev, [index]: { answer: text, rating } }));
    setLoading(false);
    setFlipped(true);
  }

  function handleReveal() {
    setFlipped(true);
  }

  function handleNext() {
    if (index < items.length - 1) setIndex(index + 1);
  }

  function handlePrev() {
    if (index > 0) setIndex(index - 1);
  }

  if (!card) {
    return (
      <p className="text-sm italic text-muted-foreground">No flashcards available.</p>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Card {index + 1} / {items.length} · {strongCount} mastered
        </span>
        <div className="flex items-center gap-3">
          <button
            onClick={() =>
              setDirection((d) => (d === "explanation_to_term" ? "term_to_explanation" : "explanation_to_term"))
            }
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            title="Flip direction"
          >
            <Repeat className="h-3 w-3" /> {direction === "explanation_to_term" ? "Def → Term" : "Term → Def"}
          </button>
          {(attempt || flipped) && (
            <button
              onClick={() => setFlipped((v) => !v)}
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Flip
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${((index + 1) / items.length) * 100}%` }}
        />
      </div>

      {/* Card stage */}
      <div className="[perspective:1600px]">
        <div
          className={`relative min-h-[340px] w-full transition-transform duration-500 [transform-style:preserve-3d] ${
            flipped ? "[transform:rotateY(180deg)]" : ""
          }`}
        >
          {/* FRONT */}
          <div className="absolute inset-0 [backface-visibility:hidden]">
            <div className="h-full rounded-3xl border border-border bg-card shadow-xl shadow-black/20 flex flex-col">
              <div className="px-6 pt-6 pb-2 flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-[0.2em] text-indigo-300/80 font-medium">
                  {promptLabel}
                </span>
              </div>
              <div className="px-6 pb-4 flex-1 flex items-center">
                <p className="text-lg leading-relaxed font-medium text-foreground text-balance">
                  {prompt}
                </p>
              </div>

              <div className="px-6 pb-3">
                <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1.5">
                  Recall the {answerLabel.toLowerCase()}
                </p>
                <textarea
                  className="w-full bg-muted/30 border border-border rounded-2xl px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/60 resize-none focus:outline-none focus:border-indigo-500/60 focus:bg-muted/50 transition-colors min-h-[90px]"
                  placeholder={placeholder}
                  value={answerText}
                  onChange={(e) => setAnswerText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleSubmit();
                  }}
                  disabled={loading}
                />
              </div>

              <div className="px-6 pb-6 flex gap-2">
                <button
                  onClick={handleSubmit}
                  disabled={!answerText.trim() || loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl py-3 text-sm font-medium transition-colors"
                >
                  {loading ? (
                    <>
                      <Sparkles className="h-4 w-4 animate-pulse" /> Grading…
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" /> Submit & grade
                    </>
                  )}
                </button>
                <button
                  onClick={handleReveal}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-4 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:border-border/80 text-sm transition-colors"
                >
                  <Eye className="h-3.5 w-3.5" /> Reveal
                </button>
              </div>
            </div>
          </div>

          {/* BACK */}
          <div className="absolute inset-0 [transform:rotateY(180deg)] [backface-visibility:hidden]">
            <div className={`h-full rounded-3xl border border-border bg-card shadow-xl shadow-black/20 flex flex-col ${levelStyle ? `ring-2 ${levelStyle.ring}` : ""}`}>
              <div className="px-6 pt-6 pb-3 flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
                  {answerLabel}
                </span>
                {attempt && levelStyle && (
                  <div className={`flex items-center gap-2 px-2.5 py-1 rounded-full ${levelStyle.bg}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${levelStyle.dot}`} />
                    <span className={`text-[11px] font-medium ${levelStyle.text}`}>
                      {attempt.rating.practice_estimate_label}
                    </span>
                  </div>
                )}
              </div>

              <div className="px-6 pb-4 flex-1 overflow-y-auto space-y-4">
                <div className="rounded-xl bg-emerald-500/5 border border-emerald-500/15 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-emerald-400/80 mb-1">
                    Correct {answerLabel.toLowerCase()}
                  </p>
                  <p className="text-base font-medium text-foreground leading-relaxed">{answer}</p>
                </div>

                {attempt && (
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground mb-1">Your answer</p>
                    <p className="text-sm text-foreground/80 leading-relaxed">{attempt.answer}</p>
                  </div>
                )}

                {attempt?.rating && (
                  <div className="space-y-3">
                    {attempt.rating.strengths.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-emerald-400/80 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> What worked
                        </p>
                        {attempt.rating.strengths.map((s, i) => (
                          <p key={i} className="text-sm text-foreground/70 pl-3">+ {s}</p>
                        ))}
                      </div>
                    )}
                    {attempt.rating.missing_points.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-amber-400/80 flex items-center gap-1">
                          <AlertCircle className="h-3 w-3" /> Missing
                        </p>
                        {attempt.rating.missing_points.map((s, i) => (
                          <p key={i} className="text-sm text-foreground/70 pl-3">– {s}</p>
                        ))}
                      </div>
                    )}
                    {attempt.rating.misconception && (
                      <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-red-300/80 mb-0.5">Misconception</p>
                        <p className="text-sm text-foreground/80">{attempt.rating.misconception}</p>
                      </div>
                    )}
                    {attempt.rating.next_fix && (
                      <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.15em] text-indigo-300/80 mb-0.5">Next fix</p>
                        <p className="text-sm text-foreground/80">{attempt.rating.next_fix}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="px-6 pb-6 flex gap-2">
                <button
                  onClick={handlePrev}
                  disabled={index === 0}
                  className="px-4 rounded-xl border border-border text-muted-foreground hover:text-foreground disabled:opacity-30 text-sm transition-colors"
                >
                  ← Prev
                </button>
                <button
                  onClick={handleNext}
                  disabled={index >= items.length - 1}
                  className="flex-1 flex items-center justify-center gap-2 bg-muted/40 hover:bg-muted/60 border border-border text-foreground disabled:opacity-40 rounded-xl py-3 text-sm font-medium transition-colors"
                >
                  Next card <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Detect if an arbitrary AI output value looks like a flashcard list:
 * an array of objects each with a term/explanation-shaped pair.
 */
export function extractFlashcardItems(value: unknown): FlashcardItem[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const items: FlashcardItem[] = [];
  for (const v of value) {
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const obj = v as Record<string, unknown>;
    const term =
      (obj.term as string) ??
      (obj.front as string) ??
      (obj.question as string) ??
      (obj.concept as string) ??
      (obj.word as string);
    const explanation =
      (obj.explanation as string) ??
      (obj.definition as string) ??
      (obj.back as string) ??
      (obj.answer as string) ??
      (obj.meaning as string) ??
      (obj.description as string);
    if (typeof term !== "string" || typeof explanation !== "string") return null;
    if (!term.trim() || !explanation.trim()) return null;
    items.push({ term: term.trim(), explanation: explanation.trim() });
  }
  return items.length >= 2 ? items : null;
}
